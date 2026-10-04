import type { ProviderId, Settings } from "./schema";
import { PROVIDER_IDS } from "./schema";

export type ErrorKind =
  | "rate_limit"
  | "too_large"
  | "auth"
  | "bad_request"
  | "server"
  | "network"
  | "truncated"
  | "invalid_output"
  | "cancelled"
  | "timeout";
export type RateInfo = { retryAfterMs?: number; resetTokensMs?: number };

export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: ErrorKind = "bad_request",
    public status: number | null = null,
    public rate: RateInfo = {},
  ) {
    super(message);
  }
}
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export type RouteInfo = {
  id: ProviderId;
  provider: string;
  model: string;
  /** True when the route holds the answer to a small per-minute allowance. */
  limited: boolean;
};
export type CompleteOptions = {
  settings: Settings;
  messages: ChatMessage[];
  signal: AbortSignal;
  onChunk?: (text: string) => void;
  /** Progress worth showing: waiting for a quota, moving on to the next provider. */
  onStatus?: (message: string) => void;
  /** Told which provider and model produced the answer that is returned. */
  onRoute?: (route: RouteInfo) => void;
  /** Restrict the attempt to one provider (connection test). */
  only?: ProviderId;
  /** Ignored by providers without a cap; capped providers use the smaller of this and their cap. */
  maxTokens?: number;
  streaming?: boolean;
};

type ProviderSpec = {
  id: ProviderId;
  label: string;
  keyEnv: string[];
  keyUrl: string;
  baseUrl: (env: NodeJS.ProcessEnv) => string;
  apiKey: (env: NodeJS.ProcessEnv) => string | undefined;
  fallbackKey: (env: NodeJS.ProcessEnv) => string | undefined;
  /** Used when Settings and the environment name no model. Empty means the person must pick one. */
  model: string;
  /** Cheapest model that still answers, used by the connection test so it costs next to nothing. */
  testModel?: string;
  maxTokensParam: "max_completion_tokens" | "max_tokens";
  /** The largest answer asked for. Providers without `tpm` get this and nothing smaller. */
  maxOutput: number;
  /** Tokens per minute (prompt plus answer) the free tier allows. Only Groq is held to one. */
  tpm?: number;
  extraBody?: (model: string) => Record<string, unknown>;
  note: string;
};

/**
 * Providers and their defaults live here and nowhere else. The routing mirrors INSPi: the chain is
 * the person's order, a provider without a key (or without a model) is skipped, a second key for
 * the same provider covers quota or auth failures, and any failure moves on to the next provider.
 */
