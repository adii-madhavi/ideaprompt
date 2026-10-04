import type { Settings } from "./schema";

export class ProviderError extends Error {}
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export type CompleteOptions = {
  settings: Settings;
  messages: ChatMessage[];
  signal: AbortSignal;
  onChunk?: (text: string) => void;
  maxTokens?: number;
  streaming?: boolean;
};
const ENDPOINTS = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};
// General-purpose chat models in Groq's Free Plan Limits, checked 2026-10-03.
// Intersect with the live catalog so removed models cannot be selected.
const GROQ_FREE_CHAT_MODELS = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
]);
type CatalogModel = {
  id?: unknown;
  active?: boolean;
  pricing?: Record<string, unknown>;
  architecture?: { output_modalities?: string[] };
};
function isFreeChatModel(provider: Settings["provider"], model: CatalogModel) {
  if (typeof model.id !== "string") return false;
  if (provider === "groq")
    return model.active !== false && GROQ_FREE_CHAT_MODELS.has(model.id);
  const zeroPrice = (price: unknown) =>
    (typeof price === "number" ||
      (typeof price === "string" && price.trim() !== "")) &&
    Number(price) === 0;
  return (
    model.id.endsWith(":free") &&
    model.architecture?.output_modalities?.includes("text") &&
    zeroPrice(model.pricing?.prompt) &&
    zeroPrice(model.pricing?.completion) &&
    Object.values(model.pricing || {}).every(zeroPrice)
  );
}
export function credentials(provider: Settings["provider"]) {
  const key =
    process.env[provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"];
  if (!key || key.startsWith("your_"))
    throw new ProviderError(
      `Add ${provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"} to .env.local, then restart the application.`,
    );
  return key;
}
export function selectedModel(settings: Settings) {
  const model = settings.models[settings.provider].trim();
  if (
    !model ||
    !/^[a-zA-Z0-9/_.:@+-]{1,150}$/.test(model) ||
    model === "openrouter/auto"
  )
    throw new ProviderError(
      "Choose a specific currently available model in Settings. Automatic model routing is disabled.",
    );
  return model;
}
export function providerStatus() {
  return Object.fromEntries(
    (["groq", "openrouter"] as const).map((p) => {
      try {
        credentials(p);
        return [p, true];
      } catch {
        return [p, false];
      }
    }),
  ) as Record<Settings["provider"], boolean>;
}
function statusError(status: number) {
  return new ProviderError(
    (
      {
        400: "The model rejected this request. Check its chat, streaming and token-limit support in Settings.",
        401: "The provider rejected the API key. Check the server environment and restart.",
        403: "The provider denied access. Check key permissions and account privacy settings.",
        402: "The provider account needs credits. No other provider was used.",
        404: "This model is unavailable. Select an available model in Settings.",
        429: "The provider rate limit was reached. Wait and try again.",
        503: "No eligible provider endpoint is available. Check the model and privacy restrictions.",
      } as Record<number, string>
    )[status] ||
      `The provider returned HTTP ${status}. Try again later; previous versions are intact.`,
  );
}
async function boundedText(response: Response, max = 400000) {
  if (!response.body)
    throw new ProviderError("The provider returned an empty response.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let output = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      output += decoder.decode(part.value, { stream: true });
      if (output.length > max) {
        await reader.cancel();
        throw new ProviderError(
          "Provider response exceeded the configured size limit.",
        );
      }
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function complete(options: CompleteOptions): Promise<string> {
  const { settings, messages, signal, onChunk } = options;
  if (settings.provider === "groq" && !settings.groqFreePlanConfirmed)
    throw new ProviderError(
      "Confirm your Groq organization is on the Free plan in Settings before using Groq. Developer plan usage is billed.",
    );
  const streaming = options.streaming ?? settings.stream;
  const model = selectedModel(settings),
    key = credentials(settings.provider);
  const configured = Number(process.env.PROVIDER_TIMEOUT_MS || 90000);
  const timeout = AbortSignal.timeout(
    Number.isFinite(configured)
      ? Math.max(10000, Math.min(180000, configured))
      : 90000,
  );
  const combined = AbortSignal.any([signal, timeout]);
  try {
    if (!(await availableModels(settings, combined)).includes(model))
      throw new ProviderError(
        "This model is not in the current free chat catalog. Select a free model in Settings.",
      );
    const maxTokens = options.maxTokens ?? settings.maxTokens;
    const response = await fetch(
      `${ENDPOINTS[settings.provider]}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: streaming,
          ...(settings.provider === "groq"
            ? { max_completion_tokens: maxTokens }
            : {
                max_tokens: maxTokens,
                provider: {
                  data_collection: "deny",
                  zdr: settings.openRouterZdr,
                  allow_fallbacks: false,
                  require_parameters: true,
                  max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
                },
              }),
        }),
        signal: combined,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw statusError(response.status);
    }
    if (!streaming) {
      const data = JSON.parse(await boundedText(response));
      if (data.error)
        throw new ProviderError(
          "The provider reported a generation error. Check model availability and retry.",
        );
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length")
        throw new ProviderError(
          "Output reached the token limit. Increase the limit or narrow the request.",
        );
      if (
        choice?.finish_reason !== "stop" ||
        typeof choice?.message?.content !== "string" ||
        !choice.message.content.trim()
      )
        throw new ProviderError(
          "The provider did not return a complete text response. Select a compatible chat model.",
        );
      onChunk?.(choice.message.content);
      return choice.message.content;
    }
    if (!response.body)
      throw new ProviderError(
        "Streaming is unavailable for this model. Disable streaming in Settings.",
      );
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      result = "",
      finished = false,
      wireSize = 0;
    const frame = (value: string) => {
      const payload = value
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!payload) return;
      if (payload === "[DONE]") return;
      const data = JSON.parse(payload);
      if (data.error)
        throw new ProviderError(
          "The provider interrupted generation. Previous work is intact; retry or choose a different model.",
        );
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length")
        throw new ProviderError(
          "Output reached the token limit. Increase it in Settings or narrow the request.",
        );
      if (choice?.finish_reason === "stop") finished = true;
      if (
        ["error", "content_filter", "tool_calls"].includes(
          choice?.finish_reason,
        )
      )
        throw new ProviderError(
          "The model did not finish a text response. Choose a compatible chat model.",
        );
      const content = choice?.delta?.content;
      if (typeof content === "string") {
        result += content;
        if (result.length > 250000)
          throw new ProviderError("Output exceeded the text limit.");
        onChunk?.(content);
      }
    };
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        wireSize += part.value.length;
        if (wireSize > 4000000)
          throw new ProviderError("Provider stream exceeded the size limit.");
        buffer += decoder.decode(part.value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          frame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
        }
        if (buffer.length > 250000)
          throw new ProviderError("Invalid provider stream.");
      }
      buffer += decoder.decode();
      if (buffer.trim()) frame(buffer);
      if (!finished || !result.trim())
        throw new ProviderError(
          "The provider stream ended before completion. Previous versions are intact.",
        );
      return result;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) {
    if (signal.aborted)
      throw new ProviderError("Generation cancelled. Previous work is intact.");
    if (timeout.aborted)
      throw new ProviderError(
        "The provider timed out. Try again or simplify the request.",
      );
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "Could not complete the provider request. Check the connection, model and streaming settings.",
    );
  }
}
export async function availableModels(settings: Settings, signal: AbortSignal) {
  try {
    const response = await fetch(`${ENDPOINTS[settings.provider]}/models`, {
      headers: { Authorization: `Bearer ${credentials(settings.provider)}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw statusError(response.status);
    }
    const payload = JSON.parse(await boundedText(response, 6000000));
    if (!Array.isArray(payload.data))
      throw new ProviderError(
        "The provider returned an invalid model catalog.",
      );
    return payload.data
      .filter((m: CatalogModel) => m && isFreeChatModel(settings.provider, m))
      .map((m: CatalogModel) => m.id as string)
      .slice(0, 1500);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      "Could not load the provider's model catalog. Check the connection and refresh the model list.",
    );
  }
}
