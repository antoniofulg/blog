FROM oven/bun:1 AS dev

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY drizzle/ ./drizzle/

CMD ["bun", "dev", "--port", "3000"]

FROM dev AS builder

COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/scripts/seed.ts ./scripts/seed.ts
COPY --from=builder /app/app/db ./app/db

EXPOSE 3000

# Entry path verified against Nitro bun preset output on 2026-05-05
CMD ["bun", ".output/server/index.mjs"]
