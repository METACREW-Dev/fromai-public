#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

const targetDir = path.join(projectRoot, "src");
const targetFile = path.join(targetDir, "App.jsx");

// --------------------------------------------
// Script main logic
// --------------------------------------------

// Check if target file exists
if (!fs.existsSync(targetFile)) {
  console.error(`❌ File not found: ${targetFile}`);
  process.exit(1);
}

// Read file content
let code = fs.readFileSync(targetFile, "utf8");

// This regex targets `return null;` ONLY if it's at the start of a line and not commented out.
// "navigateToLogin();" is on the previous line, so we want to delete JUST THE "return null;" next to it.
const returnNullPattern = /^(?:(?<=\n)|^)[ \t]*return\s+null;[ \t]*\n?/m;

let removed = false;
if (returnNullPattern.test(code)) {
  code = code.replace(returnNullPattern, "");
  removed = true;
}

// Write the updated file
fs.writeFileSync(targetFile, code, "utf8");

if (removed) {
  console.log(
    `✅ Removed 'return null;' after navigateToLogin() in ${path.relative(projectRoot, targetFile)}`
  );
} else {
  console.log(
    `ℹ️ No 'return null;' found to remove in ${path.relative(projectRoot, targetFile)}`
  );
}
