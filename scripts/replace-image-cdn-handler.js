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
const PROJECT_KEY = args?.project || args?.project_key || null;
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
  const requestUrl = `${API_URL}?oldUrl=${encodeURIComponent(oldUrl)}&projectKey=${PROJECT_KEY}`;
  
  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.newUrl) {
      return { newUrl: data.newUrl, error: null };
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
  const regex = /<img[^>]+src="([^"]+)"/g;
  
  const matches = Array.from(content.matchAll(regex));
  if (matches.length === 0) {
    return; // No img tag found, skip
  }

  for (const match of matches) {
    const fullImgTag = match[0];
    const originalSrc = match[1];

    if (originalSrc.includes(KEYWORD_TO_FIND)) {

      const { newUrl, error } = await getNewUrlFromApi(originalSrc);

      if (newUrl) {
        if (newUrl !== originalSrc) {
          const newImgTag = fullImgTag.replace(originalSrc, newUrl);
          content = content.replace(fullImgTag, newImgTag);
          contentChanged = true;
          addLogEntry(filePath, 'SUCCESS', originalSrc, newUrl);
        } else {
          addLogEntry(filePath, 'SKIPPED', originalSrc, newUrl, 'New link is same as old');
        }
      } else {
        addLogEntry(filePath, 'API_ERROR', originalSrc, '', error);
      }
    }
  }

  if (contentChanged) {
    try {
      await fs.writeFile(filePath, content, 'utf8');
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
  logProgress('=== STARTING SRC REPLACEMENT SCRIPT ===');
  await scanDirectory(SOURCE_DIRECTORY);
  // 1. Print summary table to console
  if (logEntries.length > 0) {
    console.log('\n\n--- SUMMARY OF CHANGES ---');
    console.table(logEntries);
    console.log('------------------------------\n');
  } else {
   logProgress('No links to update found.');
  }
  
  logProgress('=== END OF SCRIPT ===');
}

main();