import { body, localGuard, json, rateLimit, HttpError } from "@/lib/http";
import { generationSchema } from "@/lib/schema";
import { generate } from "@/lib/generate";
import { store } from "@/lib/db";
import { ProviderError } from "@/lib/providers";
import { runs } from "@/lib/runs";
export const runtime = "nodejs";
export const maxDuration = 360;
export async function POST(request: Request) {
  try {
    localGuard(request);
    const input = await body(request, generationSchema);
    rateLimit();
    if (runs.has(input.projectId))
      throw new HttpError(
        409,
        "Generation is already running for this project.",
      );
    const controller = new AbortController();
    runs.set(input.projectId, controller);
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const encoder = new TextEncoder();
    let open = true;
    const stream = new ReadableStream({
      async start(sink) {
        const emit = (data: unknown) => {
          if (open && !signal.aborted) {
            try {
              sink.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
            } catch {
              open = false;
              controller.abort();
            }
          }
        };
        try {
          await generate(store(), input, signal, emit);
        } catch (error) {
          emit({
            type: "error",
            message:
              error instanceof ProviderError || error instanceof HttpError
                ? error.message
                : "Generation failed. Previous work is intact.",
          });
        } finally {
          runs.delete(input.projectId);
          if (open) {
            open = false;
            try {
              sink.close();
            } catch {}
          }
        }
      },
      cancel() {
        open = false;
        controller.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Could not start generation.",
      },
      error instanceof HttpError ? error.status : 500,
    );
  }
}
export async function DELETE(request: Request) {
  try {
    localGuard(request);
    const { projectId } = await body(
      request,
      generationSchema.pick({ projectId: true }),
    );
    runs.get(projectId)?.abort();
    return json({ ok: true });
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError ? error.message : "Cancellation failed.",
      },
      error instanceof HttpError ? error.status : 500,
    );
  }
}
