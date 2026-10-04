import { api, body, uuid, HttpError } from "@/lib/http";
import { store } from "@/lib/db";
import { projectSchema } from "@/lib/schema";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  return api(request, async () => {
    const id = uuid((await params).id),
      db = store(),
      project = db.project(id);
    if (!project) throw new HttpError(404, "Project not found.");
    return { project, messages: db.messages(id), versions: db.versions(id) };
  });
}
export async function PATCH(request: Request, { params }: Params) {
  return api(request, async () => {
    const id = uuid((await params).id);
    if (!store().project(id)) throw new HttpError(404, "Project not found.");
    return store().updateProject(id, await body(request, projectSchema));
  });
}
export async function DELETE(request: Request, { params }: Params) {
  return api(request, async () => {
    store().deleteProject(uuid((await params).id));
    return { ok: true };
  });
}
