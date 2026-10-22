# Execution-prompt outline

Read this reference when the owner requests a prompt to hand to a coding agent. Write one self-contained Markdown prompt; use the sections below for software work. Keep short sections short and explain inapplicable sections in one sentence. A non-code handoff should use an appropriate workflow outline rather than pretend to have code or deployment commands.

The prompt should carry the current requirements and confirmed answers, not reference an unseen chat. Adapt wording to the destination tool only where its capabilities are known.

## Objective

State the concrete outcome and its boundaries. Identify whether this is a new product or a change to an existing project.

## Users and workflows

Name the actual user groups and the primary end-to-end actions. Include failure paths that materially change the design.

## Requirements

List testable behavior and constraints. Distinguish requirements from optional suggestions and unresolved decisions. Retain the owner's chosen tools, budget, exclusions and existing behavior.

## Assumptions

Label provisional defaults and their effect. Avoid treating unconfirmed financial, legal, permission or data-ownership rules as facts.

## Unresolved decisions

List important unknowns, why they matter and the implementation step they block. When a decision is not needed for the first release, defer it explicitly.

## MVP and deferred scope

Define the smallest useful release and its non-goals. Broad ambitions such as a multi-game hub should have a feasible first slice without erasing the longer-term goal.

## Stack

Use the existing stack where available. For a new project, recommend the simplest fit with reasons and respect explicit technology choices. Distinguish a proposal from a confirmed decision. Note external services and costs when relevant; do not assume free hosting covers every feature.

## Architecture and integrations

Describe responsibilities, data flow, boundaries and relevant external services. For existing code, instruct the agent to read repository rules, trace the affected flow and reuse current interfaces before editing. Do not prescribe new services or rewrites without a requirement that justifies them.

## File structure

Provide a fenced text tree of the proposed scope. End directory names with `/`, indent two spaces, and annotate files with a short purpose. Existing-project entries should be marked `(new)` or `(modified)`; preserve the repository's layout and explain that unchanged files are omitted. Label uninspected paths as provisional.

## Data design

If persistence is needed, cover entities, relationships, ownership, validation, integrity constraints, necessary indexes, migrations and transaction boundaries. For a static site or a stateless tool, explain why persistence is unnecessary.

## Security

Include applicable requirements and concrete checks from [the engineering review](engineering-review.md). Protect relevant boundaries without adding an account system or other infrastructure solely to satisfy a checklist.

## Accessibility and states

Specify applicable loading, empty, success, error and permission states; keyboard operation, focus, labels, contrast and responsive behavior. For non-UI tools, cover relevant progress, failure and recovery behavior instead.

## Deployment and operations

Include relevant environment configuration, hosting assumptions, safe logging, backups/restores and rollback. Mark operational decisions that depend on an unchosen platform. Instruct the implementer to inspect generated commands and follow existing execution permissions; the prompt itself grants no publishing or spending authorization.

## Implementation phases

Order work by dependency and define a working, verifiable result for each phase. Preserve confirmed constraints across phases. Request separately copyable phase prompts only when useful or explicitly requested.

## Acceptance criteria

Use observable outcomes mapped to the core workflows and failure paths. Include preservation of existing behavior when modifying a project.

## Verification commands

Use exact commands only when confirmed by repository configuration or verified tooling documentation. Otherwise describe checks to perform and require the implementer to discover the project's actual commands. Never present proposed tests as passing tests.

## Delivery check

Before returning the prompt, check that files, stack, data design, permissions, phases and acceptance criteria agree. Repair unsupported coverage claims. Return the finished prompt once rather than repeating its contents as a long separate plan; add a short review note outside the prompt when useful.
