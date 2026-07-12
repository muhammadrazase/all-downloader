# ADS-POLICY.md — SnapVidly ad compliance & "can I run multiple ads?"

Short, strict, do-this checklist so your ad accounts never get banned. Pairs with **ADS-SETUP.md** (which is the click-by-click setup). Read this once before you turn ads on.

---

## ❓ "Can I use multiple ads / multiple networks?"

**Multiple ad *slots* on a page — yes.** Your site already has many display slots (homepage, tool pages, blog, how-to, /tools). They all fill from **one** display network.

**Multiple display *networks* at once — no.** The code uses **first-configured-wins** (Ezoic → Media.net → Adsterra). You configure **one** display network; it fills every slot. Running two premium networks on the same page violates both their policies and causes bidding conflicts.

**Mixing premium display + pop-unders — NO. This is the #1 ban cause.**
Ezoic, Media.net and AdSense **prohibit** running their ads on a site that also runs pop-unders, social-bars, or auto-redirects. Pick ONE lane:

| | **Strategy A — Premium (recommended)** | **Strategy B — Aggressive** |
|---|---|---|
| Display | **Ezoic** *or* **Media.net** (one) | **Adsterra** banners |
| Globals | **none** | 1 pop-under (+ optional social-bar / push) |
| Pays | More per visitor, cleaner ads | Fills instantly on day 1, lower quality |
| Best for | Real traffic (~10k+/mo), long-term brand | Brand-new site, any traffic, instant fill |
| Rule | ❌ never add a pop-under | ❌ never enable Ezoic/Media.net |

> You **can** combine multiple *aggressive* networks (e.g. Adsterra banner + Monetag push) — but never two pop-unders, and never with a premium network.

**One-line kill switch** if anything looks wrong: `NEXT_PUBLIC_ADS_ENABLED=false`.

---

## ✅ Compliance checklist (all already built — just verify)

**Required pages (present):** Privacy ✅ · Terms ✅ · DMCA ✅ · Disclaimer ✅ · Contact ✅ · About ✅.

**Privacy policy discloses (present):** cookies, third-party ad vendors, personalized ads, opt-out links (Google Ads Settings / DAA / YourOnlineChoices), GDPR/UK/CCPA rights, children clause. → `/privacy`.

**Ad hygiene (built into the code):**
- ✅ Every banner is labeled **"Advertisement"**.
- ✅ Ads are **CLS-safe** (reserve space, no layout shift) and **lazy-loaded** (viewability + Core Web Vitals).
- ✅ Ads sit **below the fold / mid-content**, never on top of or beside the Download buttons (no accidental/forced clicks).
- ✅ **No ads** on 404, offline, contact, about, community, or any legal page.
- ✅ Blog posts capped at **one** in-content ad (content must dominate — no ad-stacking).
- ✅ **Consent gate** available for EU/UK/CA: `NEXT_PUBLIC_CONSENT_REQUIRED=true`.

**`ads.txt` (required to get paid):** `public/ads.txt` — paste each network's line from its dashboard, then rebuild. Reachable at `https://yourdomain.com/ads.txt`.

---

## 🚫 What gets you banned (never do this)
1. **Clicking your own ads** or asking anyone to. Networks detect it as invalid traffic → account ban + withheld earnings. To test, **look, don't click.**
2. **Buying traffic / bots / pop exchanges.**
3. **Mixing a premium network with pop-unders** (see table above).
4. **Ads on prohibited/thin pages** (login walls, error pages, empty pages).
5. **Encouraging clicks** ("click here", arrows pointing at ads).
6. **More ads than content** on a page.

---

## 🍪 Consent (GDPR / UK / CCPA)
- EU/UK/California traffic legally needs consent before ad cookies → set `NEXT_PUBLIC_CONSENT_REQUIRED=true` (a banner shows; ads load only after **Accept**).
- If you use **Ezoic or Media.net**, they include their own consent manager (CMP) — you can rely on that instead.
- The privacy policy already links the opt-out tools users can use.

---

## 📋 Per-network: what they require before approval
| Network | Approval bar | ads.txt | Notes |
|---|---|---|---|
| **Adsterra** | Instant, any traffic | Yes | Pop-under fills day 1. Aggressive strategy. |
| **Monetag** | Instant | Yes | Push/in-page. Aggressive strategy. |
| **HilltopAds / Galaksion** | Fast | Yes | Extra aggressive globals. |
| **Ezoic** | Site review; better with ~10k+/mo | Yes (they auto-manage) | Premium. **No pop-unders allowed.** Needs real content + the required legal pages (you have them). |
| **Media.net** | Manual review; prefers US/UK/CA traffic | Yes | Premium. No pop-unders. |

---

## 🚀 Recommended launch path
1. **Deploy** the site live (ad code is already there, invisible until keys are added).
2. **Day 1 fill:** sign up **Adsterra**, paste its keys + `ads.txt` line, rebuild → ads earn immediately.
3. Set `NEXT_PUBLIC_CONSENT_REQUIRED=true` if you expect EU/UK traffic.
4. **Around 10k visits/month:** switch to **Ezoic** for higher pay — **first remove the Adsterra pop-under** (`NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC=`), set `NEXT_PUBLIC_EZOIC_ENABLED=true`, create the Ezoic placeholders (IDs in ADS-SETUP.md), rebuild.
5. Never mix the two. Never click your own ads.

*(All keys live in `.env` as `NEXT_PUBLIC_*` and are applied on `sudo bash up.sh`. See ADS-SETUP.md for the exact copy-paste per network.)*
