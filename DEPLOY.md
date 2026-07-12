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

## Cost & scaling notes
- A 2 GB VPS handles light traffic comfortably. Downloads use CPU (ffmpeg) + bandwidth.
- If you outgrow one box: keep the site on the VPS and move heavy extraction to a second box, then set `ENGINE_URL` in `.env` to point at it.
