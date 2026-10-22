# IdeaPrompt

Turn a rough idea into a clear brief, a practical implementation plan, or a prompt you can hand to a coding agent.

IdeaPrompt now runs as a **skill inside your assistant**. It preserves the website's refine, plan, prompt and engineering-review workflow, including quick drafts, clarification questions, proposed file structures and explicit assumptions. The host assistant does the reasoning; this skill makes no separate model API calls and needs no API key or running website. The host's normal usage limits still apply.

## Which branch?

| Branch | Contents |
| --- | --- |
| [`main`](https://github.com/adii-madhavi/ideaprompt/tree/main) | The portable IdeaPrompt skill and its documentation. |
| [`codex/website`](https://github.com/adii-madhavi/ideaprompt/tree/codex/website) | The preserved Next.js website, including the latest website updates from GitHub. |

The old website and local generation-fix commit remain in Git history. Website databases and environment files are private, ignored local files, not part of the skill. This skill does not automatically load the website's projects, preferences or version history.

## Install in Codex

Ask Codex:

```text
Use $skill-installer to install https://github.com/adii-madhavi/ideaprompt/tree/main/skills/ideaprompt
```

Start a new session after installation so the skill can be discovered. You can also copy the complete `skills/ideaprompt` folder into a supported skill directory. For a repository-scoped Codex installation, place it at `.agents/skills/ideaprompt/`. See the [official skills guide](https://learn.chatgpt.com/docs/build-skills) for supported discovery locations.

The `SKILL.md` and relative references are portable instructions; other assistants need their own skill-loading support. The optional `agents/openai.yaml` supplies Codex display metadata.

## Use it

```text
Use $ideaprompt to refine this idea: a browser car-racing game for beginners.
```

```text
Use $ideaprompt in clarify-first mode. I want a hub of browser games funded
by ads and sponsorships. Help me choose a manageable first version.
```

```text
Use $ideaprompt for a quick implementation plan for my portfolio website.
Keep it static, inexpensive and easy to maintain. Include a proposed file tree.
```

```text
Use $ideaprompt to write a Claude Code execution prompt for adding CSV export
to this repository. Inspect the existing flow and preserve unrelated behavior.
```

Choose **refine**, **plan**, or **prompt**. Prompt is the default when you request a build handoff. Say **quick draft** to proceed with labeled assumptions, or **clarify first** for up to three questions that materially affect the plan. Provide a destination tool when relevant.

You get the requested artifact, appropriate file structure, and a review of applicable requirements and checks. A static website will not acquire accounts, payments or a database without a reason. A raw idea can become a non-software workflow. Security coverage describes the specification, not a completed implementation audit.

The skill stops at the requested planning artifact. It starts implementation only when your request also authorizes implementation. It does not silently retain personal preferences, save conversation history or contact outside model providers.

## Return to the website

In this repository, switch to the website branch and follow its README:

```powershell
git switch codex/website
```

Commit or otherwise preserve any work before switching branches. Existing ignored `data/` and `.env` files stay local; keep using the intended database path when running the website.

## Skill contents and checks

```text
skills/ideaprompt/
  SKILL.md                         # Workflow and invocation rules
  agents/openai.yaml               # Codex display metadata
  references/execution-prompt.md   # Complete coding handoff structure
  references/engineering-review.md # Applicable controls and honest coverage
evaluations/scenarios.md           # Manual behavioral acceptance cases
```

When editing the skill, validate its frontmatter and references, then exercise the scenarios in `evaluations/scenarios.md`. That file describes behavioral checks; it is not an automated test runner. No Node server, model-provider account or package install is required to use the skill.
