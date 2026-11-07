FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/judge/package.json apps/judge/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
RUN node scripts/copy-monaco.mjs
FROM base AS web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
USER node
CMD ["pnpm","--filter","@fairround/web","start"]
FROM base AS api
CMD ["sh","-c","pnpm db:migrate && pnpm seed && pnpm --filter @fairround/api start"]
FROM base AS judge
CMD ["pnpm","--filter","@fairround/judge","start"]
