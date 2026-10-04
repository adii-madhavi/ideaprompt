import {
  complete,
  selectedModel,
  credentials,
  ProviderError,
  type CompleteOptions,
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
  const model = selectedModel(settings);
  if (call === complete) credentials(settings.provider);
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
  try {
    emit({
      type: "status",
      message: `Drafting with ${settings.provider} · ${model}`,
      provider: settings.provider,
      model,
    });
    const messages = generationMessages(
      input,
      project,
      settings,
      db.messages(project.id, 8),
      selected,
    );
    const raw = await call({ settings, messages, signal, onChunk });
    signal.throwIfAborted();
    let parsed;
    try {
      parsed = parseDraft(raw);
    } catch {
      /* The review pass also repairs malformed model output. */
    }
    if (parsed?.kind !== "questions") {
      emit({
        type: "status",
        message: "Reviewing requirements and repairing checklist omissions…",
      });
      const reviewed = await call({
        settings,
        messages: reviewMessages(messages, raw, settings.controls, input.mode),
        signal,
        onChunk,
      });
      try {
        parsed = parseDraft(reviewed);
      } catch {
        throw new ProviderError(
          "The model returned invalid structured output after review. Try a different model or a larger token limit.",
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
    db.finishRun(input, draft, settings, checklistVersion, model);
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
