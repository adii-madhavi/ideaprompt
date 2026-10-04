import { api, body, rateLimit, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import {
  availableModels,
  complete,
  ProviderError,
  selectedModel,
} from "@/lib/providers";
import { providerSchema } from "@/lib/schema";
import { z } from "zod";
export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(
      request,
      z
        .object({
          action: z.enum(["models", "test"]),
          provider: providerSchema,
          model: z.string().max(150).optional(),
        })
        .strict(),
    );
    rateLimit();
    const settings = store().settings().value;
    settings.provider = input.provider;
    if (input.model !== undefined)
      settings.models[input.provider] = input.model;
    try {
      if (input.action === "models")
        return { models: await availableModels(settings, request.signal) };
      await complete({
        settings,
        messages: [
          { role: "user", content: "Respond with the word Connected." },
        ],
        maxTokens: 256,
        signal: request.signal,
      });
      return {
        ok: true,
        provider: settings.provider,
        model: selectedModel(settings),
        message: "Connection verified with a small real inference request.",
      };
    } catch (error) {
      throw new HttpError(
        502,
        error instanceof ProviderError
          ? error.message
          : "Connection test failed.",
      );
    }
  });
}