export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  groq: {
    id: "groq",
    label: "Groq",
    keyEnv: ["GROQ_API_KEY"],
    keyUrl: "https://console.groq.com/keys",
    baseUrl: (env) => env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    apiKey: (env) => env.GROQ_API_KEY,
    fallbackKey: (env) => env.GROQ_API_KEY_FALLBACK,
    model: "openai/gpt-oss-120b",
    testModel: "openai/gpt-oss-20b",
    maxTokensParam: "max_completion_tokens",
    maxOutput: 8000,
    tpm: 8000,
    extraBody: (model) =>
      /gpt-oss/.test(model)
        ? { reasoning_effort: "low" }
        : /qwen3/.test(model)
          ? { reasoning_effort: "none" }
          : {},
    note: "Free tier: 8K tokens a minute. Its answers are capped; other providers are not.",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    keyEnv: ["GEMINI_API_KEY"],
    keyUrl: "https://aistudio.google.com/apikey",
    baseUrl: (env) =>
      env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: (env) => env.GEMINI_API_KEY,
    fallbackKey: (env) => env.GEMINI_API_KEY_FALLBACK,
    model: "gemini-flash-latest",
    testModel: "gemini-flash-lite-latest",
    maxTokensParam: "max_tokens",
    maxOutput: 32000,
    note: "Free tier on Flash models. Roomy answers.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: ["OPENROUTER_API_KEY"],
    keyUrl: "https://openrouter.ai/keys",
    baseUrl: (env) => env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: (env) => env.OPENROUTER_API_KEY,
    fallbackKey: (env) => env.OPENROUTER_API_KEY_FALLBACK,
    model: "google/gemma-4-31b-it",
    maxTokensParam: "max_tokens",
    maxOutput: 16000,
    note: "Free models are limited to about 50 requests a day. They go out by their plain id, without “:free”.",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    keyEnv: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    keyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    baseUrl: (env) =>
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID ?? ""}/ai/v1`,
    apiKey: (env) => env.CLOUDFLARE_API_TOKEN,
    fallbackKey: (env) => env.CLOUDFLARE_API_TOKEN_FALLBACK,
    model: "",
    maxTokensParam: "max_tokens",
    maxOutput: 4000,
    note: "Free allowance of 10,000 neurons a day. Pick a model to enable it.",
  },
  pollinations: {
    id: "pollinations",
    label: "Pollinations",
    keyEnv: ["POLLINATIONS_API_KEY"],
    keyUrl: "https://enter.pollinations.ai/keys",
    baseUrl: (env) =>
      env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai/v1",
    apiKey: (env) => env.POLLINATIONS_API_KEY,
    fallbackKey: (env) => env.POLLINATIONS_API_KEY_FALLBACK,
    model: "",
    maxTokensParam: "max_tokens",
    maxOutput: 16000,
    note: "Free Pollen. Community models come and go; pick a healthy one to enable it.",
  },
};

export type Route = {
  id: ProviderId;
  label: string;
  model: string;
  baseUrl: string;
  keys: string[];
  spec: ProviderSpec;
};

/** OpenRouter lists free models as `name:free`, but requests with that suffix are refused. */
export function requestModelId(provider: ProviderId, id: string) {
  return provider === "openrouter" ? id.replace(/:free$/, "") : id;
}
function hasKeys(spec: ProviderSpec, env: NodeJS.ProcessEnv) {
  return spec.keyEnv.every((name) => Boolean(env[name]?.trim()));
}
function modelFor(
  settings: Settings,
  spec: ProviderSpec,
  env: NodeJS.ProcessEnv,
) {
  const chosen =
    settings.models[spec.id]?.trim() ||
    env[`${spec.id.toUpperCase()}_MODEL`]?.trim() ||
    spec.model;
  return requestModelId(spec.id, chosen);
}
export function providerChain(
  settings: Settings,
  env: NodeJS.ProcessEnv = process.env,
  only?: ProviderId,
): Route[] {
  const routes: Route[] = [];
  for (const id of only ? [only] : settings.order) {
    const spec = PROVIDERS[id];
    if (!hasKeys(spec, env)) continue;
    const model = modelFor(settings, spec, env);
    if (!model) continue;
    const key = spec.apiKey(env)!.trim();
    const second = spec.fallbackKey(env)?.trim();
    routes.push({
      id,
      label: spec.label,
      model,
      baseUrl: spec.baseUrl(env),
      keys: second && second !== key ? [key, second] : [key],
      spec,
    });
  }
  return routes;
}
export function noRouteMessage(settings: Settings, only?: ProviderId) {
  const ids = only ? [only] : settings.order;
  const names = ids
    .filter((id) => !hasKeys(PROVIDERS[id], process.env))
    .map((id) => PROVIDERS[id].keyEnv.join(" + "));
  const keyless = ids.length === names.length;
  return keyless
    ? `No provider key is set. Add ${(only ? names : ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"]).join(" or ")} to .env in the project folder, then restart the dev server.`
    : "A key is set, but no model is chosen for it. Pick a model for that provider in Settings.";
}
/** What Settings shows for each provider. Never includes key values. */
export function providerInfo(
  settings: Settings,
  env: NodeJS.ProcessEnv = process.env,
) {
  return settings.order.map((id) => {
    const spec = PROVIDERS[id];
    return {
      id,
      label: spec.label,
      note: spec.note,
      keyEnv: spec.keyEnv,
      keyUrl: spec.keyUrl,
      hasKey: hasKeys(spec, env),
      hasFallbackKey: Boolean(spec.fallbackKey(env)?.trim()),
      defaultModel: modelFor({ ...settings, models: {} }, spec, env),
      model: modelFor(settings, spec, env),
      limited: Boolean(spec.tpm),
    };
  });
}
export function providerStatus() {
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, hasKeys(PROVIDERS[id], process.env)]),
  ) as Record<ProviderId, boolean>;
}

