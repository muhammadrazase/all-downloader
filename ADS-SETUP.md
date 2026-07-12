# 💰 SnapVidly — The Complete Ads Guide (Setup + Policy, One Doc)

Everything to turn ads on **the right way** — step by step, policy-safe, copy-paste. Read the first two sections, then follow the strategy you picked. Nothing here needs a developer.

> **How it works in 20 seconds:** the ad code is already built into your site. It shows **nothing** until you paste a network's keys into `.env` and rebuild. Set keys → `sudo bash up.sh` → ads appear. That's the whole loop.

---

## 0) The one decision that matters — pick a strategy

Ad networks are split into two worlds, and **mixing them gets your account banned.** Choose ONE:

| | **A — Premium (best long-term)** | **B — Aggressive (best day 1)** |
|---|---|---|
| Display ads | **Ezoic** *or* **Media.net** (one only) | **Adsterra** banners |
| Pop-under / social-bar / push | ❌ **none allowed** | ✅ 1 pop-under (+ optional extras) |
| Approval | Site review (Ezoic ~10k visits/mo; Media.net manual) | **Instant, any traffic** |
| Pay | Higher per visitor, clean ads | Fills immediately, lower quality |
| Start here if… | you have steady traffic & want a real brand | you just launched and want money now |

**Golden rule:** **Never run Ezoic/Media.net together with pop-unders.** You can combine multiple *aggressive* networks (Adsterra + Monetag), but **never two pop-unders**.

👉 **New site? Start with Strategy B (Adsterra) today, switch to A (Ezoic) around 10k visits/month.**

---

## 1) The 3 golden rules (every network)
1. **Copy-paste exactly** — keys/scripts go into `.env` as `NEXT_PUBLIC_*` values.
2. **Always rebuild after editing `.env`** → `sudo bash up.sh` (keys are baked in at build time).
3. **Fill `public/ads.txt`** with each network's line, or you won't be paid. It must load at `https://yourdomain.com/ads.txt`.

---

# 🟢 STRATEGY B — Aggressive (do this to earn on day 1)

## 2) Adsterra — start here ✅
**Step 1 — Sign up:** go to **https://adsterra.com** → Publisher sign-up → verify email.
**Step 2 — Add your website:** add `snapvidly.com`, category *Tools/Utilities*. Approved instantly.
**Step 3 — Create ad units** (in *Websites → your site → Add code*):
- **Banner 300×250** → it gives you a **key** (a long string). → `NEXT_PUBLIC_ADSTERRA_BANNER_KEY_RECTANGLE`
- **Banner 728×90** (optional) → key → `NEXT_PUBLIC_ADSTERRA_BANNER_KEY_LEADERBOARD`
- **Popunder** → it gives a **script URL** (`//...invoke.js`). → `NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC`
- **Social Bar** (optional, great on mobile) → script URL → `NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC`
**Step 4 — Paste into `.env`:**
```
NEXT_PUBLIC_ADSTERRA_BANNER_KEY_RECTANGLE=your_300x250_key
NEXT_PUBLIC_ADSTERRA_BANNER_KEY_LEADERBOARD=your_728x90_key
NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC=//www.example.com/xxxx/invoke.js
NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC=//www.example.com/yyyy/invoke.js
```
**Step 5 — Fill `ads.txt`** with the line Adsterra shows you, then **rebuild** (`sudo bash up.sh`). Done — you're earning.

## 3) Optional aggressive extras (add later, don't overdo it)
Only ONE pop-under total across all of them. Add push/in-page for a little more:
```
# Monetag (push / in-page) — https://monetag.com
NEXT_PUBLIC_MONETAG_SRC=//monetag-script-url.js
NEXT_PUBLIC_MONETAG_ZONE=your_zone_id
# PropellerAds — https://propellerads.com
NEXT_PUBLIC_PROPELLERADS_SRC=//propeller-script-url.js
NEXT_PUBLIC_PROPELLERADS_ZONE=your_zone_id
# HilltopAds (pop-under) — use INSTEAD of Adsterra pop-under, not in addition
NEXT_PUBLIC_HILLTOPADS_POPUNDER_SRC=//hilltop-script-url.js
# Galaksion — https://galaksion.com
NEXT_PUBLIC_GALAKSION_SRC=//galaksion-script-url.js
```
Rebuild after any change.

