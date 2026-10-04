# IdeaPrompt

Single-owner **Next.js 16 + TypeScript + SQLite** app that turns a rough idea into a refined concept, an implementation plan with a file structure, or a ready-to-paste coding prompt. Inference goes through free-tier LLM providers, routed with automatic fallback. Local only: it binds `127.0.0.1` and has no authentication.

## Run

Needs **Node 24+** (uses built-in `node:sqlite`).

```powershell
npm ci
Copy-Item .env.example .env   # add at least one provider key
npm run dev                    # http://127.0.0.1:3000
```

The database (`data/ideaprompt.sqlite`) is created on first use. Restart the server after editing `.env`.

## Providers and routing

Keys are read **only from server environment variables** in `.env`. Logic lives in `src/lib/providers.ts` (same design as the INSPi project).

| Provider | Key variables | Default model |
| --- | --- | --- |
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| Gemini | `GEMINI_API_KEY` | `gemini-flash-latest` |
| OpenRouter | `OPENROUTER_API_KEY` | `google/gemma-4-31b-it` |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | none, pick one |
| Pollinations | `POLLINATIONS_API_KEY` | none, pick one |

- **Order:** Settings → Connections sets the order. The first provider that answers wins; a provider without a key or model is skipped, and any failure moves on to the next.
- **Second key:** `<PROVIDER>_API_KEY_FALLBACK` (Cloudflare: `CLOUDFLARE_API_TOKEN_FALLBACK`) takes over when the first key is rejected or out of quota.
- **Rate limits:** short `429` waits are honoured; long ones skip to the next key or provider.
- **Output cap:** only Groq is capped (Settings → "Output token limit", default 3500, also held under its 8K tokens/minute allowance). Other providers get their full output size. A capped draft that parses and has its structure skips the review pass.
- **Models:** each provider's dropdown is fetched live from its `/models` endpoint when Settings opens. `GROQ_MODEL`, `GEMINI_MODEL`, `OPENROUTER_MODEL` set defaults.
- **Test button:** uses the provider's cheapest model (`testModel` in the registry).
- OpenRouter free models are requested by plain id (the `:free` suffix is stripped).

## Workflow

1. Describe the idea; optional context (stack, budget, hosting, audience, deadline).
2. Pick **Raw idea** or **Website** with the sliding switch. Website plans pages, components, SEO and a site tree. Raw idea assumes nothing about the form.
3. Pick a mode: **Refine**, **Plan** or **Generate a prompt**, and the target coding tool. *Quick draft* labels assumptions; *Clarify first* asks up to three questions per round.
4. Plan and prompt modes always include a **file structure** (own tab, also embedded in the plan/prompt and the Markdown export).
5. A review pass repairs missing requirements. The **Coverage** tab reports each checklist control as `specified`, `missing` or `not applicable`, with exact evidence. This is a text check, not proof of correctness or security.
6. Versions are immutable. Regenerate to add a new one; edit, rate, export or approve an artifact as a reusable example.

Execution prompts require these sections: Objective, Users and workflows, Requirements, Assumptions, Unresolved decisions, MVP and deferred scope, Stack, Architecture and integrations, File structure, Data design, Security, Accessibility and states, Deployment and operations, Implementation phases, Acceptance criteria, Verification commands.

## Code map

| Path | Purpose |
| --- | --- |
| `src/lib/providers.ts` | provider registry, chain, key/rate/output-cap handling, streaming client, model listing |
| `src/lib/generate.ts` | draft → review → coverage → save, with progress events |
| `src/lib/prompts.ts` | system prompt, target rules, file-structure rule, draft parsing and checks |
| `src/lib/schema.ts` | zod schemas: settings, generation input, draft |
| `src/lib/db.ts`, `migrations/` | SQLite store and schema |
| `src/lib/checklist.ts` | default engineering checklist and default settings |
| `src/lib/http.ts` | localhost guard, body limits, rate limit |
| `src/app/api/*` | `generate` (NDJSON stream), `provider` (model list, test), `settings`, `projects`, `versions`, `examples`, `messages` |
| `src/components/workspace.tsx` | main UI; `settings.tsx` settings dialog; `ui.tsx` shared widgets |
| `src/app/globals.css`, `visual-styles.css` | styles; `visual-styles.css` loads last and holds the final dark theme |
| `tests/core.test.ts` | node test runner suite (mocked providers, tests only) |

## Design

One permanent Terminal theme: black `#0b0b0e`, soft red `#f0787e`, pearl text `#e9e4e5`; self-hosted IBM Plex Sans/Mono in `public/fonts`. The left panel is translucent glass with a matte grain, no scrollbar, truncated names with a hover tooltip. Every surface, including dialogs, is dark; do not add white backgrounds. Reduced motion is respected and the header has a Pause motion control.

## Security and privacy

- Host allowlist, localhost bind, same-origin checks on mutations, JSON-only bodies, 128 KB request cap, zod validation, 8 generation starts per minute, per-call timeout (`PROVIDER_TIMEOUT_MS`, 10–180 s, default 90).
- Keys never reach SQLite, the browser, exports or logs. Upstream error text is shown with any key redacted.
- Ideas and selected context are sent to whichever provider answers. Do not paste secrets into idea fields.
- Parameterized SQL; one app process owns the database. Back up `data/ideaprompt.sqlite` with its `-wal`/`-shm` files while the app is stopped.
- Not suitable for public hosting without real auth, per-user scoping, HTTPS and persistent rate limits.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke     # needs a running server; never triggers billable inference when a key is set
npm run eval -- --live --provider groq --model MODEL   # optional, uses free quota
```
