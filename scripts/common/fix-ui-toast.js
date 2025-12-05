#!/usr/bin/env node

/**
 * Script to automatically apply fixes to toast.jsx and toaster.jsx
 * This script adds pointer-events-none to ToastProvider and ToastViewport
 * and adds dismiss functionality to ToastClose
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TOAST_FILE = path.join(PROJECT_ROOT, 'src/components/ui/toast.jsx');
const TOASTER_FILE = path.join(PROJECT_ROOT, 'src/components/ui/toaster.jsx');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function ensureNewline(content) {
  if (content && !content.endsWith('\n')) {
    return content + '\n';
  }
  return content;
}

console.log('Applying fixes to toast components...');

// Check if files exist
if (!fs.existsSync(TOAST_FILE)) {
  console.log('Warning: toast.jsx not found, skipping toast.jsx fixes');
}

if (!fs.existsSync(TOASTER_FILE)) {
  console.log('Warning: toaster.jsx not found, skipping toaster.jsx fixes');
  process.exit(0);
}

let toastContent = readFile(TOAST_FILE);
let toasterContent = readFile(TOASTER_FILE);
let toastChanged = false;
let toasterChanged = false;

// Fix toast.jsx - Add pointer-events-none to ToastProvider className
if (toastContent) {
  const providerPattern = /(className="[^"]*md:max-w-\[420px\][^"]*")/;
  const providerWithPointerEvents = /md:max-w-\[420px\]\s+pointer-events-none/;
  
  if (providerPattern.test(toastContent) && !providerWithPointerEvents.test(toastContent)) {
    console.log('  - Adding pointer-events-none to ToastProvider...');
    toastContent = toastContent.replace(
      /(className="[^"]*)(md:max-w-\[420px\])([^"]*")/,
      '$1$2 pointer-events-none$3'
    );
    toastChanged = true;
  } else if (providerWithPointerEvents.test(toastContent)) {
    console.log('  - ToastProvider already has pointer-events-none');
  }
}

// Fix toast.jsx - Add pointer-events-none to ToastViewport className
if (toastContent) {
  const viewportPattern = /(const ToastViewport[\s\S]*?className="[^"]*md:max-w-\[420px\][^"]*")/;
  const viewportWithPointerEvents = /const ToastViewport[\s\S]*?md:max-w-\[420px\]\s+pointer-events-none/;
  
  if (viewportPattern.test(toastContent) && !viewportWithPointerEvents.test(toastContent)) {
    console.log('  - Adding pointer-events-none to ToastViewport...');
    toastContent = toastContent.replace(
      /(const ToastViewport[\s\S]*?className="[^"]*)(md:max-w-\[420px\])([^"]*")/,
      '$1$2 pointer-events-none$3'
    );
    toastChanged = true;
  } else if (viewportWithPointerEvents.test(toastContent)) {
    console.log('  - ToastViewport already has pointer-events-none');
  }
}

// Write toast.jsx if changed
if (toastContent && toastChanged) {
  toastContent = ensureNewline(toastContent);
  writeFile(TOAST_FILE, toastContent);
}

// Fix toaster.jsx - Add dismiss to useToast destructuring
if (toasterContent) {
  const hasDismiss = /const\s*{\s*toasts\s*,\s*dismiss\s*}\s*=\s*useToast\(\)/;
  const hasToastsOnly = /const\s*{\s*toasts\s*}\s*=\s*useToast\(\)/;
  
  if (!hasDismiss.test(toasterContent) && hasToastsOnly.test(toasterContent)) {
    console.log('  - Adding dismiss to useToast destructuring...');
    toasterContent = toasterContent.replace(
      /const\s*{\s*toasts\s*}\s*=\s*useToast\(\)/,
      'const { toasts, dismiss } = useToast()'
    );
    toasterChanged = true;
  } else if (hasDismiss.test(toasterContent)) {
    console.log('  - dismiss already added to useToast destructuring');
  } else {
    console.log('  - Warning: Could not find useToast() call in toaster.jsx');
  }
}

// Fix toaster.jsx - Add onClick handler to ToastClose
if (toasterContent) {
  const hasOnClick = /onClick=\{\(e\)\s*=>\s*\{/;
  const hasToastClose = /<ToastClose/;
  
  if (!hasOnClick.test(toasterContent) && hasToastClose.test(toasterContent)) {
    console.log('  - Adding onClick handler to ToastClose...');
    const lines = toasterContent.split('\n');
    const newLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\s*)<ToastClose\s*\/>/);
      if (match) {
        const indent = match[1];
        newLines.push(`${indent}<ToastClose`);
        newLines.push(`${indent}  onClick={(e) => {`);
        newLines.push(`${indent}    e.preventDefault();`);
        newLines.push(`${indent}    e.stopPropagation();`);
        newLines.push(`${indent}    dismiss && dismiss(id);`);
        newLines.push(`${indent}  }}`);
        newLines.push(`${indent}/>`);
        toasterChanged = true;
      } else {
        newLines.push(line);
      }
    }
    toasterContent = newLines.join('\n');
  } else if (hasOnClick.test(toasterContent)) {
    console.log('  - onClick handler already added to ToastClose');
  } else {
    console.log('  - Warning: Could not find ToastClose in toaster.jsx');
  }
}

// Write toaster.jsx if changed
if (toasterContent && toasterChanged) {
  toasterContent = ensureNewline(toasterContent);
  writeFile(TOASTER_FILE, toasterContent);
}

console.log('Done! Toast components have been fixed.');

