import path from "path";
import fs from "fs";

const projectRoot = process.cwd();

const targetFiles = ["src/pages/SignIn.jsx", "src/pages/Login.jsx"];

const checkNavigationFrom = `
  const isFirstMountRef = useRef(true);
  const previousPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const isFirstMount = isFirstMountRef?.current;
    const isPathnameChanged = previousPathnameRef?.current !== location.pathname;
    const hasLocationState = location.state !== null && location.state !== undefined;
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const navigationType = navigationEntry?.type || '';
    const isPageReload = navigationType === 'reload';
    const isBackForward = navigationType === 'back_forward';

    if (isFirstMount) {
      isFirstMountRef.current = false;
      previousPathnameRef.current = location.pathname;
      if (hasLocationState) {
        window.location.reload();
        return;
      }
      if (isPageReload || isBackForward) {
        return;
      }
      return;
    }

    if (isPathnameChanged || hasLocationState) {
      previousPathnameRef.current = location.pathname;
      if (!isPageReload && !isBackForward) {
        window.location.reload();
      }
    }
  }, [location]);
`;

const newLogic = `
{
  e.preventDefault();
  setError("");
  
  if (!formData.email || !formData.password) {
    setError("이메일과 비밀번호를 모두 입력해주세요.");
    return;
  }

  setIsLoading(true);
  
  try {
    // Login with Base44 authentication using email and password
    const response = await base44.auth.loginViaEmailPassword(formData.email, formData.password);
    
    const mainUser = response?.user;
    if (response?.token) {
      localStorage.setItem('access_token', response.token);
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
    console.error("Login error:", error);
    setError(error.message || "이메일 또는 비밀번호가 잘못되었습니다. 다시 시도해 주세요.");
    setIsLoading(false);
  }
}
`;


const findFormRegex = /<form[^>]*onSubmit=\{([^}]+)\}[^>]*>/;
const findFunctionRegex = (funcName) =>
  new RegExp(
    `const\\s+${funcName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\};`,
    "m"
  );

const ensureReactHooksImport = (content) => {
  const reactImportRegex = /import\s+React(?:,\s*\{([^}]+)\})?\s+from\s+["']react["'];?/;
  const match = content.match(reactImportRegex);
  if (!match) {
    return content;
  }
  const namedImportsRaw = match[1];
  const requiredHooks = ["useRef", "useEffect"];
  if (namedImportsRaw) {
    const specs = namedImportsRaw
      .split(",")
      .map((spec) => spec.trim())
      .filter((spec) => spec.length > 0);
    let updated = [...specs];
    requiredHooks.forEach((hook) => {
      if (!updated.includes(hook)) {
        updated.push(hook);
      }
    });
    const newImportLine = `import React, { ${updated.join(", ")} } from "react";`;
    return content.replace(reactImportRegex, newImportLine);
  }
  const newImportLine = `import React, { ${requiredHooks.join(", ")} } from "react";`;
  return content.replace(reactImportRegex, newImportLine);
};

const ensureNavigationSnippet = (content) => {
  if (content.includes("const isFirstMountRef = useRef(true);")) {
    return content;
  }
  const locationDeclarationRegex = /const\s+location\s*=\s*useLocation\(\);?/;
  if (!locationDeclarationRegex.test(content)) {
    return content;
  }
  const trimmedSnippet = checkNavigationFrom.trim();
  return content.replace(
    locationDeclarationRegex,
    (match) => `${match}\n${trimmedSnippet}`
  );
};

for (const relativePath of targetFiles) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");

  const formMatch = content.match(findFormRegex);
  if (!formMatch) {
    console.warn(`⚠️ Err ${relativePath}`);
    continue;
  }

  const funcName = formMatch[1].trim();
  if (!funcName) {
    console.warn(`⚠️ Err ${relativePath}`);
    continue;
  }

  const funcRegex = findFunctionRegex(funcName);
  if (!funcRegex.test(content)) {
    console.warn(`⚠️ Err ${funcName} on ${relativePath}`);
    continue;
  }

  let updatedContent = content.replace(funcRegex, (match) => {
    const header = match.match(/^const\s+.*=>\s*\{/)[0];
    return `${header}${newLogic}\n  };`;
  });

  updatedContent = ensureNavigationSnippet(updatedContent);
  updatedContent = ensureReactHooksImport(updatedContent);

  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent, "utf8");
  }
}
