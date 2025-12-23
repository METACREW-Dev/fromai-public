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

const checkAppLogin = `
  useEffect(() => {
    if (window?.location?.search?.includes('isAppLogin=true') && window?.flutter_inappwebview) {
      const handleAppLogin = async () => {
        try {
          const response = await window?.flutter_inappwebview?.callHandler("get_user_info");
          if (response && (response?.status === "success" || response?.success)) {
            const data = response?.data;
            const mainUser = data?.user;
            if (data?.accessToken) {
              localStorage.setItem("access_token", data.accessToken);
            }
            if (mainUser) {
              localStorage.setItem("auth_user_id", mainUser.id);
              localStorage.setItem("auth_user_email", mainUser.user_email);
              localStorage.setItem("auth_name", mainUser.full_name);
              if (mainUser?.role === "admin") {
                const session = {
                  email: mainUser.email || mainUser.user_email,
                  full_name: mainUser.full_name,
                  loginTime: new Date().toISOString()
                };
                localStorage.setItem("superAdminSession", JSON.stringify(session));
              }
              // await login(mainUser);
              if(window?.location?.search?.includes('isFirstLogin=true') && mainUser?.user_type === "artist"){
                window.location.href = "/onboarding";
              }else {
                window.location.href = "/";
              }
            }
          }
        } catch (error) {
          console.error("Login error in app:", error);
        }
      };
      handleAppLogin();
    }
  }, []);
`

// Add useEffect import if not present
const useEffectImportPattern = /import\s+.*\{[^}]*useEffect[^}]*\}\s+from\s+['"]react['"]/;
const reactNamedImportPattern = /import\s+\{([^}]+)\}\s+from\s+['"]react['"]/;
const reactDefaultImportPattern = /import\s+React\s+from\s+['"]react['"]/;

let addedUseEffectImport = false;
if (!useEffectImportPattern.test(code)) {
  const namedMatch = code.match(reactNamedImportPattern);
  if (namedMatch) {
    // If React is imported with named imports, add useEffect to the list
    const imports = namedMatch[1].trim();
    const newImports = imports ? `${imports}, useEffect` : 'useEffect';
    code = code.replace(reactNamedImportPattern, `import { ${newImports} } from 'react'`);
    addedUseEffectImport = true;
  } else if (reactDefaultImportPattern.test(code)) {
    // If React is imported as default, add named import for useEffect
    code = code.replace(reactDefaultImportPattern, (match) => {
      return match + "\nimport { useEffect } from 'react'";
    });
    addedUseEffectImport = true;
  } else {
    // If React is not imported at all, add a new import statement at the top
    const firstImportIndex = code.indexOf('import');
    if (firstImportIndex !== -1) {
      const firstImportEnd = code.indexOf('\n', firstImportIndex);
      code = code.slice(0, firstImportEnd + 1) + "import { useEffect } from 'react';\n" + code.slice(firstImportEnd + 1);
    } else {
      code = "import { useEffect } from 'react';\n" + code;
    }
    addedUseEffectImport = true;
  }
}

// Add checkAppLogin code inside App function
const appFunctionPattern = /function\s+App\s*\([^)]*\)\s*\{/;
const checkAppLoginExistsPattern = /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*isAppLogin=true/;

let addedCheckAppLogin = false;
if (appFunctionPattern.test(code) && !checkAppLoginExistsPattern.test(code)) {
  // Find the opening brace of App function and add checkAppLogin after it
  const match = code.match(appFunctionPattern);
  if (match) {
    const appStartIndex = match.index + match[0].length;
    // Find the first line after the opening brace (skip whitespace and newlines)
    let insertIndex = appStartIndex;
    while (code[insertIndex] === ' ' || code[insertIndex] === '\n' || code[insertIndex] === '\t' || code[insertIndex] === '\r') {
      insertIndex++;
    }
    code = code.slice(0, insertIndex) + checkAppLogin + code.slice(insertIndex);
    addedCheckAppLogin = true;
  }
}

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

let messages = [];
if (addedUseEffectImport) {
  messages.push(`✅ Added useEffect import`);
}
if (addedCheckAppLogin) {
  messages.push(`✅ Added checkAppLogin code`);
}
if (removed) {
  messages.push(`✅ Removed 'return null;' after navigateToLogin()`);
}

if (messages.length > 0) {
  console.log(
    `${messages.join(', ')} in ${path.relative(projectRoot, targetFile)}`
  );
} else {
  console.log(
    `ℹ️ No changes made to ${path.relative(projectRoot, targetFile)}`
  );
}
