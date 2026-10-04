# IdeaPrompt

A working, single-owner **Next.js + TypeScript + SQLite** application for turning rough ideas into refined concepts, implementation plans, and actionable coding prompts. All inference runs through **Groq or OpenRouter**, selected explicitly. There are no simulated responses in the app, agent frameworks, automatic code execution, deployments, model training, or provisioned paid services.

## Install and run

Requires **Node.js 24+** and npm. SQLite uses Node's built-in `node:sqlite`; no database service or native SQLite dependency is needed.

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local: add a real server-side provider key and optional model ID.
npm run db:migrate
npm run dev
```

Open **http://127.0.0.1:3000**. The database is created automatically on first use, so the migration command is also safe to repeat. `migrations/001_initial.sql` creates the schema and indexes; the applied revision is tracked in `schema_migrations`.

In **Settings → Connections**, select a provider and choose a model from the dropdown, which automatically loads only eligible free chat models. OpenRouter lists zero-priced `:free` variants; each inference rechecks the live catalog and enforces `max_price` of zero for prompt, completion, request and image pricing. Groq lists supported general-purpose chat models from its documented Free plan limits; you must confirm in Settings that your Groq organization is on the Free plan. The app cannot verify the billing tier through the model API. Clear that confirmation if you upgrade to Developer, where these models are billed. **Refresh models** reloads the list when needed. No model name needs to be typed. Use **Save & test connection** to verify your choice; the test performs a small real inference request and consumes free usage quota under these restrictions. Catalog availability does not guarantee a model supports chat, streaming, privacy constraints, or the chosen token limit. Streaming can be disabled explicitly for incompatible models; the app never falls back to another model or provider. Automatic OpenRouter model routing is rejected. Changes to `.env` or `.env.local` require a server restart. No credentials are entered through the UI.

Production on the same computer:

```powershell
npm run build
npm start
```

Both startup commands bind **127.0.0.1**, not the network interface. Keep this application local. A local process with access to your account can access the application; localhost is not an authentication system.

## Core workflow

1. Start a project, describe the idea, and optionally add existing-project notes, budget, preferred technologies, hosting, audience and deadline.
2. Choose **Refine my idea**, **Plan implementation**, or **Generate a prompt**, and the destination coding tool.
3. **Quick draft** labels assumptions and unresolved decisions. **Clarify first** asks up to three consequential questions per round, only when necessary. Answer them or continue through follow-up messages.
4. Drafts undergo a separate provider review that attempts to repair missing requirements and verification steps before being saved. Progress is streamed as receipt/status updates; unreviewed JSON is not presented as a finished artifact. Cancellation aborts the fetch and server run.
5. Inspect artifacts and coverage, copy the selected artifact or phase prompt, and export all version artifacts as Markdown. Regeneration creates a new version. Previous versions remain available after failures.
6. Rate drafts, record corrections and build outcomes, and optionally move corrections into a follow-up. Feedback is saved but never silently applied as approved knowledge.

Execution prompts require sections for objectives, users/workflows, requirements, assumptions, unresolved decisions, MVP/deferred scope, stack, architecture/integrations, data design, security, accessibility/states, operations, implementation phases, acceptance criteria, and verification commands. Requirements are tailored: a static site should not acquire an unnecessary authentication system or database. Existing-project prompts instruct the coding agent to inspect and trace the repository, reuse functionality, preserve unrelated work, and verify changes.

The **Coverage** tab reports `specified`, `missing`, or `not applicable` with reasons and checks. `specified` requires exact requirement and verification excerpts to exist in the requested artifact. This is a textual specification check, **not** proof of implementation correctness or security. Applicability and semantic quality still require human judgment. A review can still leave controls missing; these are shown honestly.

## Personalization and data controls

Preferences are explicitly approved when saved in Settings. Examples and lessons require **Approve & save**; generated answers never enter the reusable library automatically. References can be project-associated or reusable across this owner's projects. Select at most three references explicitly before generation. Context sent to providers consists of this project's idea/context, approved preferences, enabled checklist, selected references (bounded to 6,000 characters each), the eight most recent project messages (bounded to 6,500 characters each), and the current message. The review additionally receives the draft. No other project's conversation or entire-history export is sent.

Search uses SQLite `LIKE` queries and explicit associations. There is no vector database or training pipeline. Approved references are labeled as untrusted reference data in model instructions; this reduces but cannot guarantee elimination of prompt-injection effects.

Projects and context, conversation messages, artifacts, feedback, preferences and examples can be edited. Versions, messages, examples and projects can be deleted, and **Settings → Memory** exports all data to JSON or resets the workspace after confirmation. Exported JSON is an archival inspection format; there is no JSON import UI. Manual artifact edits invalidate coverage claims; regenerate for another review. Conversation edits affect future context without changing saved artifacts. Deleting a version does not delete its separate conversation messages; delete those separately or delete the project.

Checklist changes create immutable revisions. Restore an earlier checklist from Settings; restoration creates another revision when saved. Each generated version retains the exact checklist revision, provider, model, template version, mode and destination tool used. Default numeric ASVS references were checked against the official **ASVS 5.0.0** release: `v5.0.0-1.2.4` (parameterized queries), `v5.0.0-2.2.1` (input validation), and `v5.0.0-3.2.2` (text rendering). Other controls use chapter-level or project-specific references rather than invented identifiers. Custom references are owner-authored annotations.

## Provider integration and privacy

Official documentation reviewed on **October 3, 2026**:

- [Groq API reference](https://console.groq.com/docs/api-reference): server-side Bearer auth to `/openai/v1/chat/completions`, `max_completion_tokens`, configurable model ID and SSE streaming. [Groq data controls](https://console.groq.com/docs/your-data): configure Zero Data Retention in your Groq organization. The app cannot change that setting; inference content can otherwise be retained for reliability/abuse monitoring.
- [OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview) and [streaming](https://openrouter.ai/docs/api/reference/streaming): server-side Bearer auth to `/api/v1/chat/completions`, `max_tokens`, configurable model ID, streamed errors, and abort-based cancellation. [Provider routing/privacy controls](https://openrouter.ai/docs/guides/routing/provider-selection): requests use `data_collection: "deny"`, `allow_fallbacks: false`, `require_parameters: true`, and `zdr: true` by default. You may explicitly disable the ZDR requirement; denied data collection remains enforced. OpenRouter still chooses an eligible upstream endpoint for the selected model. Restrictions can make a model unavailable. Review account logging/training preferences as well.
- [OpenRouter free variants](https://openrouter.ai/docs/guides/routing/model-variants/free), [Groq Free plan limits](https://console.groq.com/docs/rate-limits), and [Groq billing tiers](https://console.groq.com/docs/billing-faqs) inform the free-only restrictions. If the catalog cannot be verified, inference stops.
- [OWASP ASVS 5.0.0 release requirements](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json): versioned source for default references and relevant security-control design.

Ideas and selected context leave your computer when you generate. Draft and review are usually **two inference calls** against free usage limits; clarification is one. Paid and unavailable models are rejected, including IDs previously saved or set through the environment. Groq is free only while your organization remains on its Free plan; a model ID alone cannot guarantee this. Maximum output tokens apply per call. Cancellation stops local processing and attempts to cancel provider work; provider-side billing/cancellation behavior varies. There is no automatic retry, provider switching, external tracking, or external font request. Model IDs are not assumed to remain available.

Keys are read only from server environment variables. They are not stored in SQLite, localStorage, client bundles, exported prompts, or application logs. Provider error bodies are not forwarded or logged; errors are mapped to safe messages. Do not paste secrets into idea/context fields: those fields are intentionally stored, transmitted, and exportable. Never share `.env.local`, database files or private exports.

## Local security and limits

- Host allowlist, localhost bind, cross-site fetch rejection, and exact same-origin `Origin` checks on every mutation; mutation bodies must be JSON. External embedding is denied. GET data is uncached.
- Zod validation, bounded request reads (128 KB), idea/follow-up limits (16,000 characters), context notes limit (12,000), history/reference bounds, response-size limits, configurable output budget (1,024–12,000 tokens), and provider-call timeouts (10–180 seconds; default 90).
- Costly API operations are limited to eight starts per minute per application process. In-flight project locks, unique request IDs and a SQLite partial unique index prevent duplicate generations. Results and messages are committed together in one transaction after successful review; failures never replace previous artifacts. Runs abandoned at process restart are marked failed.
- Parameterized SQL, foreign keys, cascades, constraints and project/time indexes. A single application process owns the SQLite store and in-memory cancellation map; multiple server instances sharing a database are unsupported.
- AI output is rendered through React text nodes, with a small text-only Markdown layout. Raw HTML, arbitrary URLs/images and code are not executed. The production CSP excludes `unsafe-eval`; inline framework scripts/styles are allowed for this local deployment. A stricter nonce CSP belongs in a future authenticated public deployment.
- The `data/` directory, environment files and build artifacts are ignored by Git. On POSIX, newly created storage is restricted to owner access. On Windows, place the repository and backups in your private user directory and verify filesystem ACLs: do not store these files in a shared/synced folder accessible to others. SQLite is not encrypted at rest; use OS disk encryption when needed.

**Before public access:** implement real authentication, per-user authorization and ownership scoping for every record, HTTPS, persistent per-user/IP rate limits, production CSRF/session protection, hardened headers, deployment/backup policies and review. The host allowlist intentionally prevents using this starter with a public domain. Removing it alone does not make the application suitable for public exposure. A future multi-user implementation must keep examples private to their owner.

No default automatic data-expiration policy is invented. Data remains until deleted. Deletion is logical SQLite deletion; backups and previously exported copies need separate removal. Workspace reset vacuums local storage, but filesystem recovery is not guaranteed to be impossible.

## Backup, restore and rollback

For a **restorable backup**, stop the application, then copy `data/ideaprompt.sqlite` and any matching `-wal` / `-shm` files into a private backup location. If `DATABASE_PATH` is configured, back up that path instead. Keep credentials separate and protected. JSON exports are useful for portability and inspection, but are not the database restore mechanism.

To restore: stop the application, preserve the current database files in a separate private backup, replace them with a consistent backup set, then restart and check project/version counts. Verify restore periodically against an isolated database path. Never copy only the main SQLite file while the application is writing in WAL mode. Do not share one database across development and production processes.

Before updating the app/schema, back up the database and retain the prior application revision and lockfile. For rollback, stop the app, restore the matching database backup and application revision, run `npm ci`, build and restart. This initial release has one additive idempotent migration; future migrations should receive new numbered files and explicit upgrade/rollback guidance.

## Verification and evaluation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run eval
npm audit
```

