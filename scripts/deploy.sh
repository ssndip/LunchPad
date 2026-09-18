#!/usr/bin/env bash
#
# Deploy origin/main to the container.
#
# The image is built from a clean export of the remote branch, never from the
# working tree. Before this existed, `docker compose up -d --build` shipped
# whatever happened to be checked out — an unfinished edit, a stale branch, a
# stash applied and forgotten — and nothing recorded which commit was running,
# so "is production on main?" could only be answered by guessing.
#
# The commit is stamped into the version badge and into an image label, and the
# container is health-checked after it starts. A container that does not come
# back healthy is rolled back to the previous image.
#
# Usage:
#   scripts/deploy.sh              deploy origin/main
#   scripts/deploy.sh --dry-run    show what would be deployed, build nothing
#
set -euo pipefail

REMOTE=origin
BRANCH=main
IMAGE=lunchpadgit-lunchpad
CONTAINER=lunchpad-container
HEALTH_URL=http://127.0.0.1:3400/ping
HEALTH_TIMEOUT=90

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_DIR"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m  x %s\033[0m\n' "$*" >&2; exit 1; }

# --- What are we deploying -------------------------------------------------

say "Fetching $REMOTE/$BRANCH"
git fetch --quiet "$REMOTE" "$BRANCH" || die "could not fetch $REMOTE/$BRANCH"

SHA_FULL=$(git rev-parse "$REMOTE/$BRANCH")
SHA=$(git rev-parse --short "$REMOTE/$BRANCH")
SUBJECT=$(git log -1 --format=%s "$REMOTE/$BRANCH")

echo "  $SHA  $SUBJECT"

# The deploy does not depend on local state, but a surprise is worth naming:
# if the working tree is dirty or sitting on other commits, what you see in
# your editor is not what is about to ship.
if [ -n "$(git status --porcelain)" ]; then
  warn "working tree has uncommitted changes — they will NOT be deployed"
fi
if [ "$(git rev-parse HEAD)" != "$SHA_FULL" ]; then
  warn "local HEAD ($(git rev-parse --short HEAD)) differs from $REMOTE/$BRANCH ($SHA)"
fi

RUNNING=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$CONTAINER" 2>/dev/null || echo "")
if [ -n "$RUNNING" ]; then
  echo "  currently running: $RUNNING"
  [ "$RUNNING" = "$SHA" ] && warn "already running $SHA — redeploying anyway"
fi

if [ "$DRY_RUN" = "1" ]; then
  say "Dry run — nothing built, nothing restarted"
  exit 0
fi

# --- Build from the remote branch, not the working tree --------------------

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

say "Exporting $REMOTE/$BRANCH to a clean build context"
git archive "$REMOTE/$BRANCH" | tar -x -C "$TMP"
[ -f "$TMP/Dockerfile" ] || die "export produced no Dockerfile — is $REMOTE/$BRANCH intact?"

# Keep the outgoing image so a failed deploy has something to fall back to.
ROLLBACK=0
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
  ROLLBACK=1
fi

say "Building $IMAGE:$SHA"
docker build \
  --build-arg "GIT_COMMIT=$SHA" \
  -t "$IMAGE:$SHA" \
  -t "$IMAGE:latest" \
  "$TMP" || die "build failed — container left untouched"

# --- Start it and make sure it actually came up ----------------------------

say "Restarting $CONTAINER"
# --no-build: run the image built above from the remote export, rather than
# letting Compose rebuild it from the working tree.
docker compose up -d --no-build

say "Waiting for health (up to ${HEALTH_TIMEOUT}s)"
healthy=0
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  state=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
  if [ "$state" = "healthy" ] && curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  [ "$state" = "missing" ] && break
  sleep 1
done

if [ "$healthy" != "1" ]; then
  warn "container did not become healthy"
  docker logs --tail 30 "$CONTAINER" 2>&1 || true
  if [ "$ROLLBACK" = "1" ]; then
    say "Rolling back to the previous image"
    docker tag "$IMAGE:previous" "$IMAGE:latest"
    docker compose up -d --no-build
    die "deploy failed and was rolled back — $SHA is NOT running"
  fi
  die "deploy failed and there was no previous image to roll back to"
fi

# The image can be right and the container still be stale, if Compose reused a
# running one. Confirm the thing actually serving is the thing just built.
SERVING=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$CONTAINER" 2>/dev/null || echo "")
[ "$SERVING" = "$SHA" ] || die "container reports '$SERVING' but '$SHA' was built — deploy did not take"

say "Deployed $SHA — $SUBJECT"
echo "  the version badge in the app now ends in $SHA"
echo "  verify: docker inspect -f '{{index .Config.Labels \"org.opencontainers.image.revision\"}}' $CONTAINER"
