import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw new Error("Smoke checks are limited to local HTTP servers.");
async function call(
  path: string,
  method = "GET",
  data?: unknown,
  customOrigin = origin,
) {
  return fetch(origin + path, {
    method,
    headers: {
      ...(data === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: customOrigin }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function main() {
  let id: string | undefined;
  try {
    assert.equal((await call("/")).status, 200);
    assert.equal(
      (await call("/api/projects", "POST", {}, "https://untrusted.example"))
        .status,
      403,
    );
    assert.equal((await call("/api/projects", "POST", {})).status, 400);
    const response = await call("/api/projects", "POST", {
      title: "Temporary HTTP verification " + randomUUID(),
      idea: "A static portfolio with no accounts",
      context: { notes: "Test-only fixture" },
    });
    assert.equal(response.status, 200);
    const project = await response.json();
    id = project.id;
    const detail = await (await call(`/api/projects/${id}`)).json();
    assert.equal(detail.project.idea, project.idea);
    assert.deepEqual(detail.versions, []);
    const exported = await (await call("/api/data")).json();
    assert.ok(exported.projects.some((p: { id: string }) => p.id === id));
    const settings = await (await call("/api/settings")).json();
    const provider = settings.value.order[0];
    if (!Object.values(settings.connected).some(Boolean)) {
      const test = await call("/api/provider", "POST", {
        action: "test",
        provider,
        model: "test-unavailable-model",
      });
      assert.equal(test.status, 502);
      assert.match((await test.json()).error, /\.env/);
      const generate = await call("/api/generate", "POST", {
        projectId: id,
        requestId: randomUUID(),
        message: project.idea,
        mode: "prompt",
        approach: "quick",
        tool: "Generic",
        exampleIds: [],
      });
      const text = await generate.text();
      assert.match(text, /"type":"error"/);
      assert.equal(
        (await (await call(`/api/projects/${id}`)).json()).versions.length,
        0,
      );
      console.log(
        "PASS missing credentials produce useful errors without creating artifacts",
      );
    } else
      console.log(
        "SKIP missing-key checks: a real provider key is configured; no billable inference is initiated.",
      );
    console.log(
      "PASS live HTTP project persistence, export, body validation and cross-origin protection",
    );
  } finally {
    if (id)
      assert.equal(
        (await call(`/api/projects/${id}`, "DELETE", {})).status,
        200,
      );
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Smoke check failed");
  process.exitCode = 1;
});
