<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on IdeaPrompt

Read `README.md` first: it has the run steps, provider routing rules and a code map.

- Provider and routing changes go in `src/lib/providers.ts` only; keep Groq the only output-capped provider.
- Plans and prompts must keep the `fileStructure` field and the `File structure` prompt section.
- Styling: `src/app/visual-styles.css` loads after `globals.css` and wins; keep every surface dark (red `#f0787e` on black).
- Secrets live in `.env` (gitignored). Never commit keys or `data/`.
- Before finishing: `npm run lint`, `npm run typecheck`, `npm test`.
