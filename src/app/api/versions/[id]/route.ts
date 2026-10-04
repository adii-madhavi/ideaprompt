import { api, body, uuid, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import { feedbackSchema, draftSchema } from "@/lib/schema";
import { z } from "zod";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  return api(request, async () => {
    const changed = store().feedback(
      uuid((await params).id),
      await body(request, feedbackSchema),
    );
    if (!changed) throw new HttpError(404, "Version not found.");
    return { ok: true };
  });
}
export async function DELETE(request: Request, { params }: Params) {
  return api(request, async () => {
    store().deleteVersion(uuid((await params).id));
    return { ok: true };
  });
}
export async function PUT(request: Request, { params }: Params) {
  return api(request, async () => {
    const value = await body(
      request,
      z.object({ draft: draftSchema }).strict(),
    );
    const draft = store().editVersion(uuid((await params).id), value.draft);
    if (!draft) throw new HttpError(404, "Version not found.");
    return { draft };
  });
}
