import { api, body } from "@/lib/http";
import { store } from "@/lib/db";
import { projectSchema } from "@/lib/schema";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(request, () =>
    store().projects(
      new URL(request.url).searchParams.get("q")?.slice(0, 200) || "",
    ),
  );
}
export async function POST(request: Request) {
  return api(request, async () =>
    store().createProject(await body(request, projectSchema)),
  );
}
