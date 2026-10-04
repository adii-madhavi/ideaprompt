import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function localGuard(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new HttpError(
      403,
      "This application is available on localhost only.",
    );
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site")
    throw new HttpError(403, "Cross-site requests are not allowed.");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin !== `${url.protocol}//${host}`)
      throw new HttpError(
        403,
        "A matching localhost Origin header is required.",
      );
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw new HttpError(415, "Send application/json.");
  }
}
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const MAX = 128000;
  if (Number(request.headers.get("content-length") || 0) > MAX)
    throw new HttpError(413, "Request exceeds 128 KB.");
  if (!request.body)
    throw new HttpError(400, "A JSON request body is required.");
  const reader = request.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX) {
        await reader.cancel();
        throw new HttpError(413, "Request exceeds 128 KB.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      error instanceof z.ZodError
        ? "Invalid input: " +
            error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
              .slice(0, 1000)
        : "Invalid JSON body.",
    );
  } finally {
    reader.releaseLock();
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function api(
  request: Request,
  action: () => unknown | Promise<unknown>,
) {
  try {
    localGuard(request);
    return json(await action());
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "The local operation failed. Your previous work is intact.",
      },
      error instanceof HttpError ? error.status : 500,
    );
  }
}
export function uuid(value: string) {
  if (!z.string().uuid().safeParse(value).success)
    throw new HttpError(400, "Invalid record ID.");
  return value;
}
const recent: number[] = [];
export function rateLimit() {
  const now = Date.now();
  while (recent.length && recent[0] < now - 60000) recent.shift();
  if (recent.length >= 8)
    throw new HttpError(
      429,
      "Too many provider requests. Wait a minute before trying again.",
    );
  recent.push(now);
}
