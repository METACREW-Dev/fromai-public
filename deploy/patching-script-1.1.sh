#!/bin/bash

# Parse named parameters
for arg in "$@"; do
    case $arg in
        BASE44_URL=*)
            BASE44_URL="${arg#*=}"
            ;;
        PROJECT_KEY=*)
            PROJECT_KEY="${arg#*=}"
            ;;
        ENVIRONMENT=*)
            ENVIRONMENT="${arg#*=}"
            ;;
        API_URL=*)
            API_URL="${arg#*=}"
            ;;
    esac
done

# Check required parameters
if [ -z "$BASE44_URL" ] || [ -z "$PROJECT_KEY" ] || [ -z "$ENVIRONMENT" ] || [ -z "$API_URL" ]; then
    echo "Usage: $0 BASE44_URL=<url> PROJECT_KEY=<key> ENVIRONMENT=<env> API_URL=<url>"
    echo "  BASE44_URL: Base44 API URL"
    echo "  PROJECT_KEY: Project key identifier"
    echo "  ENVIRONMENT: production or development"
    echo "  API_URL: API URL"
    exit 1
fi

mkdir -p ./src/sdk ./src/auth-sdk ./public ./scripts

# Clone or pull fromai-public
if [ -d "fromai-public" ]; then
    cd fromai-public && git pull && cd ..
else
    git clone https://github.com/METACREW-Dev/fromai-public.git fromai-public
fi

# Common scripts
cp -Rf fromai-public/scripts/common scripts/common/
          
# App scripts
cp -f fromai-public/sdk/index.ts src/sdk/index.ts
cp -f fromai-public/auth-sdk/index.js src/auth-sdk/index.js
cp -f fromai-public/public/callback.js public/callback.js
cp -f fromai-public/public/callback.html public/callback.html
cp -f fromai-public/serve.json serve.json
cp -f fromai-public/scripts/replace-auth-handler.js scripts/replace-auth-handler.js
cp -f fromai-public/scripts/replace-login-handler.js scripts/replace-login-handler.js
cp -f fromai-public/scripts/replace-register-handler.js scripts/replace-register-handler.js
cp -f fromai-public/scripts/replace-app-handler.js scripts/replace-app-handler.js
cp -f fromai-public/scripts/append-meta.js scripts/append-meta.js
cp -f fromai-public/scripts/replace-image-cdn-handler.js scripts/replace-image-cdn-handler.js

if [ "$PROJECT_KEY" == "695c9dcd9cd53588b2997ab5" ]; then
    mkdir -p scripts/firebase-sdk
    cp -r fromai-public/scripts/vibex-first-contact/. scripts/firebase-sdk/
fi

# Patching Dockerfile
cp -f fromai-public/deploy/fe/Dockerfile Dockerfile

# Replace base44Client.js file
cp -f fromai-public/deploy/fe/src/api/base44Client.js src/api/base44Client.js

# Serverless patching
cp -f fromai-public/deploy/serverless/Dockerfile serverlessDockerfile
cp -f fromai-public/deploy/serverless/serverless-build.sh serverless-build.sh
cp -f fromai-public/deploy/serverless/function-sdk.ts src/sdk/function-sdk.ts

# Detect OS for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Replace Dockerfile
    sed -i '' "s|{BASE44_URL}|${BASE44_URL}|g" Dockerfile
    sed -i '' "s|{PROJECT_KEY}|${PROJECT_KEY}|g" Dockerfile
    sed -i '' "s|{ENVIRONMENT}|${ENVIRONMENT}|g" Dockerfile

    # Replace API URL in base44Client.js file
    sed -i '' "s|{API_URL}|${API_URL}|g" src/api/base44Client.js

    # Import auth-sdk in main.jsx (if not already imported)
    if ! grep -q 'import "./auth-sdk/index"' src/main.jsx; then
        sed -i '' '1i\
import "./auth-sdk/index";
' src/main.jsx
    fi
else
    # Replace Dockerfile
    sed -i "s|{BASE44_URL}|${BASE44_URL}|g" Dockerfile
    sed -i "s|{PROJECT_KEY}|${PROJECT_KEY}|g" Dockerfile
    sed -i "s|{ENVIRONMENT}|${ENVIRONMENT}|g" Dockerfile

    # Replace API URL in base44Client.js file
    sed -i "s|{API_URL}|${API_URL}|g" src/api/base44Client.js   

    # Import auth-sdk in main.jsx (if not already imported)
    if ! grep -q 'import "./auth-sdk/index"' src/main.jsx; then
        sed -i '1i import "./auth-sdk/index";' src/main.jsx
    fi
fi

# Remove fromai-public
rm -rf fromai-public