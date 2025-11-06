#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const srcPath = path.join(projectRoot, "src");

const regex =
  /export\s+const\s+AuthProvider\s*=\s*\(\{\s*children\s*\}\)\s*=>\s*\{[\s\S]*?\n\};/m;

const protectedLogic = `
  const redirectToLogin = useCallback((returnUrl) => {
    const url = returnUrl || window.location.pathname;
    base44.auth.redirectToLogin(createPageUrl(url));
  }, []);

  const isProtectedPage = useCallback(
    (pathname) => PROTECTED_PAGES.some((page) => pathname.includes(page)),
    []
  );
`;

function buildNewAuthProvider(includeProtectedLogic = false) {
  return `
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const appPublicSettings = {};

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      try {
        if (localStorage.getItem('access_token')) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    window.location.href = "/";
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    if (base44.auth.redirectToLogin) {
      base44.auth.redirectToLogin(window.location.href);
    } else if (base44.auth.login) {
      base44.auth.login(window.location.href);
    }
  };
  
${includeProtectedLogic ? protectedLogic : ""}

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState${
        includeProtectedLogic ? ", redirectToLogin, isProtectedPage" : ""
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};
`;
}

function findAuthContextFiles(dir) {
  const results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findAuthContextFiles(fullPath));
    } else if (/AuthContext\.(js|jsx|ts|tsx)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

const foundFiles = findAuthContextFiles(srcPath);
if (foundFiles.length === 0) {
  console.error("❌ Không tìm thấy file AuthContext trong src/");
  process.exit(1);
}

let replacedCount = 0;

for (const filePath of foundFiles) {
  let code = fs.readFileSync(filePath, "utf8");
  if (!regex.test(code)) continue;

  const hasProtectedPages = /PROTECTED_PAGES/.test(code);
  const hasRouterImport = /from\s+["']react-router-dom["']/.test(code);
  const hasFullRouterImport =
    /import\s*\{\s*[^}]*useNavigate[^}]*useLocation[^}]*\}\s*from\s*["']react-router-dom["']/.test(
      code
    );

  const newCodeBlock = buildNewAuthProvider(hasProtectedPages).trim();
  let newCode = code.replace(regex, newCodeBlock);

  if (!hasRouterImport) {
    newCode = `import { useNavigate, useLocation } from "react-router-dom";\n${newCode}`;
  } else if (hasRouterImport && !hasFullRouterImport) {
    newCode = newCode.replace(
      /(import\s*\{)([^}]*)(\}\s*from\s*["']react-router-dom["'])/,
      (match, p1, p2, p3) => {
        const existingHooks = p2.split(",").map((h) => h.trim());
        const missingHooks = ["useNavigate", "useLocation"].filter(
          (hook) => !existingHooks.includes(hook)
        );
        return `${p1} ${[...existingHooks, ...missingHooks].join(", ")} ${p3}`;
      }
    );
  }

  fs.writeFileSync(filePath, newCode, "utf8");
  replacedCount++;
  console.log(
    `✅ Updated: ${path.relative(
      projectRoot,
      filePath
    )} (PROTECTED_PAGES: ${hasProtectedPages})`
  );
}
