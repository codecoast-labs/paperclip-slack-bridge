FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --production=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --production
COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S bridge && \
    adduser -S bridge -u 1001 -G bridge && \
    mkdir -p /data && chown bridge:bridge /data

USER bridge
CMD ["node", "dist/index.js"]
