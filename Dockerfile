# --- Stage 1: frontend build (needs devDependencies) ---
FROM node:20-alpine AS build-stage

WORKDIR /app

# better-sqlite3 has no musl prebuild, so it is compiled from source.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The commit this image was built from. `.git` is excluded from the build
# context (see .dockerignore), so it cannot be read here and is passed in
# instead. scripts/deploy.sh supplies it from origin/main; a plain
# `docker compose build` leaves it "local", which is the honest answer for an
# image built from someone's working tree.
ARG GIT_COMMIT=local

# Generate dynamic build version timestamp
RUN VERSION=$(node -e "import fs from 'fs'; console.log(JSON.parse(fs.readFileSync('./package.json', 'utf8')).version);") && DATE=$(date +'%Y.%m.%d') && echo "export const APP_VERSION = 'v$VERSION ($DATE $GIT_COMMIT)';" > src/version.ts

RUN npm run build

# --- Stage 2: runtime dependencies, compiled here rather than in the image
# that ships. Installing them in the final stage meant python3/make/g++ had to
# ship too, for a toolchain nothing uses once better-sqlite3 is built. ---
FROM node:20-alpine AS prod-deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 3: the image that runs ---
FROM node:20-alpine

# Re-declared because an ARG does not cross stage boundaries. Recorded as a
# label so the running container can be traced back to a commit without
# reading the UI: docker inspect -f '{{index .Config.Labels
# "org.opencontainers.image.revision"}}' lunchpad-container
ARG GIT_COMMIT=local
LABEL org.opencontainers.image.revision="$GIT_COMMIT"
LABEL org.opencontainers.image.source="https://github.com/ssndip/LunchPad"

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

# Built frontend and modular server files.
# `src/types` comes too: server/broadcast.ts, settingsController.ts and
# parserController.ts all import from it. Those imports are type-only, so
# esbuild erases them and the image happened to run without the directory —
# but the first value imported from one of those files would crash the
# container at startup while dev and tests stayed green.
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/server.ts ./
COPY --from=build-stage /app/server ./server
COPY --from=build-stage /app/src/types.ts ./src/types.ts
COPY --from=build-stage /app/src/types ./src/types
# The packaging-fee rule is shared with the kiosk so the price quoted and the
# price charged cannot drift apart. orderService imports it as a value, so
# unlike src/types it genuinely has to be here.
COPY --from=build-stage /app/src/utils/packagingFee.ts ./src/utils/packagingFee.ts

# Test files travel with server/, and pull in vitest, which is not installed
# here. Nothing imports them at runtime; they are dropped so the image holds
# only what it actually runs.
RUN find ./server -name '*.test.ts' -delete

# The database directory. Owned by `node` because the process drops to that
# user below; when a host directory is bind-mounted here it carries its own
# ownership, so it has to be uid 1000 on the host too.
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3400

# Fail the container health check if the server stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3400)+'/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Anything the server does — a path traversal, a dependency flaw — happens as
# an unprivileged user rather than root.
USER node

CMD ["npm", "start"]
