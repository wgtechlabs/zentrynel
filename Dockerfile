FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
RUN apk add --no-cache fontconfig ttf-dejavu

RUN addgroup -S zentrynel && adduser -S zentrynel -G zentrynel

COPY --from=install /app/node_modules ./node_modules
COPY src ./src
COPY package.json .
RUN mkdir -p data && chown zentrynel:zentrynel data

USER zentrynel

ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
