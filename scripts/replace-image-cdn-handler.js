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
    
    const data = await response.json();
    
    if (data && data.cdn_url) {
      return { newUrl: data.cdn_url, error: null };
    } else {
      throw new Error('API response does not contain newUrl');
    }
    
  } catch (error) {
    console.error(`[API ERROR] ${API_URL} - ${error.message}`);
    return { newUrl: null, error: error.message };
  }
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
  const regex = /(https?:\/\/[^\s"'`]+|(?:\/|\.\.\/)[^\s"'`]+)/g;
  
  const matches = Array.from(content.matchAll(regex));
  if (matches.length === 0) {
    return; // No links found, skip
  }

  // Step 1: Collect all *unique* URLs containing the keyword
  const uniqueUrlsToProcess = new Set();
  for (const match of matches) {
    const originalUrl = match[0];
    if (originalUrl.includes(KEYWORD_TO_FIND)) {
      uniqueUrlsToProcess.add(originalUrl);
    }
  }

  if (uniqueUrlsToProcess.size === 0) {
    return; // No links containing the keyword found, skip
  }

  // Step 2: Call API for each unique URL
  const replacements = new Map(); // Store map <oldUrl, newUrl>
  
  for (const originalUrl of uniqueUrlsToProcess) {
    const { newUrl, error } = await getNewUrlFromApi(originalUrl);

    if (newUrl) {
      if (newUrl !== originalUrl) {
        replacements.set(originalUrl, newUrl);
        contentChanged = true;
        addLogEntry(filePath, 'SUCCESS', originalUrl, newUrl);
      } else {
        addLogEntry(filePath, 'SKIPPED', originalUrl, originalUrl, 'New link is same as old');
      }
    } else {
      addLogEntry(filePath, 'API_ERROR', originalUrl, '', error || 'Unknown API error');
    }
  }

  // Step 3: If there are changes, apply all and write to file
  if (contentChanged) {
    let newContent = content;
    
    // Apply replacements
    // Use split/join to safely replace all occurrences
    // and avoid regex issues with special characters in URLs
    for (const [originalUrl, newUrl] of replacements.entries()) {
      newContent = newContent.split(originalUrl).join(newUrl);
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