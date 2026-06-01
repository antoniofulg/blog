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
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/scripts/seed.ts ./scripts/seed.ts
COPY --from=builder /app/scripts/sync.ts ./scripts/sync.ts
COPY --from=builder /app/app/content ./app/content
COPY --from=builder /app/app/db ./app/db
COPY --from=builder /app/app/lib ./app/lib
# public/ is also bundled into .output/public/ by Nitro for static serving, but
# resolveOgImagePath() probes process.cwd()/public/og/<locale>/<slug>.png at
# request time to decide between an auto-generated card and the site fallback.
# Copy public/ into the runner so that existence check sees the committed OG
# cards; without it every generated card resolves to the /og-image.jpg fallback.
COPY --from=builder /app/public ./public

EXPOSE 3000

# Entry path verified against Nitro bun preset output on 2026-05-05
CMD ["bun", ".output/server/index.mjs"]
