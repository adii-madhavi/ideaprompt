import { api, body, rateLimit, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import {
  complete,
  listModels,
  PROVIDERS,
  ProviderError,
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
    // The connection test only needs any answer, so it uses the provider's cheapest model.
    const model =
      input.action === "test"
        ? PROVIDERS[input.provider].testModel || input.model
        : input.model;
    if (model !== undefined)
      settings.models = { ...settings.models, [input.provider]: model };
    try {
      if (input.action === "models")
        return { models: await listModels(input.provider, request.signal) };
      let used = "";
      await complete({
        settings,
        only: input.provider,
        messages: [
          { role: "user", content: "Respond with the word Connected." },
        ],
        maxTokens: 1024,
        streaming: false,
        signal: request.signal,
        onRoute: (route) => (used = route.model),
      });
      return {
        ok: true,
        provider: input.provider,
        model: used,
        message: `Connection verified: ${input.provider} answered with ${used}.`,
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
