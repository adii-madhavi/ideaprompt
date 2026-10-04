import { api, body } from "@/lib/http";
import { store } from "@/lib/db";
import { settingsSchema } from "@/lib/schema";
import { providerStatus } from "@/lib/providers";
export async function GET(request: Request) {
  return api(request, () => ({
    ...store().settings(),
    connected: providerStatus(),
    checklistHistory: store().checklistHistory(),
  }));
}
export async function PUT(request: Request) {
  return api(request, async () => ({
    checklistVersion: store().saveSettings(await body(request, settingsSchema)),
  }));
}