---

# 💎 STRATEGY A — Premium (switch to this with real traffic)

> Before enabling either one, **delete your pop-under/social-bar lines** (`NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC=` blank etc.). Premium networks ban pop-unders.

## 4) Ezoic — the big earner (best around ~10k visits/month)
1. Sign up at **https://www.ezoic.com** → add your site → choose **JavaScript integration** (already supported).
2. Verify your site (follow their steps).
3. Go to **Ad Positions / Placeholders** and create placeholders with these **exact IDs** (each maps to a real spot on your site — make the ones you want):
   `101` platform pages · `115` platform pages (2nd) · `105` all-in-one downloader · `107` bulk downloader · `110` AI tools · `108` converters · `106` thumbnail tools · `111` homepage · `112` /tools hub · `113` how-to pages · `102` blog posts · `103` blog index · `104` blog category.
4. Turn it on and rebuild:
   ```
   NEXT_PUBLIC_EZOIC_ENABLED=true
   ```
5. Ezoic manages `ads.txt` and consent automatically once connected.

## 5) Media.net — good for US/UK/Canada traffic
1. Sign up at **https://www.media.net** → wait for manual approval.
2. Create a **300×250** and a **728×90** ad unit → they give a **Customer ID (CID)** and a **slot ID** each.
3. Paste and rebuild:
   ```
   NEXT_PUBLIC_MEDIANET_CID=your_customer_id
   NEXT_PUBLIC_MEDIANET_SLOT_RECTANGLE=your_300x250_slot_id
   NEXT_PUBLIC_MEDIANET_SLOT_LEADERBOARD=your_728x90_slot_id
   ```

*(If you set more than one display network, the site auto-picks in this order: Ezoic → Media.net → Adsterra. Configure only one.)*

---

## 6) 📄 `ads.txt` — required to get paid (don't skip)
1. Open `public/ads.txt`.
2. Each network has an **"ads.txt" section** in its dashboard — copy the line(s) it gives you (looks like `network.com, 12345, DIRECT, abcd1234`).
3. Paste them in, save, **rebuild**. Verify at `https://yourdomain.com/ads.txt`.

---

## 7) 🍪 Consent (GDPR / UK / CCPA)
EU/UK/California visitors legally need consent before ad cookies. Built in:
```
NEXT_PUBLIC_CONSENT_REQUIRED=true   # banner shows; ads load only after "Accept"
```
- **true** → fully compliant cookie banner (recommended if you get any EU/UK traffic).
- **blank/false** → ads load immediately (simpler; fine for mostly non-EU traffic).
- Using **Ezoic/Media.net**? They include their own consent manager, so you can leave this off.

---

## 8) 🔌 Master on/off switch
Kill **every ad** site-wide in one line — for a network review, a policy issue, or testing:
```
NEXT_PUBLIC_ADS_ENABLED=false   # blank or true = ads on
```

---

## 9) 📍 Where the ads appear (13 built-in slots)
- **Display banners (300×250, lazy-loaded, labeled "Advertisement"):** homepage, `/tools` hub, platform downloader pages (**×2**), all-in-one + bulk downloaders, AI tools, converters, thumbnail tools, how-to pages, blog index/category/posts.
- **Global formats** (pop-under/social-bar/push): load once, reach every page — **Strategy B only**.
- **Deliberately ad-free** (policy + user trust — do NOT add ads here): 404, offline, contact, about, community, and every legal page (privacy/terms/DMCA/disclaimer). Blog posts are capped at **one** ad so content always dominates.

---

