import { api, body } from "@/lib/http";
import { store } from "@/lib/db";
import { settingsSchema } from "@/lib/schema";
import { providerInfo, providerStatus } from "@/lib/providers";
export async function GET(request: Request) {
  return api(request, () => {
    const current = store().settings();
    return {
      ...current,
      connected: providerStatus(),
      providers: providerInfo(current.value),
      checklistHistory: store().checklistHistory(),
    };
  });
}
export async function PUT(request: Request) {
  return api(request, async () => ({
    checklistVersion: store().saveSettings(await body(request, settingsSchema)),
  }));
}
