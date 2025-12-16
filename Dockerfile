# Stage 1: Build the React application
FROM metacrew2023.azurecr.io/base/node:20-alpine AS build

WORKDIR /app

COPY package*.json .
RUN npm install && npm install -g serve

COPY . .

RUN sh ./scripts/common/run.sh

RUN node scripts/replace-auth-handler.js && \
    node scripts/replace-login-handler.js && \
    node scripts/replace-app-handler.js

RUN node scripts/append-meta.js \
    --api="https://console-planb-api.leveragehero.net/base44-tools/sync-meta-tags" \
    --url="${{ env.BASE44_URL }}" \
    --project_key="${{ env.PROJECT_KEY }}" \
    --environment='${{ env.ENV == 'prod' && 'production' || 'development' }}'

RUN node scripts/replace-image-cdn-handler.js \
    --api="https://console-planb-api.leveragehero.net/base44-tools/sync-file" \
    --project_key="${{ env.PROJECT_KEY }}" \
    --environment='${{ env.ENV == 'prod' && 'production' || 'development' }}'

RUN npm run build

EXPOSE 3000

CMD ["serve", "-s", "dist"]