## 10) ✅ Compliance checklist (all already built — just don't break it)
- ✅ Legal pages present: Privacy, Terms, DMCA, Disclaimer, Contact, About.
- ✅ Privacy policy discloses cookies, third-party ad vendors, personalized ads, opt-out links (Google/DAA/YourOnlineChoices), GDPR/UK/CCPA rights, children.
- ✅ Ads labeled "Advertisement", CLS-safe, lazy-loaded, below-fold, never beside the Download buttons.
- ✅ No ads on error/thin/legal pages; blog posts ≤ 1 ad.
- ✅ `ads.txt` filled per network; `NEXT_PUBLIC_CONSENT_REQUIRED=true` for EU.

## 11) 🚫 What gets you banned (never do this)
1. **Clicking your own ads** or asking anyone to → invalid traffic → instant ban + withheld money. To test, **look, don't click.**
2. Buying traffic / bots / pop exchanges.
3. **Mixing a premium network with pop-unders.**
4. Ads on error/empty/login pages, or **more ads than content**.
5. "Click here" arrows or anything that tricks clicks.

## 12) 🧪 Test that ads work
1. Add keys → fill `ads.txt` → **rebuild**.
2. Open the **live** site in **incognito** (ad-blocker off).
3. Scroll to a tool page/blog post → the 300×250 fills within a few seconds.
4. Check the network dashboard → impressions appear within ~1 hour.
5. Empty slot = usually unfilled inventory (normal for new sites) or a wrong key/ads.txt.

## 13) 💵 Payment thresholds
| Network | Min payout | Methods | Schedule |
|---|---|---|---|
| Adsterra | $5 | PayPal, crypto, wire, Paxum | Monthly (NET-15) |
| Monetag | $5 | PayPal, crypto, wire | Weekly/Net |
| HilltopAds | $10 | PayPal, crypto, wire | NET-7 |
| Galaksion | ~$50 | PayPal, wire | Monthly |
| Ezoic | ~$20 | PayPal, wire | NET-30 |
| Media.net | $100 | PayPal, wire | NET-30 |

---

## 14) 🧾 Full `.env` ad reference (one block)
```
# ── Master ──────────────────────────────────────────────
NEXT_PUBLIC_ADS_ENABLED=true
NEXT_PUBLIC_CONSENT_REQUIRED=false

# ── Strategy B: Aggressive (Adsterra + optional extras) ──
NEXT_PUBLIC_ADSTERRA_BANNER_KEY_RECTANGLE=
NEXT_PUBLIC_ADSTERRA_BANNER_KEY_LEADERBOARD=
NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC=
NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC=
NEXT_PUBLIC_MONETAG_SRC=
NEXT_PUBLIC_MONETAG_ZONE=
NEXT_PUBLIC_PROPELLERADS_SRC=
NEXT_PUBLIC_PROPELLERADS_ZONE=
NEXT_PUBLIC_HILLTOPADS_POPUNDER_SRC=
NEXT_PUBLIC_GALAKSION_SRC=

# ── Strategy A: Premium (pick ONE; remove pop-unders above) ──
NEXT_PUBLIC_EZOIC_ENABLED=false
NEXT_PUBLIC_MEDIANET_CID=
NEXT_PUBLIC_MEDIANET_SLOT_RECTANGLE=
NEXT_PUBLIC_MEDIANET_SLOT_LEADERBOARD=
```

---

## 15) 🚀 Your launch plan (recap)
1. **Deploy** the live site (ads are invisible until keys are added).
2. **Day 1:** sign up **Adsterra** → paste banner key + pop-under + `ads.txt` line → rebuild → earning.
3. Set `NEXT_PUBLIC_CONSENT_REQUIRED=true` if you expect EU/UK traffic.
4. **~10k visits/month:** remove the pop-under, set `NEXT_PUBLIC_EZOIC_ENABLED=true`, create the Ezoic placeholders, rebuild.
5. **Never** mix premium + pop-unders. **Never** click your own ads. **Always** rebuild after `.env` edits.
