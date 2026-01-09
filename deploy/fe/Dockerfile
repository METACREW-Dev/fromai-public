# Stage 1: Build the React application
FROM metacrew2023.azurecr.io/base/node:20-alpine AS build

WORKDIR /app

COPY package*.json .

# If exists, scripts/firebase-sdk/append-service-notification.js then run it
RUN if [ -f "scripts/firebase-sdk/append-service-notification.js" ]; then \
        node scripts/firebase-sdk/append-service-notification.js; \
    fi

RUN npm install && npm install -g serve

COPY . .

RUN sh ./scripts/common/run.sh

RUN node scripts/replace-auth-handler.js && \
    node scripts/replace-login-handler.js && \
    node scripts/replace-app-handler.js

RUN node scripts/append-meta.js \
    --api="https://console-planb-api.leveragehero.net/base44-tools/sync-meta-tags" \
    --url="{BASE44_URL}" \
    --project_key="{PROJECT_KEY}" \
    --environment='{ENVIRONMENT}'

RUN node scripts/replace-image-cdn-handler.js \
    --api="https://console-planb-api.leveragehero.net/base44-tools/sync-file" \
    --project_key="{PROJECT_KEY}" \
    --environment='{ENVIRONMENT}'

RUN npm run build

EXPOSE 3000

CMD ["serve", "-s", "dist"]
