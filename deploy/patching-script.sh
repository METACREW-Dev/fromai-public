mkdir -p ./src/sdk ./src/auth-sdk ./public ./scripts
git clone https://github.com/METACREW-Dev/fromai-public.git fromai-public

# Common scripts
cp -R fromai-public/scripts/common scripts/common/
          
# App scripts
cp fromai-public/sdk/index.ts src/sdk/index.ts
cp fromai-public/auth-sdk/index.js src/auth-sdk/index.js
cp fromai-public/public/callback.js public/callback.js
cp fromai-public/public/callback.html public/callback.html
cp fromai-public/serve.json serve.json
cp fromai-public/scripts/replace-auth-handler.js scripts/replace-auth-handler.js
cp fromai-public/scripts/replace-login-handler.js scripts/replace-login-handler.js
cp fromai-public/scripts/replace-register-handler.js scripts/replace-register-handler.js
cp fromai-public/scripts/replace-app-handler.js scripts/replace-app-handler.js
cp fromai-public/scripts/append-meta.js scripts/append-meta.js
cp fromai-public/scripts/replace-image-cdn-handler.js scripts/replace-image-cdn-handler.js

# Dockerfile
cp fromai-public/deploy/fe/Dockerfile Dockerfile
cp fromai-public/deploy/serverless/Dockerfile serverlessDockerfile

# Import auth-sdk in main.jsx
sed -i '1i import "./auth-sdk/index";' src/main.jsx