import path from "path";
import fs from "fs";

const projectRoot = process.cwd();

const targetFiles = ["src/pages/SuperAdmin_Login.jsx", "src/pages/SuperAdmin_SignIn.jsx"];

const replacements = {
  checkIfAlreadyLoggedIn: `const checkIfAlreadyLoggedIn = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser?.role === "admin") {
          navigate(createPageUrl("SuperAdmin_Dashboard"));
        } else {
          navigate(createPageUrl("SuperAdmin_Login"));
        }
      } catch (e) {
        localStorage.removeItem("superAdminSession");
        navigate(createPageUrl("SuperAdmin_Login"));
      }
    }
  };`,
  handleLogin: `const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await base44.auth.loginViaEmailPassword(email, password);
      const mainUser = response?.user;
      if (mainUser?.role !== "admin") {
        setError("관리자 계정이 아닙니다.");
        setIsLoading(false);
        return;
      }
      if (response?.token) {
        localStorage.setItem('access_token', response.token);
      }
      if (mainUser) {
        const session = {
          email: mainUser.email,
          full_name: mainUser.full_name,
          loginTime: new Date().toISOString()
        };
        localStorage.setItem("superAdminSession", JSON.stringify(session));
        // 대시보드로 이동
        navigate(createPageUrl("SuperAdmin_Dashboard"));
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      setError("로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };`
};

const replaceFunction = (content, funcName, newCode) => {
  const declIndex = content.indexOf(`const ${funcName}`);
  if (declIndex === -1) return { content, replaced: false };

  const arrowIndex = content.indexOf("=>", declIndex);
  const braceStart = content.indexOf("{", arrowIndex);
  if (arrowIndex === -1 || braceStart === -1) return { content, replaced: false };

  // Walk the string to find the matching closing brace for the function body
  let depth = 0;
  let bodyEnd = -1;
  for (let i = braceStart; i < content.length; i++) {
    const char = content[i];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (depth === 0) {
      bodyEnd = i;
      break;
    }
  }

  if (bodyEnd === -1) return { content, replaced: false };

  // Include trailing semicolon and whitespace after the function
  let endIndex = bodyEnd + 1;
  while (endIndex < content.length && /[\s;]/.test(content[endIndex])) {
    if (content[endIndex] === ";") {
      endIndex += 1;
      break;
    }
    endIndex += 1;
  }

  const updated = content.slice(0, declIndex) + newCode + content.slice(endIndex);
  return { content: updated, replaced: true };
};

for (const relativePath of targetFiles) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");

  for (const [funcName, newCode] of Object.entries(replacements)) {
    const result = replaceFunction(content, funcName, newCode);
    if (!result.replaced) {
      console.warn(`⚠️ Missing ${funcName} in ${relativePath}`);
      continue;
    }

    content = result.content;
  }

  fs.writeFileSync(filePath, content, "utf8");
}
