FROM node:24.21.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY server/app.js server/index.js server/shutdown.js ./server/
USER node

# Cloud Run injects PORT; the application retains 3001 as its local fallback.
# Direct Node execution receives the platform's SIGTERM without an npm wrapper.
CMD ["node", "server/index.js"]
