# syntax=docker/dockerfile:1

# Production image: build with tsdown, ship only dist/ + production dependencies.
#   docker build -t fastify-api-template .
#   docker run --env-file .env -p 3333:3333 fastify-api-template
# Migrations (Postgres) run as a separate step with the SAME image:
#   docker run --rm --env-file .env fastify-api-template node dist/migrate.js
# Development happens in the devcontainer (.devcontainer/), not here.

FROM node:24-slim AS base
WORKDIR /app
# pnpm at the exact version pinned in package.json ("packageManager")
COPY package.json ./
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" \
  && npm cache clean --force
# the store lives outside the image layers that matter (BuildKit cache mount)
ENV PNPM_HOME=/pnpm
RUN pnpm config set store-dir /pnpm/store

# all dependencies + the build
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN pnpm build

# production dependencies only
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3333
# no curl in the slim image: use Node itself
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/index.js"]
