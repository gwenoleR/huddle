# ---- Build: UI (Vite/PWA) + server (esbuild) ----
# Runs once, on the build machine's own platform: the output is plain JavaScript, the same for
# every target. Only the final stage below is built per platform (amd64, arm64).
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Version ("1.2.0", "1.2.0-edge.abc1234"), passed by GitHub Actions: shown in the profile, compared for updates.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build && npm prune --omit=dev
# The runtime dependencies must stay pure JavaScript (SQLite is built into Node): a native
# module compiled here would not run on the other platform. Fail the build if one sneaks in.
RUN if find node_modules -name '*.node' | grep -q .; then echo 'Native module in runtime dependencies' >&2; exit 1; fi

# ---- Final image: Node + the bare minimum ----
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
