#!/usr/bin/env bash
#
# up.sh — one-shot production deploy for Super Social Downloader (SSD)
# Target: a fresh Ubuntu 22.04/24.04 (or Debian 12) VPS.
#
# It installs Node, yt-dlp, ffmpeg, Nginx + SSL, writes .env, builds the app,
# and runs it as a hardened systemd service behind Nginx.
#
# Usage (from the project directory, as a sudo-capable user):
#     sudo DOMAIN=yourdomain.com LE_EMAIL=you@mail.com bash up.sh
#
#   DOMAIN   optional — defaults to snapvidly.com (DNS A record must point here).
#            Override with DOMAIN=other.com, or set DOMAIN= to serve over the IP.
#   LE_EMAIL optional — email for Let's Encrypt (default admin@snapvidly.com).
#   APP_PORT optional — internal port Next.js listens on (default 3000).
#
# Re-running is safe (idempotent). Your ad keys in .env are never overwritten.

set -euo pipefail

# ── Configuration (override via env) ─────────────────────────────────
APP_PORT="${APP_PORT:-3000}"
# Defaults to your SnapVidly domain — override with DOMAIN=other.com if needed.
DOMAIN="${DOMAIN:-snapvidly.com}"
LE_EMAIL="${LE_EMAIL:-admin@snapvidly.com}"
NODE_MAJOR="${NODE_MAJOR:-20}"
RUN_USER="${RUN_USER:-${SUDO_USER:-$USER}}"
SERVICE="snapvidly"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Pretty logging ───────────────────────────────────────────────────
c_g="\033[0;32m"; c_y="\033[0;33m"; c_r="\033[0;31m"; c_b="\033[0;34m"; c_0="\033[0m"
log()  { echo -e "${c_g}▸${c_0} $*"; }
info() { echo -e "${c_b}·${c_0} $*"; }
warn() { echo -e "${c_y}!${c_0} $*"; }
die()  { echo -e "${c_r}✖ $*${c_0}" >&2; exit 1; }
step() { echo -e "\n${c_b}══ $* ══${c_0}"; }

# ── Preflight ────────────────────────────────────────────────────────
step "Preflight checks"
[ "$(id -u)" -eq 0 ] || die "Run with sudo:  sudo bash up.sh"
command -v apt-get >/dev/null || die "This script targets Debian/Ubuntu (apt-get not found)."
[ -f "$APP_DIR/package.json" ] || die "package.json not found in $APP_DIR. Run this from the project directory."
[ "$RUN_USER" != "root" ] || warn "Running the app as root is not recommended. Set RUN_USER=youruser."
id "$RUN_USER" >/dev/null 2>&1 || die "User '$RUN_USER' does not exist."
log "App dir:  $APP_DIR"
log "Run user: $RUN_USER"
log "Domain:   ${DOMAIN:-<none, will use server IP over HTTP>}"

export DEBIAN_FRONTEND=noninteractive

# ── Swap (helps builds on 1 GB VPS) ──────────────────────────────────
step "Memory / swap"
mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$mem_mb" -lt 2048 ] && ! swapon --show | grep -q .; then
  info "Only ${mem_mb} MB RAM and no swap — creating a 2 GB swapfile for the build."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "2 GB swap enabled."
else
  info "Sufficient memory or swap already present."
fi

# ── System packages ──────────────────────────────────────────────────
step "System packages"
apt-get update -qq
apt-get install -y -qq curl ca-certificates git ufw nginx ffmpeg python3 >/dev/null
log "Installed: git, nginx, ffmpeg, ufw, curl."

# ── Node.js ──────────────────────────────────────────────────────────
step "Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null || [ "$(node -v | grep -oE '[0-9]+' | head -1)" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
log "Node $(node -v), npm $(npm -v)."

# ── yt-dlp + ffmpeg paths ────────────────────────────────────────────
step "yt-dlp (extraction engine)"
curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
YTDLP_BIN="/usr/local/bin/yt-dlp"
FFMPEG_BIN="$(command -v ffmpeg)"
log "yt-dlp $("$YTDLP_BIN" --version) at $YTDLP_BIN"
log "ffmpeg at $FFMPEG_BIN"

