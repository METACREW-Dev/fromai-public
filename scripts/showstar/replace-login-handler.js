import path from "path";
import fs from "fs";

const PROJECT_ROOT = process.cwd();
const TARGET_FILES = ["src/pages/SignIn.jsx", "src/pages/Login.jsx"];

const NEW_HANDLE_SUBMIT_LOGIC = `{
    e.preventDefault();
    setError(null);
    if (!formData.email || !formData.password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await base44.auth.loginViaEmailPassword(formData.email, formData.password);
      const mainUser = response?.user;
      if (response?.token) {
        localStorage.setItem("access_token", response?.token);
      }
      if (mainUser) {
        if (mainUser?.role === "admin") {
          const session = {
            email: mainUser.email,
            full_name: mainUser.full_name,
            loginTime: new Date().toISOString()
          };
          localStorage.setItem("superAdminSession", JSON.stringify(session));
        }
        await login(mainUser);
      }
        window.location.href = "/";
    } catch (error) {
      console.error("로그인 실패:", error);
      setError(error.message || "이메일 또는 비밀번호가 일치하지 않습니다. 다시 시도해주세요.");
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }`;

const NEW_APP_LOGIN_LOGIC = `useLayoutEffect(() => {
    const handleAppLogin = async () => {
      if (window?.flutter_inappwebview) {
        try {
          const response = await window?.flutter_inappwebview?.callHandler("login");
          if (response && (response?.status === "success" || response?.success)) {
            const mainUser = response?.user;
            if (response?.token) {
              localStorage.setItem("access_token", response.token);
            }
            if (mainUser) {
              if (mainUser?.role === "admin") {
                const session = {
                  email: mainUser.email || mainUser.user_email,
                  full_name: mainUser.full_name,
                  loginTime: new Date().toISOString()
                };
                localStorage.setItem("superAdminSession", JSON.stringify(session));
              }
              await login(mainUser);
            }
          }
        } catch (error) {
          console.error("Login error in app:", error);
        }
      }
    };
    handleAppLogin();
  }, [login]);`;

const FORM_ONSUBMIT_REGEX = /<form[^>]*onSubmit\s*=\s*\{([^}]+)\}[^>]*>/;
const REACT_IMPORT_REGEX = /import\s+React(?:\s*,\s*\{[^}]*\})?\s+from\s+["']react["']/;
const RETURN_STATEMENT_REGEX = /^(\s+)return\s*\(/m;

function findHandleSubmitFunction(content, functionName) {
  const patterns = [
    new RegExp(
      `const\\s+${functionName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\};`,
      "m"
    ),
    new RegExp(
      `const\\s+${functionName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
      "m"
    ),
    new RegExp(
      `function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
      "m"
    )
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return { match: match[0], pattern };
    }
  }
  return null;
}

function addUseLayoutEffectImport(content) {
  const reactImportMatch = content.match(REACT_IMPORT_REGEX);
  if (!reactImportMatch) {
    const firstImportMatch = content.match(/^import\s+/m);
    if (firstImportMatch) {
      const insertIndex = firstImportMatch.index;
      return (
        content.slice(0, insertIndex) +
        'import React, { useLayoutEffect } from "react";\n' +
        content.slice(insertIndex)
      );
    }
    return 'import React, { useLayoutEffect } from "react";\n' + content;
  }
  const importLine = reactImportMatch[0];
  if (importLine.includes("useLayoutEffect")) {
    return content;
  }
  if (importLine.includes("{")) {
    return content.replace(REACT_IMPORT_REGEX, (match) => {
      return match.replace(/\{([^}]*)\}/, (_, imports) => {
        const importList = imports
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean);
        if (!importList.includes("useLayoutEffect")) {
          importList.push("useLayoutEffect");
        }
        return `{ ${importList.join(", ")} }`;
      });
    });
  }
  return content.replace(
    /import\s+React\s+from\s+["']react["']/,
    'import React, { useLayoutEffect } from "react"'
  );
}

function replaceHandleSubmitFunction(content, functionName) {
  const functionMatch = findHandleSubmitFunction(content, functionName);
  if (!functionMatch) {
    return null;
  }
  const functionHeader = functionMatch.match.match(/^(const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{|function\s+\w+\s*\([^)]*\)\s*\{)/)[0];
  return content.replace(functionMatch.pattern, `${functionHeader}${NEW_HANDLE_SUBMIT_LOGIC}\n  };`);
}

function addAppLoginLogic(content) {
  const hasAppLoginLogic =
    content.includes("handleAppLogin");
  if (hasAppLoginLogic) {
    return content;
  }
  const returnMatch = content.match(RETURN_STATEMENT_REGEX);
  if (!returnMatch) {
    return content;
  }
  const indent = returnMatch[1];
  const indentedLogic = NEW_APP_LOGIN_LOGIC.split("\n")
    .map((line) => {
      if (line.trim() === "") {
        return "";
      }
      const trimmedLine = line.replace(/^\s+/, "");
      return `${indent}${trimmedLine}`;
    })
    .join("\n");
  return content.replace(RETURN_STATEMENT_REGEX, `${indentedLogic}\n${indent}return (`);
}

function processFile(relativePath) {
  const filePath = path.join(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${relativePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  const formMatch = content.match(FORM_ONSUBMIT_REGEX);
  if (!formMatch) {
    console.warn(`⚠️  Form onSubmit handler not found in ${relativePath}`);
    return;
  }
  const functionName = formMatch[1].trim();
  if (!functionName) {
    console.warn(`⚠️  Function name not found in ${relativePath}`);
    return;
  }
  content = addUseLayoutEffectImport(content);
  const updatedContent = replaceHandleSubmitFunction(content, functionName);
  if (!updatedContent) {
    console.warn(`⚠️  Function ${functionName} not found in ${relativePath}`);
    return;
  }
  const finalContent = addAppLoginLogic(updatedContent);
  fs.writeFileSync(filePath, finalContent, "utf8");
  console.log(`✅ Successfully updated ${relativePath}`);
}

for (const relativePath of TARGET_FILES) {
  processFile(relativePath);
}
