import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../src/lib/db";
import { generate } from "../src/lib/generate";
import { availableModels, complete, ProviderError } from "../src/lib/providers";
import { DEFAULT_CONTROLS, defaultSettings } from "../src/lib/checklist";
import { PROMPT_SECTIONS, reviewCoverage } from "../src/lib/prompts";
import { localGuard, body } from "../src/lib/http";
import {
  generationSchema,
  settingsSchema,
  type Draft,
  type GenerationInput,
} from "../src/lib/schema";

const freeModel = {
  id: "test/model:free",
  pricing: { prompt: "0", completion: "0", request: "0" },
  architecture: { output_modalities: ["text"] },
};
function withCatalog(inference: typeof fetch): typeof fetch {
  return async (url, init) =>
    String(url).endsWith("/models")
      ? Response.json({ data: [freeModel] })
      : inference(url, init);
}

const context = {
  notes: "",
  budget: "",
  stack: "",
  hosting: "",
  audience: "",
  deadline: "",
};
function setup(path = ":memory:") {
  const db = new Store(path),
    settings = db.settings().value;
  settings.models.groq = "test-model";
  db.saveSettings(settings);
  const p = db.createProject({
    title: "Portfolio",
    idea: "A static portfolio",
    context,
  });
  const input: GenerationInput = {
    projectId: p.id,
    requestId: randomUUID(),
    message: p.idea,
    mode: "prompt",
    approach: "quick",
    tool: "Generic",
    exampleIds: [],
  };
  return { db, input };
}
function fixture(): Draft {
  return {
    kind: "draft",
    refinedIdea: "A static portfolio.",
    implementationPlan: "Use static HTML and CSS.",
    executionPrompt: PROMPT_SECTIONS.map(
      (s) =>
        `## ${s}\n${s === "Security" ? "Render untrusted content as text. Test that scripts display harmlessly." : "Test fixture requirement."}`,
    ).join("\n\n"),
    phasePrompts: [],
    assumptions: ["No account system is needed."],
    questions: [],
    coverage: DEFAULT_CONTROLS.map((c) => ({
      id: c.id,
      status:
        c.id === "rendering"
          ? ("specified" as const)
          : ("not applicable" as const),
      reason:
        c.id === "rendering"
          ? "Safe text handling is specified."
          : "Static test fixture without server data.",
      evidence: c.id === "rendering" ? "Render untrusted content as text." : "",
      verification:
        c.id === "rendering" ? "Test that scripts display harmlessly." : "",
    })),
  };
}
test("persistent projects, reviewed versions, feedback and checklist revisions survive restart; failed generation preserves earlier work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ideaprompt-test-")),
    path = join(dir, "test.sqlite");
  const { db, input } = setup(path);
  try {
    let calls = 0;
    await generate(
      db,
      input,
      new AbortController().signal,
      () => {},
      async (o) => {
        calls++;
        o.onChunk?.("draft");
        return JSON.stringify(fixture());
      },
    );
    assert.equal(calls, 2, "Drafts must pass through a separate review call");
    const before = db.versions(input.projectId);
    assert.equal(before.length, 1);
    assert.equal(db.messages(input.projectId).length, 2);
    db.feedback(before[0].id, {
      rating: 4,
      correction: "Use simpler CSS",
      outcome: "Built successfully",
    });
    const originalRevision = db.settings().checklistVersion,
      changed = db.settings().value;
    changed.controls = changed.controls.map((c) =>
      c.id === "auth" ? { ...c, enabled: false } : c,
    );
    db.saveSettings(changed);
    assert.notEqual(db.settings().checklistVersion, originalRevision);
    await assert.rejects(
      generate(
        db,
        { ...input, requestId: randomUUID(), message: "A later request" },
        new AbortController().signal,
        () => {},
        async () => {
          throw new ProviderError("Rate limit reached");
        },
      ),
      /Rate limit reached/,
    );
    assert.equal(db.versions(input.projectId).length, 1);
    assert.equal(db.messages(input.projectId).length, 2);
    db.close();
    const reopened = new Store(path);
    try {
      assert.equal(
        reopened.project(input.projectId)?.idea,
        "A static portfolio",
      );
      const saved = reopened.versions(input.projectId)[0];
      assert.equal(saved.rating, 4);
      assert.equal(saved.checklistVersion, originalRevision);
      assert.equal(saved.checklist.length, DEFAULT_CONTROLS.length);
      assert.equal(reopened.exportData().projects.length, 1);
      reopened.deleteProject(input.projectId);
      assert.equal(reopened.versions(input.projectId).length, 0);
      assert.equal(reopened.messages(input.projectId).length, 0);
    } finally {
      reopened.close();
    }
  } finally {
    try {
      db.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
});
test("review failure and cancellation never persist a half-generated version", async () => {
  const { db, input } = setup();
  try {
    let count = 0;
    await assert.rejects(
      generate(
        db,
        input,
        new AbortController().signal,
        () => {},
        async () =>
          ++count === 1 ? JSON.stringify(fixture()) : "invalid json",
      ),
      /invalid structured output/,
    );
    assert.equal(db.versions(input.projectId).length, 0);
    const abort = new AbortController();
    await assert.rejects(
      generate(
        db,
        { ...input, requestId: randomUUID() },
        abort.signal,
        () => {},
        async () => {
          abort.abort();
          return JSON.stringify(fixture());
        },
      ),
      /cancelled/,
    );
    assert.equal(db.messages(input.projectId).length, 0);
    assert.equal(
      db.db
        .prepare("SELECT COUNT(*) AS n FROM runs WHERE status='pending'")
        .get()?.n,
      0,
    );
  } finally {
    db.close();
  }
});
test("duplicate request IDs cannot incur a second generation or create duplicate versions", async () => {
  const { db, input } = setup();
  let count = 0;
  try {
    const call = async () => {
      count++;
      return JSON.stringify(fixture());
    };
    await generate(db, input, new AbortController().signal, () => {}, call);
    await assert.rejects(
      generate(db, input, new AbortController().signal, () => {}, call),
      /already exists/,
    );
    assert.equal(count, 2);
  } finally {
    db.close();
  }
});
test("clarification rounds save at most three questions without pretending to review an unfinished specification", async () => {
  const { db, input } = setup();
  let count = 0;
  try {
    await generate(
      db,
      { ...input, approach: "clarify" },
      new AbortController().signal,
      () => {},
      async () => {
        count++;
        return JSON.stringify({
          ...fixture(),
          kind: "questions",
          questions: ["Who can access this portal?"],
          refinedIdea: "",
          implementationPlan: "",
          executionPrompt: "",
          coverage: [],
        });
      },
    );
    assert.equal(count, 1);
    assert.equal(db.versions(input.projectId)[0].draft.kind, "questions");
    assert.equal(db.versions(input.projectId)[0].draft.coverage.length, 0);
  } finally {
    db.close();
  }
});
test("unsupported evidence and omitted checklist controls are marked missing; manual edits invalidate coverage", async () => {
  const draft = fixture();
  draft.coverage = [
    {
      ...draft.coverage.find((c) => c.id === "rendering")!,
      evidence: "Imaginary evidence",
    },
  ];
  const reviewed = reviewCoverage(draft, DEFAULT_CONTROLS, "prompt");
  assert.ok(reviewed.coverage.every((c) => c.status === "missing"));
  const { db, input } = setup();
  try {
    await generate(
      db,
      input,
      new AbortController().signal,
      () => {},
      async () => JSON.stringify(fixture()),
    );
    const updated = db.editVersion(
      db.versions(input.projectId)[0].id,
      fixture(),
    );
    assert.ok(updated?.coverage.every((c) => c.status === "missing"));
  } finally {
    db.close();
  }
});
test("parameterized search treats injection and wildcard payloads literally; project associations cascade", () => {
  const { db, input } = setup();
  try {
    assert.equal(db.projects("%' OR 1=1 --").length, 0);
    assert.equal(db.projects("%").length, 0);
    db.saveExample({
      projectId: input.projectId,
      title: "Approved",
      content: "Private reference",
    });
    assert.equal(db.examples().length, 1);
    db.deleteProject(input.projectId);
    assert.equal(db.examples().length, 0);
  } finally {
    db.close();
  }
});
test("localhost mutations require same origin and JSON; bodies and clarification shapes are bounded", async () => {
  const valid = new Request("http://127.0.0.1:3000/api/projects", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.doesNotThrow(() => localGuard(valid));
  assert.throws(
    () =>
      localGuard(
        new Request(valid, {
          headers: {
            host: "127.0.0.1:3000",
            origin: "https://evil.example",
            "content-type": "application/json",
          },
        }),
      ),
    /matching localhost/,
  );
  assert.throws(
    () => localGuard(new Request("http://evil.example/api/data")),
    /localhost/,
  );
  const large = new Request("http://localhost:3000/api/generate", {
    method: "POST",
    body: "x".repeat(128001),
  });
  await assert.rejects(body(large, generationSchema), /128 KB/);
  const { input, db } = setup();
  try {
    assert.equal(
      generationSchema.safeParse({ ...input, message: "x".repeat(16001) })
        .success,
      false,
    );
  } finally {
    db.close();
  }
});
test("provider streaming handles fragmented UTF-8, SSE comments, terminal markers, privacy controls and errors without leaking provider messages", async () => {
  const original = globalThis.fetch,
    oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-secret-only";
  const { db } = setup();
  const settings = db.settings().value;
  settings.provider = "openrouter";
  settings.models.openrouter = "test/model:free";
  try {
    let sent: Record<string, unknown> = {};
    globalThis.fetch = withCatalog(async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      const encoded = new TextEncoder().encode(
        ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"Hello ₹"},"finish_reason":null}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n',
      );
      return new Response(
        new ReadableStream({
          start(c) {
            for (let i = 0; i < encoded.length; i += 3)
              c.enqueue(encoded.slice(i, i + 3));
            c.close();
          },
        }),
      );
    });
    assert.equal(
      await complete({
        settings,
        messages: [{ role: "user", content: "Test" }],
        signal: new AbortController().signal,
      }),
      "Hello ₹",
    );
    assert.deepEqual(sent.provider, {
      data_collection: "deny",
      zdr: true,
      allow_fallbacks: false,
      require_parameters: true,
      max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
    });
    globalThis.fetch = withCatalog(
      async () =>
        new Response('data: {"error":{"message":"test-secret-only"}}\n\n'),
    );
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      (e) =>
        e instanceof Error &&
        !e.message.includes("test-secret-only") &&
        /interrupted/.test(e.message),
    );
    globalThis.fetch = withCatalog(
      async () =>
        new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'),
    );
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      /before completion/,
    );
    globalThis.fetch = withCatalog(
      async () => new Response("key leaked upstream", { status: 401 }),
    );
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      /rejected the API key/,
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    db.close();
  }
});

