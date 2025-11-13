import path from "path";
import fs from "fs";

const projectRoot = process.cwd();

const targetFiles = ["src/pages/SignIn.jsx", "src/pages/Login.jsx"];

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

  content = content.replace(funcRegex, (match) => {
    const header = match.match(/^const\s+.*=>\s*\{/)[0];
    return `${header}${newLogic}\n  };`;
  });

  fs.writeFileSync(filePath, content, "utf8");
}