# A daily auto-update so YouTube extraction keeps working.
cat >/etc/cron.daily/snapvidly-ytdlp-update <<'CRON'
#!/bin/sh
/usr/local/bin/yt-dlp -U >/dev/null 2>&1 || true
CRON
chmod +x /etc/cron.daily/snapvidly-ytdlp-update
info "Daily yt-dlp auto-update installed."

# ── .env (preserves your existing values / ad keys) ──────────────────
step "Environment (.env)"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$APP_DIR/.env.example" ]; then cp "$APP_DIR/.env.example" "$ENV_FILE"; else : > "$ENV_FILE"; fi
  info "Created .env from template."
else
  info "Existing .env found — keeping your values (incl. ad keys)."
fi

set_env() {  # set_env KEY VALUE  — update in place or append; never duplicates.
  local k="$1" v="$2"
  if grep -qE "^${k}=" "$ENV_FILE"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}

set_env_default() {  # only add if absent — never clobbers a value you already set (secrets/keys).
  local k="$1" v="$2"
  grep -qE "^${k}=" "$ENV_FILE" || echo "${k}=${v}" >> "$ENV_FILE"
}

if [ -n "$DOMAIN" ]; then SITE_URL="https://${DOMAIN}"; else
  SERVER_IP="$(curl -fsS4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  SITE_URL="http://${SERVER_IP}"
fi
set_env NEXT_PUBLIC_SITE_URL "$SITE_URL"
set_env YTDLP_PATH "$YTDLP_BIN"
set_env FFMPEG_PATH "$FFMPEG_BIN"
set_env ENGINE_URL ""            # empty → use local yt-dlp on this box
# AI tools (video-to-text / video-summary). FREE keys — leave blank to show
# "coming soon"; the features stay $0. Get keys: console.groq.com, aistudio.google.com.
# set_env_default never overwrites a key you've already pasted in.
set_env_default GROQ_API_KEY ""          # free — transcription (Whisper) + summaries
set_env_default GEMINI_API_KEY ""        # free — summary fallback when Groq is rate-limited
set_env_default GROQ_MODEL "llama-3.3-70b-versatile"
set_env_default GROQ_WHISPER_MODEL "whisper-large-v3"
set_env_default GEMINI_MODEL "gemini-2.5-flash"
set_env_default AI_MAX_DURATION_SEC "1800"   # 30-min cap keeps AI tools lifetime-free
# Ads: master switch (true=on). Individual networks stay off until you paste their
# keys below (after the site is live and the network approves your domain).
set_env_default NEXT_PUBLIC_ADS_ENABLED "true"
set_env_default NEXT_PUBLIC_CONSENT_REQUIRED "false"  # set true to show an EU cookie/consent banner
set_env_default AI_MAX_CONCURRENT "2"        # simultaneous transcriptions on this box
set_env_default AI_RATE_LIMIT_PER_MIN "6"    # stricter per-IP limit for the AI endpoints
chown "$RUN_USER":"$RUN_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
log "Site URL: $SITE_URL   (edit ad keys anytime in $ENV_FILE, then re-run this script)"

# ── Install deps + build (as the run user, with .env present) ────────
step "Install dependencies & build"
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"
if [ -f "$APP_DIR/package-lock.json" ]; then INSTALL="npm ci"; else INSTALL="npm install"; fi
sudo -u "$RUN_USER" bash -lc "cd '$APP_DIR' && $INSTALL"