With a local server running, `npm run smoke` additionally verifies real HTTP persistence/export, cross-origin rejection and validation, creates and cleans up only its own temporary project, and checks missing-key handling when no real key is configured. It never initiates billable inference when a key is present. Set `SMOKE_ORIGIN` to a different localhost port if needed.

Tests use mock provider responses **only in tests** and cover persistence across reopening, review failures, cancellation, duplicates, clarification bounds, coverage evidence, checklist history, injection-safe search, cascades, localhost/body validation, fragmented SSE and safe upstream errors. `npm run eval` checks prompt construction for three fixed ideas in `evaluations/ideas.json`; it does not certify real model output.

Evaluate actual JSON outputs or an exported workspace:

```powershell
npm run eval -- --file path/to/export.json
```

Run the fixed set against a real provider after selecting an eligible free model and configuring credentials (uses free quota; never run automatically). For Groq, first save the Free plan confirmation in Settings:

```powershell
npm run eval -- --live --provider groq --model YOUR_CURRENT_MODEL_ID
# or --provider openrouter --model YOUR_CURRENT_MODEL_ID
```

Live evaluation saves reviewed artifacts in private `data/evaluations/`, checks required structure, missing coverage, and expected applicability. Models may still make semantic errors. **Quality improvement requires inspecting real outputs, corrections and build outcomes, not simply increasing checklist counts.**

## Delivery verification

Production build, typecheck, lint, core tests and fixed-set template check were run during implementation. Both provider keys were absent, so live generation, live inference connection tests, actual model quality and provider-side cancellation/billing remain unverified. The Aikido code scan was attempted but requires plugin sign-in. The dependency audit is separate from a SAST scan; an audit or an AI review is not a security guarantee.
