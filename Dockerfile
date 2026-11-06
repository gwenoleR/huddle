# ---- Build : interface (Vite/PWA) + serveur (esbuild) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Hash du commit, passé par GitHub Actions : affiché dans le profil pour vérifier les mises à jour.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build && npm prune --omit=dev

# ---- Image finale : Node + le strict nécessaire ----
FROM node:22-bookworm-slim
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    TZ=Europe/Paris \
    NODE_NO_WARNINGS=1
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.mjs"]
