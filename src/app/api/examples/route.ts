import { api, body, uuid, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import { exampleSchema } from "@/lib/schema";
import { z } from "zod";
export async function GET(request: Request) {
  return api(request, () =>
    store().examples(
      new URL(request.url).searchParams.get("q")?.slice(0, 200) || "",
    ),
  );
}
export async function POST(request: Request) {
  return api(request, async () => {
    const value = await body(
      request,
      exampleSchema.extend({ id: z.string().uuid().optional() }),
    );
    if (value.projectId && !store().project(value.projectId))
      throw new HttpError(404, "Project not found.");
    return { id: store().saveExample(value, value.id) };
  });
}
export async function DELETE(request: Request) {
  return api(request, async () => {
    const value = await body(
      request,
      z.object({ id: z.string().uuid() }).strict(),
    );
    store().deleteExample(uuid(value.id));
    return { ok: true };
  });
}