// ---- Output limits ---------------------------------------------------------------------------

const SAFETY = 0.95;
const CHARS_PER_TOKEN = 3.6;
/** Below this a structured answer cannot fit, so the provider is skipped instead. */
const MIN_OUTPUT = 900;
const estimateTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);

// Kept on globalThis so every request in the server process shares what it has learned.
const globals = globalThis as {
  __ipOutputCaps?: Map<string, number>;
  __ipBlocked?: Map<string, number>;
};
const learnedCaps = (globals.__ipOutputCaps ??= new Map<string, number>());
const blockedKeys = (globals.__ipBlocked ??= new Map<string, number>());

/** How many output tokens to ask for. Only a provider with a per-minute allowance is limited. */
export function outputBudget(
  route: Route,
  settings: Settings,
  messages: ChatMessage[],
  requested?: number,
): number {
  const { tpm, maxOutput } = route.spec;
  const want = requested ?? maxOutput;
  if (!tpm) return Math.min(want, maxOutput);
  const input = estimateTokens(messages.map((m) => m.content).join("")) + 60;
  const room = Math.floor(tpm * SAFETY) - input;
  const learned = learnedCaps.get(`${route.id}:${route.model}`) ?? Infinity;
  const cap = Math.min(settings.groqMaxTokens, want, room, learned, maxOutput);
  if (cap < MIN_OUTPUT)
    throw new ProviderError(
      `this request leaves only ${Math.max(0, cap)} output tokens under its per-minute allowance`,
      "too_large",
    );
  return cap;
}
function limitHint(maxTokens: number, retry: boolean) {
  return `\n\nOUTPUT LIMIT: this provider allows about ${maxTokens} tokens in total. Keep the entire JSON reply well under ${Math.floor(maxTokens * 0.8)} tokens: terse bullet points, one short sentence for each coverage reason and evidence, no phase prompts, no filler.${retry ? " Your previous reply was cut off; make this one much shorter and still complete valid JSON." : ""}`;
}

// ---- HTTP ------------------------------------------------------------------------------------

