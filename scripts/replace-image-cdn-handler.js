import { promises as fs } from 'fs';
import path from 'path';

// --- YOUR CONFIGURATION ---

// ---- Parse CLI args ----
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, val] = arg.replace(/^--/, "").split("=");
    return [key, val ?? true];
  })
);
const API_URL = args?.api || args["api-url"] || null;
// const PROJECT_KEY = args?.project || args?.project_key || null;
const KEYWORD_TO_FIND = 'public/base44-prod';
const SOURCE_DIRECTORY = './src';
const FILE_EXTENSIONS = ['.tsx', '.jsx'];

// --- END CONFIGURATION ---

// Array to store all log entries for a summary table
const logEntries = [];

/**
 * Log progress to the console in real time
 */
function logProgress(message) {
  console.log(`${new Date().toISOString()} - ${message}`);
}

/**
 * Add an entry to the log array to generate the table
 * @param {string} file - File path
 * @param {string} status - Status (SUCCESS, FAILED, API_ERROR)
 * @param {string} originalSrc - Original link
 * @param {string} newSrc - New link (if available)
 * @param {string} notes - Additional notes (e.g., error)
 */
function addLogEntry(file, status, originalSrc, newSrc = '', notes = '') {
  logEntries.push({
    File: file,
    Status: status,
    OriginalSrc: originalSrc,
    NewSrc: newSrc,
    Notes: notes,
  });
}

/**
 * Call API to get the new URL
 * @param {string} oldUrl - Original URL
 * @returns {Promise<{newUrl: string|null, error: string|null}>}
 */
async function getNewUrlFromApi(oldUrl) {
  if (!API_URL) {
    const errorMsg = 'API_URL is not defined. Set them via CLI args.';
    console.error(`[FATAL ERROR] ${errorMsg}`);
    addLogEntry('GLOBAL', 'API_ERROR', oldUrl, '', errorMsg);
    process.exit(1); 
  }

  const requestUrl = `${API_URL}`;
  
  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: oldUrl,
      }),
    });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const res = await response.json();
    if (res?.data && res?.data?.cdn_url) {
      return { newUrl: res?.data?.cdn_url, error: null };
    } else {
      throw new Error('API response does not contain newUrl');
    }
    
  } catch (error) {
    console.error(`[API ERROR] ${API_URL} - ${error.message}`);
    return { newUrl: null, error: error.message };
  }
}

/**
 * Normalize URL by removing trailing punctuation and closing brackets
 * This handles cases like url(...), url('...'), url("..."), etc.
 * @param {string} url - URL string that may contain trailing characters
 * @returns {string} - Cleaned URL
 */