# Video converter needs the ffmpeg.wasm core self-hosted in public/ffmpeg.
# It's git-ignored and copied from @ffmpeg/core on install (postinstall); run it
# explicitly here too so the converter always works, even if scripts were skipped.
sudo -u "$RUN_USER" bash -lc "cd '$APP_DIR' && node scripts/copy-ffmpeg.mjs" || warn "ffmpeg core copy skipped (converter needs it)."
# Regenerate PWA PNG icons from the brand SVG (committed PNGs are used if this skips).
sudo -u "$RUN_USER" bash -lc "cd '$APP_DIR' && node scripts/gen-icons.mjs" || warn "PWA icon generation skipped (committed PNGs will be used)."
if [ -f "$APP_DIR/public/ffmpeg/ffmpeg-core.wasm" ]; then
  info "ffmpeg.wasm core present ($(du -h "$APP_DIR/public/ffmpeg/ffmpeg-core.wasm" | cut -f1)) — converter ready."
else
  warn "ffmpeg core missing — video converter pages will load but conversion won't run until 'node scripts/copy-ffmpeg.mjs' succeeds."
fi

sudo -u "$RUN_USER" bash -lc "cd '$APP_DIR' && npm run build"
log "Production build complete."

# ── systemd service (hardened) ───────────────────────────────────────
step "systemd service"
NPM_BIN="$(command -v npm)"
cat >/etc/systemd/system/${SERVICE}.service <<UNIT
[Unit]
Description=SnapVidly
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${NPM_BIN} run start
Restart=always
RestartSec=5
StartLimitIntervalSec=0
LimitNOFILE=65535
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "${SERVICE}" >/dev/null 2>&1 || true
systemctl restart "${SERVICE}"
sleep 2
systemctl is-active --quiet "${SERVICE}" && log "Service '${SERVICE}' is running on 127.0.0.1:${APP_PORT}." \
  || die "Service failed to start. Check:  journalctl -u ${SERVICE} -n 50"

# ── Nginx reverse proxy (tuned for streaming downloads) ──────────────
step "Nginx reverse proxy"
SERVER_NAME="${DOMAIN:-_}"
[ -n "$DOMAIN" ] && SERVER_NAME="${DOMAIN} www.${DOMAIN}"
cat >/etc/nginx/sites-available/${SERVICE} <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    client_max_body_size 20m;
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript application/xml application/rss+xml application/manifest+json image/svg+xml font/woff2;

    # Immutable build assets — cache for a year (hashed filenames make this safe).
    # Huge repeat-visit speedup; served straight from Nginx's proxy cache path.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # App (static pages + light API)
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Streaming downloads: no buffering, long timeouts for big HD files.
    location /api/download {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/${SERVICE} /etc/nginx/sites-enabled/${SERVICE}
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx && log "Nginx configured for '${SERVER_NAME}'." \
  || die "Nginx config test failed. Run: nginx -t"

# ── SSL (Let's Encrypt) ──────────────────────────────────────────────
step "HTTPS / SSL"
if [ -n "$DOMAIN" ]; then
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  CB_ARGS=(--nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --redirect)
  if [ -n "$LE_EMAIL" ]; then CB_ARGS+=(-m "$LE_EMAIL"); else CB_ARGS+=(--register-unsafely-without-email); fi
  if certbot "${CB_ARGS[@]}"; then
    log "SSL enabled — https://${DOMAIN}"
  else
    warn "Certbot failed (is DNS for ${DOMAIN} pointing at this server yet?). Site works on HTTP; re-run later:"
    warn "   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
else
  warn "No DOMAIN set — skipping SSL. Set DOMAIN=yourdomain.com and re-run to enable HTTPS."
fi

# ── Firewall ─────────────────────────────────────────────────────────
step "Firewall (ufw)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
log "Firewall active: SSH + HTTP/HTTPS allowed."

# ── Done ─────────────────────────────────────────────────────────────
step "Done 🎉"
echo -e "  Site:      ${c_g}${SITE_URL}${c_0}"
echo -e "  Service:   systemctl status ${SERVICE}"
echo -e "  Logs:      journalctl -u ${SERVICE} -f"
echo -e "  Env file:  ${APP_DIR}/.env   ${c_y}(add your ad keys, then re-run: sudo bash up.sh)${c_0}"
echo -e "  Update app: git pull && sudo bash up.sh\n"
