# syntax=docker/dockerfile:1

#Stage 1: build the Vue client. web_ui/vite.config.mjs writes to ../server/web_ui.
FROM node:22-bookworm-slim AS web_build
WORKDIR /src/web_ui
COPY web_ui/package.json web_ui/package-lock.json ./
RUN npm ci
COPY web_ui/ ./
RUN npm run build

#Stage 2: the API plus both built clients. WORKDIR /app is server/, so app.js resolves
#web_ui and web there. The shared catalog sits at /catalog because
#server/config/catalog/index.js climbs three levels from config/catalog.
FROM node:22-bookworm-slim AS server
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
#The committed build is replaced by the one from stage 1.
COPY --from=web_build /src/server/web_ui ./web_ui
COPY catalog/ /catalog

EXPOSE 3000
CMD ["node", "app.js"]
