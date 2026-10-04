import type { Control, Settings } from "./schema";

// Only versioned ASVS identifiers checked against the official v5.0.0 release are cited.
export const DEFAULT_CONTROLS: Control[] = [
  {
    id: "auth",
    title: "Authentication & authorization",
    requirement:
      "When accounts or restricted actions exist, enforce authentication and authorization on the server for every protected operation. Use an established identity library.",
    verification:
      "Unauthenticated and insufficient-role requests are rejected by the server.",
    reference: "OWASP ASVS 5.0: Authentication and Authorization chapters",
    enabled: true,
  },
  {
    id: "ownership",
    title: "Ownership & tenant isolation",
    requirement:
      "When records have owners or tenants, scope every read and mutation to the authenticated owner or tenant; do not trust a client-supplied owner ID.",
    verification:
      "User A cannot read, update, delete, or list User B's records even with a known record ID.",
    reference: "OWASP ASVS 5.0: Authorization chapter",
    enabled: true,
  },
  {
    id: "validation",
    title: "Validate inputs",
    requirement:
      "Validate bodies, query parameters, and relevant business rules on the server with explicit types, allowed values, length and size limits.",
    verification:
      "Malformed, oversized, and invalid-business-rule inputs fail without changing stored data.",
    reference: "ASVS v5.0.0-2.2.1",
    enabled: true,
  },
  {
    id: "queries",
    title: "Parameterized database queries",
    requirement:
      "When a database is needed, use parameterized queries and database constraints; never concatenate user input into queries.",
    verification:
      "Injection payloads are treated as literal values and cannot alter the query structure.",
    reference: "ASVS v5.0.0-1.2.4",
    enabled: true,
  },
  {
    id: "rendering",
    title: "Safe output rendering",
    requirement:
      "Render untrusted content as text. Sanitize rich content with an established allowlist sanitizer only when rich HTML is explicitly required.",
    verification:
      "HTML and script payloads display harmlessly and never execute.",
    reference: "ASVS v5.0.0-3.2.2",
    enabled: true,
  },
  {
    id: "sessions",
    title: "Sessions & CSRF",
    requirement:
      "When cookie sessions exist, use HttpOnly, Secure and appropriate SameSite cookies, rotate sessions, expire and invalidate them; protect mutations with origin checks and CSRF tokens where required.",
    verification:
      "Cross-site mutations and expired or revoked sessions are rejected.",
    reference: "OWASP ASVS 5.0: Session Management chapter",
    enabled: true,
  },
  {
    id: "abuse",
    title: "Rate limits & abuse controls",
    requirement:
      "Protect costly, public, or sensitive endpoints with bounded payloads, timeouts, rate limits, and duplicate-request handling appropriate to their risk.",
    verification:
      "Burst requests are throttled and duplicate costly operations do not run twice.",
    reference: "OWASP ASVS 5.0: Secure Coding and Architecture chapter",
    enabled: true,
  },
  {
    id: "secrets",
    title: "Secrets & safe logging",
    requirement:
      "Keep credentials on the server in environment configuration; exclude secrets and sensitive content from client bundles, exports, logs, and errors. Log safe operation metadata only.",
    verification:
      "Inspect client bundles, error paths, logs and exports for credential or private-content leakage.",
    reference: "OWASP ASVS 5.0: Data Protection chapter",
    enabled: true,
  },
  {
    id: "uploads",
    title: "File upload restrictions",
    requirement:
      "If uploads exist, limit size and allowed file types, verify content signatures, generate safe storage names, isolate storage, and prevent uploaded content execution.",
    verification:
      "Oversized, mismatched-type, executable and traversal uploads are rejected.",
    reference: "OWASP ASVS 5.0: File Handling chapter",
    enabled: true,
  },
  {
    id: "lifecycle",
    title: "Retention, deletion & recovery",
    requirement:
      "For persistent data, define retention and deletion behavior, cascade dependent records as appropriate, restrict backup access, and document backup, restore and rollback procedures.",
    verification:
      "Deletion removes associated data as specified; a backup restores successfully and a rollback preserves consistency.",
    reference: "OWASP ASVS 5.0: Data Protection chapter",
    enabled: true,
  },
  {
    id: "payments",
    title: "Payment verification & idempotency",
    requirement:
      "If payments exist, verify webhook signatures, re-check prices and permissions on the server, record event IDs uniquely, and apply fulfillment transactionally exactly once.",
    verification:
      "Forged callbacks fail and replayed events cannot charge or fulfill twice.",
    reference: "Project-specific payment control; ASVS business-logic guidance",
    enabled: true,
  },
  {
    id: "accessibility",
    title: "Accessibility & responsive states",
    requirement:
      "Specify keyboard access, labels, focus visibility, readable contrast, responsive layout, and loading, empty, success and error states.",
    verification:
      "Complete primary workflows by keyboard and verify narrow screens and all state transitions.",
    reference: "WCAG 2.2 AA design target (not an ASVS control)",
    enabled: true,
  },
];
export function defaultSettings(): Settings {
  return {
    order: ["groq", "gemini", "openrouter", "cloudflare", "pollinations"],
    models: {},
    preferences: { stack: "", style: "", budget: "", hosting: "" },
    controls: DEFAULT_CONTROLS,
    groqMaxTokens: 3500,
    stream: true,
  };
}
