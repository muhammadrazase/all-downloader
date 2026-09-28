# Deploy SnapVidly to a VPS — easy, simple, fast

One script does everything: Node, yt-dlp, ffmpeg, build, systemd service, Nginx + `sites-available`, SSL, firewall, and `.env`.

---

## 1. Get a VPS
Any cheap Ubuntu 22.04/24.04 VPS works (Hetzner CX22 ~€4, Contabo, DigitalOcean $6, etc.). You need the **IP** and **root/sudo SSH access**.

## 2. Point your domain (optional but recommended)
In your domain's DNS, add two **A records** to your VPS IP:

| Type | Name | Value |
|------|------|-------|
| A | `@`   | `YOUR.VPS.IP` |
| A | `www` | `YOUR.VPS.IP` |

Wait a few minutes for DNS to propagate. (Skip this to run on the IP over HTTP.)

## 3. Put the code on the server
```bash
ssh youruser@YOUR.VPS.IP
git clone <your-repo-url> snapvidly   # or upload the folder via SFTP
cd snapvidly
```

## 4. Run it — one command
**With a domain (gets free HTTPS automatically):**
```bash
sudo DOMAIN=yourdomain.com LE_EMAIL=you@email.com bash up.sh
```
**Without a domain (HTTP on the IP):**
```bash
sudo bash up.sh
```

That's it. In a few minutes the site is live. 🎉

---

## What `up.sh` does (all automatic)
1. Adds swap if RAM is low (so builds don't fail on a 1 GB VPS).
2. Installs Node 20, `git`, `nginx`, `ffmpeg`, `ufw`.
3. Installs `yt-dlp` + a **daily auto-update** (keeps YouTube working).
4. Writes `.env` — sets the site URL + engine paths, **keeps your ad keys** if already present.
5. `npm ci`, copies the **ffmpeg.wasm core** for the in-browser video converter, then `npm run build`.
6. Creates a hardened **systemd** service (`snapvidly`) that auto-restarts and starts on boot.
7. Writes **`/etc/nginx/sites-available/snapvidly`**, enables it, removes the default site, reloads Nginx. Downloads are tuned to stream (no buffering, long timeouts).
8. Gets **Let's Encrypt SSL** and forces HTTPS (when a domain is set).
9. Enables the **firewall** (SSH + HTTP/HTTPS only).

## Adding your ad keys
1. `nano .env` → paste your ad-network keys (Adsterra, Ezoic, etc.).
2. `sudo bash up.sh` again → it rebuilds with the keys and never wipes them.

## Everyday commands
```bash
systemctl status snapvidly            # is it running?
journalctl -u snapvidly -f            # live logs
sudo systemctl restart snapvidly      # restart
```

## Updating the app
```bash
cd snapvidly && git pull
sudo bash up.sh                 # rebuilds & restarts; re-running is always safe
```

## Troubleshooting
- **Service won't start:** `journalctl -u snapvidly -n 50`
- **SSL failed:** DNS wasn't ready. Once it resolves: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
- **502 in browser:** the app is still building/starting — wait, then `systemctl status snapvidly`.
- **Downloads slow/large:** normal for HD — the server merges video+audio, then streams it.

## Admin panel
```bash
npm run admin:create            # create the single superadmin (or reset its password)
```
Then sign in at `https://yourdomain.com/admin`. `up.sh` generates `SESSION_SECRET` and
`CONFIG_ENCRYPTION_KEY` automatically — **back up `.env` after the first run.** Losing
`CONFIG_ENCRYPTION_KEY` makes every key saved from the panel unreadable.

Lost the password? `npm run admin:reset` always works from the shell — a forgotten
password can never permanently lock you out.

Optional extra hardening: restrict `/admin` to your own IP in the nginx server block.
```nginx
location /admin { allow 203.0.113.7; deny all; proxy_pass http://snapvidly_app; }
```

## Email (contact form + AI quota alerts)
Set these in `.env` (or from `/admin/settings` → Site & Community, which overrides them):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password     # Gmail: an App Password, not your login
SMTP_FROM=SnapVidly <you@gmail.com>
CONTACT_TO=you@gmail.com
ALERT_EMAIL=you@gmail.com               # defaults to CONTACT_TO
```
`up.sh` installs a **daily cron** that emails `ALERT_EMAIL` when the free Groq/Gemini
quota passes 80% or runs out, and keeps emailing daily until you add a new key. Test it
from `/admin/ai-keys` → "Send test alert".

## Analytics (`/admin/analytics`)

Zero setup — `up.sh` runs `npm run build:geo` automatically, which builds the country
lookup from the 5 internet registries' own public data (no signup, no API key, no paid
tier). It refreshes monthly via cron; re-run it manually any time with:
```bash
npm run build:geo
```
If it's never run (offline box, first deploy before DNS/network is ready), the dashboard
still works — every visitor's country just shows as unknown until you run it.

Visitor counts and tool views are first-party (your own `/api/track`, not a third party)
and are aggregate-only — no per-visitor records are ever stored. See CLAUDE.md's
"Analytics" section for exactly what is and isn't collected.

## Scaling (the order that actually matters)

Most tools cost you nothing: 19 of the 32 run entirely in the visitor's browser. Real
server load is the 11 platform downloaders and the 2 AI tools.

**1. Put Cloudflare (free plan) in front — do this first.** It's the single biggest win
and removes static egress, which is what actually breaks first at scale.
- Point the domain's nameservers at Cloudflare, proxy (orange cloud) the root record.
- Add a **Cache Rule**: match everything *except* `/api/*` and `/admin/*` → Cache Eligible,
  Edge TTL ~1h, and enable stale-while-revalidate. Cloudflare does **not** cache HTML by
  default, so without this rule you only get asset caching.
- **Serve `/api/download` from a separate hostname with the proxy OFF (grey cloud).**
  Proxying large media through the free plan risks a ToS problem, and grey-clouding also
  keeps downloads going browser→source, which is the whole point of the bandwidth rule.

**2. Keep the RapidAPI backend active** (`RAPIDAPI_KEY` + `RAPIDAPI_HOST`). It returns
direct CDN links, so video bytes never touch your box. With it on, one VPS goes a long way.
`/api/extract` results are deduped in-process (see `src/lib/extractCache.ts`), so a
trending link costs one upstream call, not thousands.

**3. Only then consider more machines.** In order:
- Add Redis (self-hosted on the same box, unix socket) for the extract/AI caches and quota
  counters, so they survive restarts.
- **Before running more than one Node process**, add a Redis `cacheHandler` to
  `next.config.mjs`. Next's ISR cache is per-process, so otherwise an admin toggle only
  takes effect on whichever process handled the request and the others serve stale forever.
- Move heavy extraction to a second box and point `ENGINE_URL` at it — do this only if
  you're running the local yt-dlp backend, since that's the only part touching video bytes
  (and the part that gets IP-banned).

A 2 GB VPS handles light traffic comfortably. Downloads use CPU (ffmpeg) + bandwidth.
