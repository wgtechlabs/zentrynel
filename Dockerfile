FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
RUN apk add --no-cache --upgrade libcrypto3 libssl3 fontconfig ttf-dejavu
COPY --from=install /app/node_modules ./node_modules
COPY src ./src
COPY package.json .
RUN mkdir -p data && chown -R bun:bun /app
USER bun

ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
