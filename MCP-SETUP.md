# MCP Setup — SnapVidly

MCP servers can't be installed from this non-interactive session (they need OAuth/auth and an interactive `claude mcp` flow). Run these yourself in an interactive Claude Code session. **Honest guidance included — don't add everything you were sent; some of it is redundant and a supply-chain risk.**

---

## ✅ Already configured (`.mcp.json`)

- **shadcn MCP** — component search/examples, pairs with the `ui-styling` and `ui-ux-pro-max` skills. Verified, useful, low-risk. Runs on first use via `npx`.

---

## ✅ Recommended to ADD — SEO servers

These add genuine capability the skills can't (live crawl + keyword data). Add interactively:

```bash
# In an interactive Claude Code session, from the project root:
claude mcp add seo-crawler        # then paste the exact command/args from mcpmarket.com/server/seo-crawler
claude mcp add seo                # from mcpmarket.com/server/seo-2
```

> I could not fetch the exact install command (mcpmarket rate-limited the request, and I won't guess a wrong package name). Open each server's mcpmarket page, copy its official config block, and either paste it into `claude mcp add` or add it to `.mcp.json` under `mcpServers`. Most require an **API key** — store it as an env var, never inline in the repo.
>
> After SEO servers are live, the `seo-strategist` agent will use them for keyword research and on-page/crawl audits.

---

## ⛔ NOT recommended — the 5 download MCPs

You were sent five downloader MCPs:
- video-downloader-media-grabber
- advanced-video-downloader
- tiktok-downloader
- youtube-video-downloader
- video-content-downloader

**Skip all five.** Reasons:
1. **Redundant.** You already have three local yt-dlp skills (`media-downloader`, `youtube-downloader`, `downloader-tiktok-videos`) that cover 1500+ sites — more capable, free, no rate limits, no vendor lock-in.
2. **Wrong layer.** These MCPs help *Claude* download during a chat. Your **production** engine (the `engine/` service in PLAN.md) is what actually serves users — it must be your own yt-dlp/ffmpeg or a paid API you control, not a chat-time MCP.
3. **Supply-chain + cost risk.** Five overlapping third-party servers = five things that can break, leak, or start charging. Minimize the attack surface.

If you want one for quick experimentation, add **only** `media-downloader`-equivalent and drop the rest. But for building the site, the local skills are enough.

---

## After adding any MCP

1. Restart Claude Code (or `/mcp` to reconnect).
2. Verify: `claude mcp list`.
3. Keep API keys in environment variables / a secrets manager — never commit them. `.env*` is already denied to the model in `.claude/settings.json`.
