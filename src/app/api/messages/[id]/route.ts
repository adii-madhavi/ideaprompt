import { api, body, uuid, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import { z } from "zod";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  return api(request, async () => {
    const value = await body(
      request,
      z.object({ content: z.string().trim().min(1).max(70000) }).strict(),
    );
    if (!store().editMessage(uuid((await params).id), value.content))
      throw new HttpError(404, "Message not found.");
    return { ok: true };
  });
}
export async function DELETE(request: Request, { params }: Params) {
  return api(request, async () => {
    store().deleteMessage(uuid((await params).id));
    return { ok: true };
  });
}