const UNIT_MS: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1000, ms: 1 };
/** Reads "7.66s", "2m59.56s", "120ms" or a bare number of seconds. */
export function parseDuration(value: string | null): number | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  let total = 0,
    matched = 0;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    total += Number(m[1]) * UNIT_MS[m[2]];
    matched += m[0].length;
  }
  return matched === text.length && matched > 0 ? Math.round(total) : undefined;
}
function readRate(headers: Headers): RateInfo {
  const rate: RateInfo = {
    retryAfterMs: parseDuration(headers.get("retry-after")),
    resetTokensMs: parseDuration(headers.get("x-ratelimit-reset-tokens")),
  };
  for (const key of Object.keys(rate) as (keyof RateInfo)[])
    if (rate[key] === undefined) delete rate[key];
  return rate;
}
function kindFor(status: number, detail: string): ErrorKind {
  // Groq answers 429 when one request alone exceeds a per-minute limit; waiting cannot fix that.
  if (status === 413 || /request too large|Requested \d+/i.test(detail))
    return "too_large";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status >= 500) return "server";
  return "bad_request";
}
/** The provider's own words, with any key removed. OpenRouter wraps the upstream message. */
function detailOf(raw: string, keys: string[]): string {
  let text = raw;
  try {
    const error = JSON.parse(raw)?.error;
    const inner =
      typeof error?.metadata?.raw === "string" ? ` (${error.metadata.raw})` : "";
    text =
      typeof error === "string"
        ? error
        : error?.message
          ? `${error.message}${inner}`
          : raw;
  } catch {
    /* not JSON: use as is */
  }
  for (const key of keys) if (key) text = text.split(key).join("***");
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}
async function boundedText(response: Response, max: number) {
  if (!response.body) return "";
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let output = "";
  try {
    while (output.length < max) {
      const part = await reader.read();
      if (part.done) break;
      output += decoder.decode(part.value, { stream: true });
    }
    return output.slice(0, max);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

type Attempt = {
  route: Route;
  key: string;
  messages: ChatMessage[];
  maxTokens: number;
  extras: boolean;
  streaming: boolean;
  signal: AbortSignal;
  onChunk?: (text: string) => void;
};

async function send(a: Attempt): Promise<string> {
  const { route, key } = a;
  const body = {
    model: route.model,
    messages: a.messages,
    stream: a.streaming,
    [route.spec.maxTokensParam]: a.maxTokens,
    ...(a.extras ? route.spec.extraBody?.(route.model) : {}),
  };
  let response: Response;
  try {
    response = await fetch(`${route.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: a.signal,
      cache: "no-store",
    });
  } catch {
    throw new ProviderError(`could not reach ${route.label}`, "network");
  }
  const rate = readRate(response.headers);
  if (!response.ok) {
    const detail = detailOf(await boundedText(response, 4000), route.keys);
    throw new ProviderError(
      detail || `HTTP ${response.status}`,
      kindFor(response.status, detail),
      response.status,
      rate,
    );
  }
  if (!a.streaming) {
    let data;
    try {
      data = JSON.parse(await boundedText(response, 400000));
    } catch {
      throw new ProviderError("it returned an unreadable response", "invalid_output");
    }
    if (data.error)
      throw new ProviderError(
        detailOf(JSON.stringify(data), route.keys) || "generation error",
        "server",
      );
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length")
      throw new ProviderError("the answer was cut off at its token limit", "truncated");
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new ProviderError("it returned no text", "invalid_output");
    a.onChunk?.(content);
    return content;
  }
  if (!response.body)
    throw new ProviderError("it did not stream a response", "invalid_output");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result = "",
    finished = false,
    wire = 0;
  const frame = (value: string) => {
    const payload = value
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!payload || payload === "[DONE]") return;
    const data = JSON.parse(payload);
    if (data.error)
      throw new ProviderError(
        "the stream was interrupted by the provider",
        "server",
      );
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length")
      throw new ProviderError("the answer was cut off at its token limit", "truncated");
    if (choice?.finish_reason === "stop") finished = true;
    if (["error", "content_filter", "tool_calls"].includes(choice?.finish_reason))
      throw new ProviderError("the model did not finish a text response", "invalid_output");
    const content = choice?.delta?.content;
    if (typeof content === "string") {
      result += content;
      if (result.length > 250000)
        throw new ProviderError("the output exceeded the text limit", "invalid_output");
      a.onChunk?.(content);
    }
  };
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      wire += part.value.length;
      if (wire > 4000000)
        throw new ProviderError("the stream exceeded the size limit", "invalid_output");
      buffer += decoder.decode(part.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        frame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (buffer.length > 250000)
        throw new ProviderError("the stream was invalid", "invalid_output");
    }
    buffer += decoder.decode();
    if (buffer.trim()) frame(buffer);
    if (!finished || !result.trim())
      throw new ProviderError("the stream ended before completion", "server");
    return result;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (a.signal.aborted) throw error;
    throw new ProviderError("the stream could not be read", "network");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// ---- Routing ---------------------------------------------------------------------------------

/** A wait longer than this means a spent quota; the next key or provider is tried instead. */
const MAX_WAIT_MS = 30_000;
const DEFAULT_BACKOFF_MS = 15_000;
const MARGIN_MS = 500;
const TRANSIENT_RETRY_MS = 2000;

function explain(error: unknown): string {
  if (!(error instanceof ProviderError))
    return error instanceof Error ? error.message : String(error);
  switch (error.kind) {
    case "auth":
      return `the API key was rejected (${error.message})`;
    case "rate_limit":
      return `the rate limit was hit (${error.message})`;
    case "truncated":
      return "the answer did not fit its output allowance";
    case "timeout":
      return "it timed out";
    default:
      return error.message;
  }
}
function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function runRoute(
  route: Route,
  options: CompleteOptions,
  signal: AbortSignal,
): Promise<string> {
  const { settings, onStatus } = options;
  const streaming = options.streaming ?? settings.stream;
  const limited = Boolean(route.spec.tpm);
  const capKey = `${route.id}:${route.model}`;
  const dead = new Set<number>();
  let lastError: unknown = new ProviderError("every key was rejected", "auth");
  let extras = true,
    terse = false,
    transient = false,
    shrink = 0;

  for (let step = 0; step < 4 + route.keys.length * 3; step++) {
    // The key that can go soonest.
    let best = -1,
      bestWait = Infinity;
    route.keys.forEach((key, i) => {
      if (dead.has(i)) return;
      const wait = Math.max(0, (blockedKeys.get(`${route.id}:${key}`) ?? 0) - Date.now());
      if (wait > MAX_WAIT_MS) return;
      if (wait < bestWait) [best, bestWait] = [i, wait];
    });
    if (best === -1) throw lastError;
    if (bestWait > 0) {
      onStatus?.(`Waiting ${Math.ceil(bestWait / 1000)}s for ${route.label} quota…`);
      await sleep(bestWait, signal);
      signal.throwIfAborted();
    }
    const key = route.keys[best];
    let messages = options.messages;
    let maxTokens = outputBudget(route, settings, messages, options.maxTokens);
    maxTokens = Math.max(MIN_OUTPUT, maxTokens - shrink);
    if (limited && messages[0]?.role === "system") {
      const [first, ...rest] = messages;
      messages = [
        { ...first, content: first.content + limitHint(maxTokens, terse) },
        ...rest,
      ];
    }
    try {
      return await send({
        route,
        key,
        messages,
        maxTokens,
        extras,
        streaming,
        signal,
        onChunk: options.onChunk,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (!(error instanceof ProviderError)) throw error;
      lastError = error;
      if (error.kind === "auth") {
        dead.add(best);
        continue;
      }
      if (error.kind === "rate_limit") {
        const wait =
          (error.rate.retryAfterMs ?? error.rate.resetTokensMs ?? DEFAULT_BACKOFF_MS) +
          MARGIN_MS;
        blockedKeys.set(`${route.id}:${key}`, Date.now() + wait);
        if (wait > MAX_WAIT_MS) dead.add(best);
        continue;
      }
      if (error.kind === "too_large" && limited) {
        // "…output tokens per minute: Limit 1000, Requested 1842" is a cap, not a delay.
        const m = /Limit (\d+),? Requested (\d+)/i.exec(error.message);
        if (m) {
          const [limit, requested] = [Number(m[1]), Number(m[2])];
          if (/output tokens/i.test(error.message)) learnedCaps.set(capKey, limit);
          else shrink += requested - limit + 64;
          if (maxTokens > MIN_OUTPUT) continue;
        }
        throw error;
      }
      if (error.kind === "truncated" && limited && !terse) {
        terse = true;
        continue;
      }
      if (error.kind === "bad_request" && extras && route.spec.extraBody) {
        // The model may not know the reasoning switch; plain requests always work.
        extras = false;
        continue;
      }
      if ((error.kind === "server" || error.kind === "network") && !transient) {
        transient = true;
        await sleep(TRANSIENT_RETRY_MS, signal);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * One chat completion. Providers are tried in the person's order, each with its own key(s); the
 * first that answers wins. Only Groq's answer is capped, because only its free tier allows so little.
 */
export async function complete(options: CompleteOptions): Promise<string> {
  const { settings, signal, onStatus } = options;
  const chain = providerChain(settings, process.env, options.only);
  if (!chain.length)
    throw new ProviderError(noRouteMessage(settings, options.only), "auth");
  const configured = Number(process.env.PROVIDER_TIMEOUT_MS || 90000);
  const perCall = Number.isFinite(configured)
    ? Math.max(10000, Math.min(180000, configured))
    : 90000;
  const reasons: string[] = [];
  for (const [index, route] of chain.entries()) {
    const timeout = AbortSignal.timeout(perCall);
    const combined = AbortSignal.any([signal, timeout]);
    try {
      const text = await runRoute(route, options, combined);
      options.onRoute?.({
        id: route.id,
        provider: route.label,
        model: route.model,
        limited: Boolean(route.spec.tpm),
      });
      return text;
    } catch (error) {
      if (signal.aborted)
        throw new ProviderError(
          "Generation cancelled. Previous work is intact.",
          "cancelled",
        );
      const reason = timeout.aborted ? "it timed out" : explain(error);
      reasons.push(`${route.label}: ${reason}`);
      if (index < chain.length - 1)
        onStatus?.(`${route.label} did not answer (${reason}). Trying ${chain[index + 1].label}…`);
    }
  }
  throw new ProviderError(
    `No provider could finish this. ${reasons.join(" · ")}`,
    "server",
  );
}

// ---- Model lists -----------------------------------------------------------------------------

const NOT_CHAT =
  /whisper|orpheus|voxtral|audio|guard|content-safety|-tts|tts-|embed|rerank|hy-mt|morph\/|relace\/|router|pareto|bodybuilder|fusion|:batch$/i;
type RawModel = {
  id?: string;
  name?: string;
  paid_only?: boolean | null;
  output_modalities?: string[];
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
};
/** Asks a provider which models its key can use. Costs no tokens, so it doubles as a connection check. */
export async function listModels(id: ProviderId, signal: AbortSignal) {
  const [route] = providerChain(
    { ...({} as Settings), order: [id], models: { [id]: "listing" } },
    process.env,
  );
  if (!route)
    throw new ProviderError(
      `Add ${PROVIDERS[id].keyEnv.join(" and ")} to .env and restart the server.`,
      "auth",
    );
  const url =
    id === "cloudflare"
      ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?per_page=200`
      : id === "pollinations"
        ? `${route.baseUrl.replace(/\/v1\/?$/, "")}/text/models?reliability=all`
        : `${route.baseUrl}/models`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${route.keys[0]}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError(`${route.label} could not be reached.`, "network");
  }
  if (response.status === 401 || response.status === 403)
    throw new ProviderError(`${route.label} rejected the key.`, "auth");
  if (!response.ok)
    throw new ProviderError(`${route.label} answered with status ${response.status}.`);
  const payload = JSON.parse((await boundedText(response, 6000000)) || "null");
  const raw: RawModel[] = Array.isArray(payload)
    ? payload
    : (payload?.data ?? payload?.result ?? []);
  const ids = new Map<string, boolean>();
  for (const m of raw) {
    const name = (m.id ?? m.name ?? "").replace(/^models\//, "").replace(/:free$/, "");
    const outputs = m.architecture?.output_modalities ?? m.output_modalities;
    if (!name || NOT_CHAT.test(name) || /^openrouter\/|^~/.test(name)) continue;
    if (m.paid_only === true) continue;
    if (outputs && outputs.some((kind) => kind !== "text")) continue;
    const free = m.pricing
      ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion ?? 0) === 0
      : false;
    ids.set(name, ids.get(name) || free);
  }
  return [...ids.entries()]
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .map(([model, free]) => ({ id: model, free }))
    .slice(0, 1500);
}
