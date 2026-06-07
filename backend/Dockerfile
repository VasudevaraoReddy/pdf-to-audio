# Backend container for Google Cloud Run.
# ffmpeg-static downloads its Linux binary during `npm ci`, so no system ffmpeg
# install is needed.
FROM node:20-slim

WORKDIR /app

# Install deps (including dev deps so we can compile TypeScript).
COPY package*.json ./
RUN npm ci

# Build TS -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime config. Cloud Run injects PORT (8080); the app reads process.env.PORT.
# Storage is ephemeral on Cloud Run, so write under /tmp.
ENV NODE_ENV=production
ENV STORAGE_DIR=/tmp/storage

CMD ["node", "dist/index.js"]
