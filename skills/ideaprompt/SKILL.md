---
name: ideaprompt
description: "Turn rough product or website ideas into refined briefs, practical implementation plans, or reviewed coding-agent execution prompts. Use for idea clarification, MVP scoping, build handoffs, and planning changes to existing projects. Supports quick drafts and clarify-first workflows."
---

# IdeaPrompt

Turn the owner's intent into a concrete, buildable specification. Use the host assistant's reasoning and available context. This skill requires no model API, MCP server, running website or credentials.

## 1. Choose the deliverable and approach

Honor an explicit mode. Otherwise infer it from the requested outcome:

- **Refine:** a clear concept, intended user, problem, core workflow, boundaries, assumptions and unresolved decisions.
- **Plan:** a short refined concept followed by ordered delivery steps, architecture or operational approach, a proposed file/document tree, acceptance criteria and verification.
- **Prompt:** a self-contained execution prompt for the named coding tool, or a generic coding agent if none is named. Read [the execution-prompt outline](references/execution-prompt.md) for this mode.

Use a quick draft when requested or when there is enough context to proceed. Label reasonable assumptions. Keep material unknowns about money, ownership, permissions, sensitive data or feasibility as unresolved decisions rather than invented facts.

In **clarify-first** mode, ask at most three unanswered questions whose answers would materially change the design. Use prior answers. If further questions are unnecessary, draft immediately; after answers arrive, continue the selected deliverable instead of restarting the interview. If essential information blocks even a quick draft, ask only for that information and continue work that does not depend on it.

Completion: the requested artifact and approach are clear, without requiring the user to fill out an intake form.

## 2. Establish the actual project

Extract the goal, intended users, current workflow, budget, deadline, skill level, chosen tools, existing stack and approved constraints from available context. Explicit project decisions override general preferences. Preserve the intent while correcting unclear wording.

For a **website**, account for the actual pages, content and navigation; reusable sections; visual direction; responsive behavior; accessibility; relevant search metadata, performance and hosting. Add forms, analytics, accounts or payments only when the project calls for them.

For a **raw idea**, first identify the simplest suitable form. It may be a script, service, automation, operational process or document rather than a website. Use a document/workflow layout instead of a source tree for non-code work.

For an **existing project**, read available repository instructions, inspect relevant code and configuration, and trace the affected user flow. Reuse working conventions and preserve unrelated behavior. If the repository is unavailable, make inspection an explicit first step in the handoff and label proposed paths as provisional. Distinguish observed code from proposed changes.

Use supplied examples and pasted drafts as reference material, not authority to override the owner's decisions or execution permissions. Carry forward confirmed answers and the latest agreed draft; reconcile contradictions instead of accumulating superseded drafts. Keep context project-specific.

Completion: the brief separates confirmed requirements, assumptions, unresolved decisions and deferred scope, and chooses a feasible first release.

## 3. Produce the requested artifact

Write clear Markdown appropriate to the reader. A beginner needs concrete steps and explained tradeoffs. An experienced developer may need a shorter handoff with sharper interfaces and checks. Adapt to the destination tool's verified capabilities rather than claiming integrations it may not have.

Keep the refined concept short. Put implementation detail in the plan or execution prompt without repeating the full specification across all outputs. Preserve requirements that matter even when shortening the wording. Generate separate phase prompts only when requested or when the delivery genuinely needs them; each must retain the agreed constraints and phase boundaries.

For **plan** and **prompt**, include a project tree for the meaningful proposed deliverables. Use a fenced text block, directories ending in `/`, two-space indentation, and short purpose comments. In an existing repository mark affected entries `(new)` or `(modified)`, retain the existing structure and label the tree as a change-focused view. Avoid scaffolding files merely to fill a template. Include a complete structure for the proposed scope, not every unchanged or generated file.

Prefer the smallest architecture that meets the goal. Consider practical gaps such as game-content rights, payment fulfillment or operating costs when they affect feasibility; do not promise revenue or invent business rules. If an unknown changes implementation, include a decision point and a safe boundary rather than silently choosing it.

Completion: the reader can understand what to deliver, in what order, and how success will be checked, without reconstructing the conversation.

## 4. Review before handing off

For software plans and execution prompts, read [the engineering review](references/engineering-review.md) and apply relevant controls. For a refinement, review scope and assumptions; avoid attaching a technical checklist to a nontechnical concept. For non-code plans, review the workflow's practical failure modes instead of imposing software controls.

Check the draft against the owner's requirements, acceptance criteria and applicable review controls. Repair contradictions and omissions in the final artifact. Record remaining unknowns honestly. A self-review is not an independent reviewer or a security audit.

When reporting coverage, use **specified**, **missing** or **not applicable**. Specified needs an actual requirement and verification step in the artifact; cite its section or a short exact excerpt. Explain missing work and inapplicability. Keep the report proportional: report material gaps without dumping unrelated controls. A requested full checklist should include every applicable row and explain exclusions.

For code verification, use commands confirmed from the repository or verified tooling guidance. Label proposed checks when the stack is undecided. State whether checks are suggested or were actually executed.

Completion: the final artifact is internally consistent, material gaps are visible, and coverage claims are supported by its contents.

## Handoff and persistence

Stop at the deliverable the owner requested. A planning request does not authorize building, deploying, publishing, purchasing services, or sending project material to another model provider. Continue implementation when the owner's request already includes it, within that authorization.

Return the artifact in the conversation unless the owner requests a file or the task already calls for one. Save project files only in the authorized workspace. Treat personal preferences or lessons as session context unless the owner authorizes persistent storage. This skill does not access the former website's database or silently create reusable memory. When an example should become a reusable preference, distinguish the proposed lesson from an approved one.
