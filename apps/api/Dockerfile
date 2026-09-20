# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/dev-infra/package.json ./packages/dev-infra/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @campusflow/shared-types run build \
  && pnpm --filter @campusflow/database run build \
  && pnpm --filter @campusflow/api run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY apps/api/docker-entrypoint.sh /usr/local/bin/campusflow-entrypoint.sh
RUN chmod +x /usr/local/bin/campusflow-entrypoint.sh
ENTRYPOINT ["campusflow-entrypoint.sh"]
EXPOSE 3001
CMD ["node", "dist/main.js"]