test("free-only catalog and inference reject paid, unknown-priced, non-chat and stale models before sending ideas", async () => {
  const original = globalThis.fetch,
    oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-secret-only";
  const settings = defaultSettings();
  settings.provider = "openrouter";
  let catalog = [
    freeModel,
    {
      ...freeModel,
      id: "test/paid:free",
      pricing: { prompt: "0.01", completion: "0" },
    },
    { ...freeModel, id: "test/unknown:free", pricing: {} },
    {
      ...freeModel,
      id: "test/fee:free",
      pricing: { ...freeModel.pricing, request: "0.01" },
    },
    {
      ...freeModel,
      id: "test/audio:free",
      architecture: { output_modalities: ["audio"] },
    },
    { ...freeModel, id: "openrouter/free" },
    { ...freeModel, id: "openrouter/auto" },
  ];
  let inferenceCalls = 0;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/models"))
        return Response.json({ data: catalog });
      inferenceCalls++;
      throw new Error("An excluded model must never reach inference");
    };
    assert.deepEqual(
      await availableModels(settings, new AbortController().signal),
      [freeModel.id],
    );
    for (const id of catalog
      .slice(1)
      .map((m) => m.id)
      .concat("old/paid-model")) {
      settings.models.openrouter = id;
      await assert.rejects(
        complete({
          settings,
          messages: [],
          signal: new AbortController().signal,
        }),
        /free chat catalog|Automatic model routing/,
      );
    }
    settings.models.openrouter = freeModel.id;
    catalog = [
      {
        ...freeModel,
        pricing: { prompt: "0", completion: "0.01", request: "0" },
      },
    ];
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      /free chat catalog/,
    );
    globalThis.fetch = async () => {
      throw new Error("Catalog unavailable");
    };
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      /model catalog/,
    );
    assert.equal(inferenceCalls, 0);
    const { groqFreePlanConfirmed: _removed, ...legacy } = defaultSettings();
    assert.equal(_removed, false);
    assert.equal(settingsSchema.parse(legacy).groqFreePlanConfirmed, false);
    settings.provider = "groq";
    settings.models.groq = "openai/gpt-oss-20b";
    await assert.rejects(
      complete({
        settings,
        messages: [],
        signal: new AbortController().signal,
      }),
      /Confirm your Groq organization/,
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
});
