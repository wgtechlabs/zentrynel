# syntax=docker/dockerfile:1

ARG NODE_VERSION=26-alpine3.22
ARG BUN_VERSION=1.3.14

FROM node:${NODE_VERSION} AS base
RUN apk update && apk upgrade --no-cache \
	&& apk add --no-cache dumb-init fontconfig ttf-dejavu su-exec \
	&& rm -rf /var/cache/apk/*
WORKDIR /usr/src/app

FROM oven/bun:${BUN_VERSION}-alpine AS bun

FROM base AS builder-base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apk add --no-cache python3 make g++ \
	&& bun --version

FROM builder-base AS deps
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

FROM builder-base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS final
ENV NODE_ENV=production \
	NODE_OPTIONS="--enable-source-maps --max-old-space-size=512" \
	HOME=/tmp

RUN addgroup -g 1001 -S nodejs \
	&& adduser -S nodejs -u 1001 -G nodejs -s /sbin/nologin
COPY --from=deps --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --chown=nodejs:nodejs package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["dumb-init", "--"]
CMD ["/usr/local/bin/docker-entrypoint.sh", "node", "dist/index.js"]
