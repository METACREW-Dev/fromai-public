# Stage 1: Build the React application
# Debian bookworm (glibc) like the old floating node:20: deno is a glibc binary and npm install
# may need build tools. Pinned by digest so a rebuild does not pick up a new Node major/patch.
FROM node:22.23.4-bookworm@sha256:18a6d90fd60542269850c80ca03b29b1d9b14d6b221ac7ee8e35b0d33ef904bd AS build

WORKDIR /app

COPY . .

RUN npm install && npm install -g deno
RUN deno --version

# Build the serverless function
RUN sh ./serverless-build.sh

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "serverless.ts"]