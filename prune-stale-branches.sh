#!/usr/bin/env bash
# Deletes the 188 verified-stale bot branches from origin, 50 at a time.
# Recovery SHAs are in stale-branch-recovery.txt.
set -euo pipefail
cd "$(dirname "$0")"
grep "^[0-9a-f]" stale-branch-recovery.txt | awk "{print \$2}" | xargs -n 50 git push origin --delete
