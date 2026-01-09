import fs from "fs";
import path from "path";

const rootDir = process.cwd();

// Paths
const scriptsDir = path.join(rootDir, 'scripts', 'firebase-sdk');
const sourceFirebaseDir = path.join(scriptsDir, 'firebase');
const targetFirebaseDir = path.join(rootDir, 'src', 'firebase');

const sourceSwFile = path.join(scriptsDir, 'public', 'firebase-messaging-sw.js');
const targetSwFile = path.join(rootDir, 'public', 'firebase-messaging-sw.js');

const mainJsxFile = path.join(rootDir, 'src', 'main.jsx');
const packageJsonFile = path.join(rootDir, 'package.json');

// Coloring for console
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✔ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}✖ ${msg}${colors.reset}`),
    info: (msg) => console.log(`ℹ ${msg}`)
};

async function run() {
    try {
        console.log('🚀 Starting append-service-notification script...');

        // 1. Copy firebase directory
        if (fs.existsSync(sourceFirebaseDir)) {
             // Node < 16.7 doesn't support cpSync with recursive, but most modern envs do.
             // Fallback for older nodes if needed, but assumption is modern node environment.
             if (fs.cpSync) {
                 fs.cpSync(sourceFirebaseDir, targetFirebaseDir, { recursive: true });
             } else {
                 // Simple fallback for older node versions just in case, though unlikely needed
                 log.warn('fs.cpSync not found, skipping directory copy (please update Node or check paths)');
             }
             log.success(`Copied directory: ${sourceFirebaseDir} -> ${targetFirebaseDir}`);
        } else {
            log.error(`Source directory not found: ${sourceFirebaseDir}`);
        }

        // 2. Copy service worker file
        if (fs.existsSync(sourceSwFile)) {
            const publicDir = path.dirname(targetSwFile);
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
            
            fs.copyFileSync(sourceSwFile, targetSwFile);
            log.success(`Copied file: ${sourceSwFile} -> ${targetSwFile}`);
        } else {
            log.error(`Source file not found: ${sourceSwFile}`);
        }

        // 3. Inject code into src/main.jsx
        if (fs.existsSync(mainJsxFile)) {
            let content = fs.readFileSync(mainJsxFile, 'utf-8');
            
            const injectionCode = `
// Initialize Simple Push Notifications
import simplePushService from '@/firebase/pushNotificationService'
if (typeof window !== 'undefined') {
  try {
    simplePushService.initialize().then((success) => {
      if (success) {
        if (simplePushService.isServiceInitialized()) {
          simplePushService.handleTokenRefresh();
        }
      } else {
        console.warn('⚠️ Push notifications service initialization failed');
      }
    }).catch((error) => {
      console.log('❌ Push notifications service initialization error:', error);
    });
    
  } catch (error) {
    console.log("Failed to initialize UUID or push notifications:", error);
  }
}
`;

            if (content.includes('simplePushService.initialize()')) {
                log.warn(`Code seems to be already injected in ${mainJsxFile}. Skipping injection.`);
            } else {
                const insertionMarker = 'ReactDOM.createRoot';
                const insertionIndex = content.indexOf(insertionMarker);

                if (insertionIndex !== -1) {
                    const newContent = content.slice(0, insertionIndex) + injectionCode + '\n' + content.slice(insertionIndex);
                    fs.writeFileSync(mainJsxFile, newContent, 'utf-8');
                    log.success(`Injected notification code into ${mainJsxFile}`);
                } else {
                    log.error(`Could not find "${insertionMarker}" in ${mainJsxFile}. Injection failed.`);
                }
            }
        } else {
            log.error(`File not found: ${mainJsxFile}`);
        }

        // 4. Check and add firebase dependency
        if (fs.existsSync(packageJsonFile)) {
            const packageJsonContent = fs.readFileSync(packageJsonFile, 'utf-8');
            let packageJson;
            try {
                packageJson = JSON.parse(packageJsonContent);
            } catch (e) {
                log.error(`Failed to parse package.json: ${e.message}`);
            }

            if (packageJson) {
                if (!packageJson.dependencies) {
                    packageJson.dependencies = {};
                }

                if (!packageJson.dependencies['firebase']) {
                    log.info('Adding "firebase": "12.3.0" to dependencies...');
                    packageJson.dependencies['firebase'] = "12.3.0";
                    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf-8'); // Indent with 2 spaces
                    log.success(`Added firebase dependency to ${packageJsonFile}`);
                } else {
                    log.success(`Firebase dependency already exists in ${packageJsonFile} (Version: ${packageJson.dependencies['firebase']})`);
                }
            }
        } else {
            log.error(`File not found: ${packageJsonFile}`);
        }

        console.log('✨ Script completed.');

    } catch (error) {
        log.error(`An error occurred: ${error.message}`);
        process.exit(1);
    }
}

run();