function normalizeUrl(url) {
  if (!url) {
    return url;
  }
  // Remove trailing closing brackets, commas, semicolons, and quotes
  // This handles: url(...), url('...'), url("..."), ..., ;, etc.
  return url.replace(/[),;'"`]+$/, '').trim();
}

/**
 * Process a single file
 * @param {string} filePath - Path to the file
 */
async function processFile(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (readError) {
    addLogEntry(filePath, 'FILE_ERROR', '', '', `Cannot read file: ${readError.message}`);
    return;
  }
  
  let contentChanged = false;
  
  // **MAIN CHANGE:**
  // This regex finds all URL-like strings:
  // (http://... | https://... | /... | ../...)
  // It stops at whitespace or quote characters ( ' " ` )
  // Note: We'll normalize URLs afterward to remove trailing ), ,, ;, etc.
  const regex = /(https?:\/\/[^\s"'`]+|(?:\/|\.\.\/)[^\s"'`]+)/g;
  
  const matches = Array.from(content.matchAll(regex));
  if (matches.length === 0) {
    return; // No links found, skip
  }

  // Step 1: Collect all *unique* URLs containing the keyword
  // Map to store normalized URL -> array of original matches for replacement
  const normalizedToOriginals = new Map(); // <normalizedUrl, Set<originalMatch>>
  const uniqueUrlsToProcess = new Set();
  
  for (const match of matches) {
    const originalMatch = match[0];
    const normalizedUrl = normalizeUrl(originalMatch);
    
    if (normalizedUrl.includes(KEYWORD_TO_FIND)) {
      uniqueUrlsToProcess.add(normalizedUrl);
      // Store all original matches for this normalized URL
      if (!normalizedToOriginals.has(normalizedUrl)) {
        normalizedToOriginals.set(normalizedUrl, new Set());
      }
      normalizedToOriginals.get(normalizedUrl).add(originalMatch);
    }
  }

  if (uniqueUrlsToProcess.size === 0) {
    return; // No links containing the keyword found, skip
  }

  // Step 2: Call API for each unique normalized URL
  const normalizedToNewUrl = new Map(); // Store map <normalizedUrl, newUrl>
  
  for (const normalizedUrl of uniqueUrlsToProcess) {
    const { newUrl, error } = await getNewUrlFromApi(normalizedUrl);

    if (newUrl) {
      if (newUrl !== normalizedUrl) {
        normalizedToNewUrl.set(normalizedUrl, newUrl);
        contentChanged = true;
        addLogEntry(filePath, 'SUCCESS', normalizedUrl, newUrl);
      } else {
        addLogEntry(filePath, 'SKIPPED', normalizedUrl, normalizedUrl, 'New link is same as old');
      }
    } else {
      addLogEntry(filePath, 'API_ERROR', normalizedUrl, '', error || 'Unknown API error');
    }
  }

  // Step 3: If there are changes, apply all and write to file
  if (contentChanged) {
    let newContent = content;
    
    // Apply replacements
    // We need to replace all original matches (which may include trailing ), ,, ;)
    // with the new URL, preserving the trailing characters if they exist
    for (const [normalizedUrl, originalMatches] of normalizedToOriginals.entries()) {
      const newUrl = normalizedToNewUrl.get(normalizedUrl);
      if (newUrl) {
        // Replace each original match with new URL + trailing characters
        for (const originalMatch of originalMatches) {
          const trailingChars = originalMatch.replace(normalizedUrl, '');
          const replacement = newUrl + trailingChars;
          newContent = newContent.split(originalMatch).join(replacement);
        }
      }
    }
    
    try {
      await fs.writeFile(filePath, newContent, 'utf8');
    } catch (writeError) {
      addLogEntry(filePath, 'FILE_ERROR', '', '', `Cannot write file: ${writeError.message}`);
    }
  }
}

/**
 * Recursively scan a directory
 * @param {string} dir - Starting directory
 */
async function scanDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile() && FILE_EXTENSIONS.includes(path.extname(entry.name))) {
        await processFile(fullPath);
      }
    }
  } catch (error) {
    logProgress(`[SCAN ERROR] Cannot scan directory ${dir}: ${error.message}`);
  }
}


/**
 * Main runner function
 */
async function main() {
  logProgress('=== STARTING URL REPLACEMENT SCRIPT ===');
  
  if (!API_URL) {
    logProgress('[ERROR] Missing required arguments: --api=<URL> are required.');
    logProgress('Example: node script.js --api="https://api.example.com/getUrl" --project="my-project"');
    return;
  }
  
  logProgress(`Scanning directory: ${SOURCE_DIRECTORY}`);
  logProgress(`Looking for keyword: ${KEYWORD_TO_FIND}`);
  
  await scanDirectory(SOURCE_DIRECTORY);
  
  // 1. Print summary table to console
  if (logEntries.length > 0) {
    console.log('\n\n--- SUMMARY OF CHANGES ---');
    console.table(logEntries);
    console.log('------------------------------\n');
  } else {
   logProgress('No links containing the keyword were found.');
  }
  
  logProgress('=== END OF SCRIPT ===');
}

main();