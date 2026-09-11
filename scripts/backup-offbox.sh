#!/usr/bin/env bash
#
# Copy LunchPad's database snapshots off the disk they were written to.
#
# The container writes a consistent online snapshot to data/backups/ once a day
# and keeps the latest 7. Those live on the same filesystem as the live
# database, so a single disk failure takes the balances, the order history and
# every backup of them at once. This job moves a copy elsewhere and keeps a
# longer tail.
#
# Run daily from cron. Exits non-zero — and says why — if the newest snapshot
# is missing, stale or corrupt, so a silently dead backup timer is noticed.
#
# Configure by exporting these, or by editing the defaults:
#   DEST    directory on a different physical device
#   REMOTE  optional rsync target ("user@host:/path"); skipped when empty
set -euo pipefail

REPO="${LUNCHPAD_REPO:-/home/ssndip/lunchpadgit}"
SRC="$REPO/data/backups"
DEST="${LUNCHPAD_BACKUP_DEST:-/mnt/SteamLibrary/lunchpad-backups}"
# Set once key auth to the host works: LUNCHPAD_BACKUP_REMOTE=user@host:/srv/lunchpad
REMOTE="${LUNCHPAD_BACKUP_REMOTE:-}"
KEEP="${LUNCHPAD_BACKUP_KEEP:-30}"
# A snapshot older than this means the container's backup timer is not running.
MAX_AGE_HOURS="${LUNCHPAD_BACKUP_MAX_AGE_HOURS:-26}"
LOG="${LUNCHPAD_BACKUP_LOG:-$DEST/backup.log}"

log() { echo "[$(date -Is)] $*"; }

main() {
  [ -d "$SRC" ] || { log "FAIL: source directory missing: $SRC"; return 1; }
  mkdir -p "$DEST"

  local newest
  newest=$(ls -1t "$SRC"/lunchpad_*.db 2>/dev/null | head -1 || true)
  [ -n "$newest" ] || { log "FAIL: no snapshot in $SRC — is the container running?"; return 1; }

  local age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
  if [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
    log "FAIL: newest snapshot is ${age_h}h old (limit ${MAX_AGE_HOURS}h): $(basename "$newest")"
    return 1
  fi

  # A backup that cannot be opened is not a backup. Verified before it is
  # copied, so a corrupt snapshot never displaces a good one off-box.
  # A truncated or overwritten file fails at open, not at integrity_check, and
  # an uncaught SqliteError would spill a stack trace into the log a human
  # reads. Report the reason on one line instead.
  if ! node -e '
      try {
        const db=new(require(process.argv[2]+"/node_modules/better-sqlite3"))(process.argv[1],{readonly:true});
        const ok=db.pragma("integrity_check",{simple:true});
        const cards=db.prepare("SELECT COUNT(*) c FROM cards").get().c;
        const orders=db.prepare("SELECT COUNT(*) c FROM orders").get().c;
        db.close();
        if(ok!=="ok"){console.error("  integrity_check: "+ok);process.exit(1);}
        console.log(`  verified: integrity ok, ${cards} cards, ${orders} orders`);
      } catch (e) {
        console.error("  unreadable: "+e.message);
        process.exit(1);
      }
    ' "$newest" "$REPO"; then
    log "FAIL: integrity check failed on $(basename "$newest")"
    return 1
  fi

  cp -p "$newest" "$DEST/$(basename "$newest")"
  log "copied $(basename "$newest") -> $DEST"

  if [ -n "$REMOTE" ]; then
    if rsync -a --timeout=120 "$newest" "$REMOTE/"; then
      log "pushed $(basename "$newest") -> $REMOTE"
    else
      log "WARN: rsync to $REMOTE failed; local off-box copy still succeeded"
    fi
  fi

  # Prune the off-box tail, newest first.
  local n=0
  while IFS= read -r f; do
    n=$((n+1))
    [ "$n" -gt "$KEEP" ] && { rm -f "$f"; log "pruned $(basename "$f")"; }
  done < <(ls -1t "$DEST"/lunchpad_*.db 2>/dev/null || true)

  log "OK: $(ls -1 "$DEST"/lunchpad_*.db 2>/dev/null | wc -l) snapshots held at $DEST"
}

mkdir -p "$DEST" 2>/dev/null || true
if main 2>&1 | tee -a "$LOG"; then exit 0; else exit 1; fi
