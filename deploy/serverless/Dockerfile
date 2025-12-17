# Stage 1: Build the React application
FROM node:20 AS build

WORKDIR /app

COPY . .

RUN npm install && npm install -g deno
RUN deno --version

# Build the serverless function
RUN sh ./serverless-build.sh

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "serverless.ts"]