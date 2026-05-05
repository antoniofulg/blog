FROM oven/bun:1 AS dev

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

CMD ["bun", "dev", "--port", "3000"]

FROM dev AS builder

COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.output ./.output

EXPOSE 3000

# Entry path verified against Nitro bun preset output on 2026-05-05
CMD ["bun", ".output/server/index.mjs"]
