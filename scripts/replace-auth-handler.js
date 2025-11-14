#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

const targetDir = path.join(projectRoot, "src/lib");
const targetFile = path.join(targetDir, "AuthContext.jsx");

const regex =
  /export\s+const\s+AuthProvider\s*=\s*\(\{\s*children\s*\}\)\s*=>\s*\{[\s\S]*?\n\};/m;

// New AuthProvider code block to inject
function buildNewAuthProvider() {
  return `export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setAuthError(null);
      
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          return;
        }
        await checkUserAuth();
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
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
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      if (currentUser?.user_email) {
        localStorage.setItem('auth_user_email', currentUser?.user_email);
      }
      if (currentUser?.id) {
        localStorage.setItem('auth_user_id', currentUser?.id);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('access_token');
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

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
      checkAppState,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
`;
}

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

// Ensure AuthProvider block exists before replacing
if (!regex.test(code)) {
  console.error("⚠️ No AuthProvider block found — skipping update.");
  process.exit(0);
}

// Replace the AuthProvider implementation
const newCode = code.replace(regex, buildNewAuthProvider().trim());

// Write the updated file
fs.writeFileSync(targetFile, newCode, "utf8");

// Success log
console.log(
  `✅ Updated AuthProvider in ${path.relative(projectRoot, targetFile)}`
);
