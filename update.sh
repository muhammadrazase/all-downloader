#!/usr/bin/env bash
#
# update.sh — one-command redeploy for an already-provisioned VPS.
# Pulls the latest code, rebuilds, and restarts the service.
#
#   bash update.sh
#
# (First-time setup / full provisioning is up.sh, not this.)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

g="\033[0;32m"; y="\033[0;33m"; z="\033[0m"
log() { echo -e "${g}▸${z} $*"; }

SERVICE="snapvidly"

log "Pulling latest code…"
if git rev-parse --git-dir >/dev/null 2>&1; then
  git pull --ff-only || echo -e "${y}!${z} git pull skipped (local changes or no remote)"
else
  echo -e "${y}!${z} Not a git repo — skipping pull (deploy your files manually)."
fi

log "Installing dependencies…"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

log "Ensuring ffmpeg.wasm core (video converter)…"
node scripts/copy-ffmpeg.mjs || true

log "Building…"
npm run build

log "Restarting service…"
if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE}.service"; then
  sudo systemctl restart "${SERVICE}"
  sleep 2
  sudo systemctl is-active --quiet "${SERVICE}" \
    && log "Done ✅  ${SERVICE} is running." \
    || { echo "Service failed — check: journalctl -u ${SERVICE} -n 50"; exit 1; }
else
  echo -e "${y}!${z} systemd service '${SERVICE}' not found. Start manually with: npm run start"
fi

echo -e "\nLogs:  journalctl -u ${SERVICE} -f\n"
