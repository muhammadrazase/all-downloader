# SnapVidly — Tier 2 (AI features) Plan · $0-forever architecture

> **Goal:** transcript / subtitles / summary / translate — the SnapVidly differentiator — at **$0 no matter what**, zero VPS load, premium UX, full SEO.
> **Lenses:** Solution Architect · Next.js · SEO · UI/UX · Security.

## 0. The $0-forever architecture (never depends on one provider)
```
video url → yt-dlp -x (audio, on VPS)  → Whisper  → transcript + segments → SRT/VTT/TXT
transcript ─────────────────────────────→ LLM     → summary / translation / highlights
```
Four layers keep it free forever:
1. **Multi-provider fallback** — Groq → Gemini → (Cloudflare/OpenRouter). On `429`/error, fall to the next. Survives any single free tier changing.
2. **Cache everything** — a transcript/summary for a URL never changes → cache by `url+task+lang` (Upstash free, or in-memory). Popular videos processed **once**.
3. **Per-IP rate limit** (reuse existing) — users/bots can't burn the daily quota.
4. **Key-gated + graceful** — no key → clean "AI coming soon" state (never a crash). *(In-browser Whisper/WebLLM overflow is a documented Phase-2 add-on.)*

## 1. Free tiers (verified 2026)
- **Groq** (primary): ~1,000 LLM req/day, **~2,000 Whisper req/day**, 30 RPM — Whisper-large-v3 + Llama 3.3 70B. Org-level; cached prompt tokens don't count.
- **Gemini** (fallback, chat): ~10 RPM, ~250k TPM; free-tier data may train Google — fine for public videos.
- New site won't hit these; caching + fallback keep it $0 through growth.

## 2. Features & pages (SEO clusters no basic downloader ranks for)
| Page | Feature | Primary keyword |
|---|---|---|
| `/video-to-text` | Transcript + **SRT/VTT/TXT** subtitles (+ optional translate) | `video to text`, `download video transcript`, `get subtitles from video` |
| `/video-summary` | Paste link → AI text summary + key points | `video summary`, `summarize youtube video`, `ai video summary` |

## 3. Code contracts
```ts
// lib/ai.ts — provider abstraction (key-gated, fallback)
transcribeAudio(filePath): Promise<{ text; segments: {start,end,text}[]; provider }>   // Groq Whisper
chat(system, user): Promise<{ text; provider }>                                        // Groq → Gemini
aiConfigured(): boolean
// lib/subtitles.ts — segments → SRT + VTT
// lib/audio.ts — yt-dlp -x → temp m4a (reuses engine pattern, concurrency-capped)
// app/api/ai/transcribe/route.ts  → { text, srt, vtt, provider }   (cached, rate-limited, SSRF)
// app/api/ai/summary/route.ts     → { summary, points[] }          (cached)
```

## 4. UI/UX (premium, not vibe-coded)
- `AiToolBox` client component: same paste-box state machine, then a **result panel** — transcript in a scroll area with **Copy / Download SRT / Download VTT / Download TXT**; summary as clean prose + bullet key-points. Loading = determinate-ish "Transcribing… (30–60s)". "Powered by open Whisper · free" trust line.
- Consistent design tokens, states (idle/fetching/ready/error/not-configured), a11y, mobile.

## 5. Security & cost
- SSRF/host-whitelist + rate-limit on every AI route (reuse). Audio temp files cleaned. Concurrency-capped (Whisper is CPU-lightish since it's the API doing the work; the VPS only extracts audio). Secrets **server-only** (no `NEXT_PUBLIC`).

## 6. SEO
- Metadata + `WebApplication`+`HowTo`+`FAQPage` schema + keyword targeting per page; sitemap + nav/footer **Tools → AI** group; internal links to downloaders.

## 7. .env
```
GROQ_API_KEY=            # free — console.groq.com
GEMINI_API_KEY=          # free fallback — aistudio.google.com
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_WHISPER_MODEL=whisper-large-v3
```

## 8. Phases
1. AI abstraction + audio + `/api/ai/transcribe` + `/video-to-text` (flagship).
2. `/api/ai/summary` + `/video-summary`.
3. SEO/nav/footer/sitemap + audit + polish.
