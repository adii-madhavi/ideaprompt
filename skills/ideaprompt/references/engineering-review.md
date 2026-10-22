# Engineering specification review

Read this reference for software implementation plans and coding-agent prompts. Apply each control to the project's actual architecture. A check is relevant because of a real feature or boundary, not because every project should have every feature.

| Control | When relevant | Requirement to specify | Verification to include |
| --- | --- | --- | --- |
| Authentication and authorization | Restricted actions or account-based access | Use an established identity mechanism and enforce permissions at each server-side boundary. | Test unauthenticated and insufficient-role requests against protected operations. |
| Ownership and isolation | Private records, multiple users or tenants | Scope reads and writes to the authenticated owner/tenant; do not trust client-supplied ownership. | User A cannot list, read, edit or delete User B's records, even with known identifiers. |
| Input validation | External inputs | Validate types, allowed values, sizes and business rules at the trusted boundary. | Malformed, oversized and invalid-business-rule inputs fail without partial writes. |
| Database queries and integrity | Database persistence | Use parameterized queries, integrity constraints and transactions for multi-step changes. | Injection payloads remain literal values; failed multi-step changes leave consistent data. |
| Output rendering | Untrusted content displayed or exported | Render text safely; use an established allowlist sanitizer only when rich HTML is required. Address output-format risks such as CSV formula interpretation when applicable. | Script payloads remain inert and relevant export payloads do not trigger unintended interpretation. |
| Sessions and cross-site requests | Cookie sessions or browser mutations | Specify appropriate cookie attributes, expiry/revocation and cross-site mutation protections. | Reject expired/revoked sessions and unauthorized cross-site mutations. |
| Abuse and duplicate work | Costly, public or sensitive operations | Bound inputs and execution time; apply appropriate rate limiting and duplicate-operation handling. | Bursts are limited and replayed costly operations do not run twice. |
| Secrets and logging | Credentials or private data | Keep secrets at the appropriate trusted boundary; use safe configuration and minimize sensitive content in logs, errors, exports and bundles. | Inspect relevant outputs and failure paths for leakage. |
| File uploads | User-supplied files | Bound size/types, verify content, use safe storage names, isolate files and prevent unintended execution. | Reject oversized, mismatched-type, executable and traversal payloads. |
| Retention, deletion and recovery | Persisted data | Specify necessary retention decisions, deletion behavior, restricted backups, tested restores and compatible rollback. Treat an unchosen retention policy as unresolved. | Verify deletion relationships, restore an isolated backup and check rollback consistency. |
| Payments | Charges, subscriptions or paid access | Keep prices/permissions authoritative on the server, verify callbacks, uniquely record events and fulfill transactionally and idempotently. | Reject forged callbacks; replayed events cannot double-charge or double-fulfill. |
| Accessibility and responsive states | An interactive user interface | Cover keyboard use, labels, focus, contrast, supported layouts and meaningful loading/empty/success/error states. | Exercise the main workflow by keyboard and on narrow screens, including failure and recovery paths. |

## Coverage decisions

- **Specified:** the requested artifact contains both a concrete requirement and a concrete verification step. Point to its section or quote short exact supporting text.
- **Missing:** a relevant requirement or check is absent or unresolved. Describe what is missing and the next decision or amendment needed.
- **Not applicable:** the architecture has no relevant feature or boundary. Give the reason; do not invent that feature to satisfy the table.

Re-read the artifact before reporting coverage. A pasted checklist or a model's claim of completeness is not evidence of specified requirements. Repair omissions when the owner's constraints already determine the answer; otherwise keep the gap visible. If the owner supplies an approved project checklist, use it as the review baseline and explain material gaps without silently replacing it.

This is a review of a written specification. It does not prove that code is correct, secure, deployed or tested. Use specific external standard identifiers only when their applicability and version have actually been verified; the control names here need no invented compliance citations.
