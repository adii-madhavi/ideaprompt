import {
  complete,
  providerChain,
  noRouteMessage,
  ProviderError,
  type CompleteOptions,
  type RouteInfo,
} from "./providers";
import {
  generationMessages,
  parseDraft,
  reviewMessages,
  reviewCoverage,
  structureIssues,
} from "./prompts";
import { Store } from "./db";
import type { GenerationInput } from "./schema";
import { HttpError } from "./http";

export async function generate(
  db: Store,
  input: GenerationInput,
  signal: AbortSignal,
  emit: (event: unknown) => void,
  call: (options: CompleteOptions) => Promise<string> = complete,
) {
  const project = db.project(input.projectId);
  if (!project) throw new HttpError(404, "Project not found.");
  const { value: settings, checklistVersion } = db.settings();
  const chain = providerChain(settings);
  if (call === complete && !chain.length)
    throw new HttpError(400, noRouteMessage(settings));
  const selected = db
    .examples()
    .filter(
      (e) =>
        input.exampleIds.includes(e.id) &&
        (e.projectId === null || e.projectId === input.projectId),
    );
  if (selected.length !== input.exampleIds.length)
    throw new HttpError(
      400,
      "Selected examples must exist and belong to this project or your reusable library.",
    );
  try {
    db.beginRun(input);
  } catch {
    throw new HttpError(
      409,
      "This request already exists or a generation is active for this project.",
    );
  }
  let chars = 0;
  const onChunk = (text: string) => {
    chars += text.length;
    emit({ type: "progress", characters: chars });
  };
  const onStatus = (message: string) => emit({ type: "status", message });
  // The provider that answered last is the one recorded on the saved version.
  let used: RouteInfo = {
    id: chain[0]?.id ?? "groq",
    provider: chain[0]?.label ?? "custom",
    model: chain[0]?.model ?? "custom",
    limited: false,
  };
  const options = (messages: CompleteOptions["messages"]): CompleteOptions => ({
    settings,
    messages,
    signal,
    onChunk,
    onStatus,
    onRoute: (route) => (used = route),
  });
  try {
    emit({
      type: "status",
      message: chain.length
        ? `Drafting with ${chain.map((r) => r.label).join(" → ")}`
        : "Drafting…",
    });
    const messages = generationMessages(
      input,
      project,
      settings,
      db.messages(project.id, 8),
      selected,
    );
    const raw = await call(options(messages));
    signal.throwIfAborted();
    let parsed;
    try {
      parsed = parseDraft(raw);
    } catch {
      /* The review pass also repairs malformed model output. */
    }
    // A provider with a small per-minute allowance cannot afford a second full pass, so a draft that
    // already parses and has its structure is kept as it is.
    const clean =
      parsed &&
      parsed.kind === "draft" &&
      used.limited &&
      !structureIssues(parsed, input.mode).length;
    if (parsed?.kind !== "questions" && !clean) {
      emit({
        type: "status",
        message: "Reviewing requirements and repairing checklist omissions…",
      });
      const reviewed = await call(
        options(reviewMessages(messages, raw, settings.controls, input.mode)),
      );
      try {
        parsed = parseDraft(reviewed);
      } catch {
        throw new ProviderError(
          "The model returned invalid structured output after review. Try a different provider or model.",
          "invalid_output",
        );
      }
    }
    if (!parsed)
      throw new ProviderError("The model did not return a valid draft.");
    const issues = structureIssues(parsed, input.mode);
    if (issues.length)
      throw new ProviderError(
        "The reviewed output omitted required structure. Regenerate or select a more capable model. " +
          issues.slice(0, 3).join("; "),
      );
    const draft = reviewCoverage(parsed, settings.controls, input.mode);
    signal.throwIfAborted();
    db.finishRun(input, draft, used.provider, checklistVersion, used.model);
    emit({ type: "complete", draft });
    return draft;
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : signal.aborted
          ? "Generation cancelled. Previous work is intact."
          : "Generation failed validation or storage. Previous work is intact; please retry.";
    db.failRun(input.requestId, message, signal.aborted);
    throw new ProviderError(message);
  }
}
