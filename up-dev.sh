#!/usr/bin/env bash
#
# setup-macos-m2.sh — local macOS setup for SnapVidly / Next.js downloader
# Target: Apple Silicon Macs (M1/M2/M3/M4), including MacBook Air M2.
#
# Run this script from the project directory:
#   chmod +x setup-macos-m2.sh
#   ./setup-macos-m2.sh
#
# Optional:
#   APP_PORT=3001 ./setup-macos-m2.sh
#   START_APP=false ./setup-macos-m2.sh

set -euo pipefail

APP_PORT="${APP_PORT:-3000}"
NODE_FORMULA="${NODE_FORMULA:-node@22}" # pdfjs-dist + better-sqlite3 both require >=22
START_APP="${START_APP:-true}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

c_g='\033[0;32m'; c_y='\033[0;33m'; c_r='\033[0;31m'; c_b='\033[0;34m'; c_0='\033[0m'
log()  { printf "%b▸%b %s\n" "$c_g" "$c_0" "$*"; }
info() { printf "%b·%b %s\n" "$c_b" "$c_0" "$*"; }
warn() { printf "%b!%b %s\n" "$c_y" "$c_0" "$*"; }
die()  { printf "%b✖ %s%b\n" "$c_r" "$*" "$c_0" >&2; exit 1; }
step() { printf "\n%b══ %s ══%b\n" "$c_b" "$*" "$c_0"; }

step "Preflight checks"
[ "$(uname -s)" = "Darwin" ] || die "This script is for macOS only."
[ "$(uname -m)" = "arm64" ] || warn "This Mac is not Apple Silicon; Homebrew paths may differ."
[ -f "$APP_DIR/package.json" ] || die "package.json not found in $APP_DIR. Put this file in the project root and run it there."
log "Project directory: $APP_DIR"
log "Local URL: http://localhost:$APP_PORT"

step "Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  info "Homebrew is not installed. Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(brew shellenv)"
fi
log "Homebrew: $(brew --version | head -1)"

step "Install Node.js, yt-dlp, and ffmpeg"
brew update
brew install "$NODE_FORMULA" yt-dlp ffmpeg

NODE_PREFIX="$(brew --prefix "$NODE_FORMULA")"
export PATH="$NODE_PREFIX/bin:/opt/homebrew/bin:$PATH"
hash -r

node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
[ "$node_major" -ge 22 ] || die "Node.js 22 or newer is required. Found: $(node -v)"

log "Node: $(node -v)"
log "npm: $(npm -v)"
log "yt-dlp: $(yt-dlp --version)"
log "ffmpeg: $(command -v ffmpeg)"

step "Persist shell PATH safely"
ZSHRC="$HOME/.zshrc"
touch "$ZSHRC"

NODE_PATH_LINE="export PATH=\"$NODE_PREFIX/bin:\$PATH\""
if ! grep -Fq "$NODE_PATH_LINE" "$ZSHRC"; then
  printf '\n# Node.js (%s) installed by SnapVidly setup\n%s\n' "$NODE_FORMULA" "$NODE_PATH_LINE" >> "$ZSHRC"
  info "Added Node.js 20 PATH to ~/.zshrc"
else
  info "Node.js PATH already exists in ~/.zshrc"
fi

# Fix common 'compdef: command not found' issue only when compdef is used
# before completion initialization.
if grep -q 'compdef' "$ZSHRC" && ! grep -q 'autoload -Uz compinit' "$ZSHRC"; then
  tmp_file="$(mktemp)"
  {
    printf '# Initialize zsh completion\nautoload -Uz compinit\ncompinit\n\n'
    cat "$ZSHRC"
  } > "$tmp_file"
  mv "$tmp_file" "$ZSHRC"
  info "Initialized zsh completion before compdef in ~/.zshrc"
fi

step "Environment file"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$ENV_FILE"
    info "Created .env from .env.example"
  else
    touch "$ENV_FILE"
    info "Created new .env"
  fi
else
  info "Existing .env found; existing values will be preserved where possible."
fi

set_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    perl -0pi -e "s|^${key}=.*$|${key}=${value}|m" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env_default() {
  local key="$1"
  local value="$2"
  grep -qE "^${key}=" "$ENV_FILE" || printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

YTDLP_BIN="$(command -v yt-dlp)"
FFMPEG_BIN="$(command -v ffmpeg)"

set_env NEXT_PUBLIC_SITE_URL "http://localhost:$APP_PORT"
set_env YTDLP_PATH "$YTDLP_BIN"
set_env FFMPEG_PATH "$FFMPEG_BIN"
set_env ENGINE_URL ""
set_env_default GROQ_API_KEY ""
set_env_default GEMINI_API_KEY ""
set_env_default GROQ_MODEL "llama-3.3-70b-versatile"
set_env_default GROQ_WHISPER_MODEL "whisper-large-v3"
set_env_default GEMINI_MODEL "gemini-2.5-flash"
set_env_default AI_MAX_DURATION_SEC "1800"
set_env_default AI_MAX_CONCURRENT "2"
set_env_default AI_RATE_LIMIT_PER_MIN "6"
set_env_default NEXT_PUBLIC_ADS_ENABLED "false"
set_env_default NEXT_PUBLIC_CONSENT_REQUIRED "false"
chmod 600 "$ENV_FILE"
log "Environment configured at $ENV_FILE"

step "Install project dependencies"
cd "$APP_DIR"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

step "Prepare ffmpeg.wasm and icons"
if [ -f "$APP_DIR/scripts/copy-ffmpeg.mjs" ]; then
  node "$APP_DIR/scripts/copy-ffmpeg.mjs" || warn "ffmpeg.wasm copy script failed; browser conversion may not work."
else
  warn "scripts/copy-ffmpeg.mjs was not found; skipping."
fi

if [ -f "$APP_DIR/scripts/gen-icons.mjs" ]; then
  node "$APP_DIR/scripts/gen-icons.mjs" || warn "Icon generation failed; existing icons may still work."
else
  info "scripts/gen-icons.mjs was not found; skipping."
fi

step "Validate production build"
npm run build
log "Production build completed successfully."

step "Done"
printf "Project: %s\n" "$APP_DIR"
printf "URL:     http://localhost:%s\n" "$APP_PORT"
printf "Env:     %s\n" "$ENV_FILE"
printf "Node:    %s\n" "$(node -v)"
printf "yt-dlp:  %s\n" "$YTDLP_BIN"
printf "ffmpeg:  %s\n" "$FFMPEG_BIN"

if [ "$START_APP" = "true" ]; then
  printf "\nStarting Next.js development server...\n"
  printf "Press Control+C to stop it.\n\n"
  exec npm run dev -- -p "$APP_PORT"
else
  printf "\nStart development mode with:\n  npm run dev -- -p %s\n" "$APP_PORT"
  printf "Start production mode with:\n  npm run start -- -p %s\n" "$APP_PORT"
fi
