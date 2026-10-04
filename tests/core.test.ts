import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../src/lib/db";
import { generate } from "../src/lib/generate";
import {
  complete,
  outputBudget,
  providerChain,
  ProviderError,
} from "../src/lib/providers";
import { DEFAULT_CONTROLS, defaultSettings } from "../src/lib/checklist";
import {
  PROMPT_SECTIONS,
  generationMessages,
  parseDraft,
  reviewCoverage,
  structureIssues,
} from "../src/lib/prompts";
import { localGuard, body } from "../src/lib/http";
import {
  generationSchema,
  settingsSchema,
  type Draft,
  type GenerationInput,
} from "../src/lib/schema";

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
    target: "idea",
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
    fileStructure: "```text\nindex.html  # page\n```",
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
const ENV_KEYS = [
  "GROQ_API_KEY",
  "GROQ_API_KEY_FALLBACK",
  "GROQ_MODEL",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "POLLINATIONS_API_KEY",
];
async function withEnv(vars: Record<string, string>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const original = globalThis.fetch;
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
const answer = (content: string) =>
  Response.json({ choices: [{ message: { content }, finish_reason: "stop" }] });
const quiet = () => new AbortController().signal;

test("routing skips keyless providers, falls through failures, never lists a catalog, and caps only Groq", async () => {
  await withEnv(
    { GROQ_API_KEY: "groq-secret-a", OPENROUTER_API_KEY: "or-secret-a" },
    async () => {
      const settings = defaultSettings();
      settings.stream = false;
      settings.groqMaxTokens = 3000;
      const calls: { url: string; body: Record<string, unknown> }[] = [];
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        calls.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) });
        return u.includes("groq")
          ? new Response("bad key groq-secret-a", { status: 401 })
          : answer("hello");
      };
      const status: string[] = [];
      let route = "";
      const text = await complete({
        settings,
        messages: [
          { role: "system", content: "s" },
          { role: "user", content: "u" },
        ],
        signal: quiet(),
        onStatus: (m) => status.push(m),
        onRoute: (r) => (route = r.provider),
      });
      assert.equal(text, "hello");
      assert.equal(route, "OpenRouter");
      assert.equal(calls.length, 2, "no catalog request, one call per provider");
      assert.ok(calls.every((c) => !c.url.endsWith("/models")));
      assert.ok(calls[0].url.startsWith("https://api.groq.com"));
      assert.ok((calls[0].body.max_completion_tokens as number) <= 3000);
      assert.equal(calls[1].body.max_tokens, 16000, "uncapped provider");
      assert.equal(calls[1].body.provider, undefined, "no restrictive routing");
      assert.ok(status.some((m) => /Trying OpenRouter/.test(m)));
      assert.ok(!status.join().includes("groq-secret-a"));
    },
  );
});

test("output budget limits only Groq and skips it when the prompt leaves no room", () => {
  const env = { GROQ_API_KEY: "g", OPENROUTER_API_KEY: "o" } as unknown as NodeJS.ProcessEnv;
  const settings = defaultSettings();
  settings.groqMaxTokens = 7000;
  const [groq, openrouter] = providerChain(settings, env);
  const small = [{ role: "user" as const, content: "x".repeat(100) }];
  const huge = [{ role: "user" as const, content: "x".repeat(40000) }];
  assert.equal(groq.id, "groq");
  assert.ok(outputBudget(groq, settings, small) < 7600);
  assert.throws(
    () => outputBudget(groq, settings, huge),
    (e) => e instanceof ProviderError && e.kind === "too_large",
  );
  assert.equal(outputBudget(openrouter, settings, huge), 16000);
  assert.deepEqual(
    providerChain(settings, { OPENROUTER_API_KEY: "o" } as unknown as NodeJS.ProcessEnv).map(
      (r) => r.id,
    ),
    ["openrouter"],
    "providers without keys are skipped",
  );
  settings.order = ["openrouter", "groq", "gemini", "cloudflare", "pollinations"];
  assert.equal(providerChain(settings, env)[0].id, "openrouter");
});

test("a second key takes over after an auth failure, and a short rate limit is waited out", async () => {
  await withEnv(
    { GROQ_API_KEY: "key-one", GROQ_API_KEY_FALLBACK: "key-two" },
    async () => {
      const settings = defaultSettings();
      settings.stream = false;
      const used: string[] = [];
      globalThis.fetch = async (_url, init) => {
        const auth = String(
          (init?.headers as Record<string, string>).Authorization,
        );
        used.push(auth);
        return auth.endsWith("key-one")
          ? new Response("nope", { status: 401 })
          : answer("second");
      };
      assert.equal(
        await complete({
          settings,
          messages: [{ role: "user", content: "hi" }],
          signal: quiet(),
        }),
        "second",
      );
      assert.deepEqual(used, ["Bearer key-one", "Bearer key-two"]);
    },
  );
  await withEnv({ GEMINI_API_KEY: "gem-rate" }, async () => {
    const settings = defaultSettings();
    settings.stream = false;
    let n = 0;
    globalThis.fetch = async () =>
      ++n === 1
        ? new Response("slow down", {
            status: 429,
            headers: { "retry-after": "0" },
          })
        : answer("after wait");
    const status: string[] = [];
    assert.equal(
      await complete({
        settings,
        messages: [{ role: "user", content: "hi" }],
        signal: quiet(),
        onStatus: (m) => status.push(m),
      }),
      "after wait",
    );
    assert.equal(n, 2);
    assert.ok(status.some((m) => /Waiting/.test(m)));
  });
});

test("provider streaming handles fragmented UTF-8, SSE comments and terminal markers, and never leaks keys", async () => {
  await withEnv({ OPENROUTER_API_KEY: "test-secret-only" }, async () => {
    const settings = defaultSettings();
    settings.order = ["openrouter"];
    const base = {
      settings,
      messages: [{ role: "user" as const, content: "Test" }],
      signal: quiet(),
    };
    globalThis.fetch = async () => {
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
    };
    assert.equal(await complete(base), "Hello ₹");
    globalThis.fetch = async () =>
      new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n');
    await assert.rejects(complete(base), /before completion/);
    globalThis.fetch = async () =>
      new Response("key leaked upstream test-secret-only", { status: 401 });
    await assert.rejects(
      complete(base),
      (e) =>
        e instanceof Error &&
        !e.message.includes("test-secret-only") &&
        /rejected/.test(e.message),
    );
  });
});

test("no key gives a clear instruction and legacy settings still load", async () => {
  await withEnv({}, async () => {
    const settings = defaultSettings();
    globalThis.fetch = async () => {
      throw new Error("must not be called");
    };
    await assert.rejects(
      complete({ settings, messages: [], signal: quiet() }),
      /.env/,
    );
  });
  const legacy = {
    provider: "groq",
    models: { groq: "openai/gpt-oss-20b", openrouter: "" },
    preferences: defaultSettings().preferences,
    controls: DEFAULT_CONTROLS,
    maxTokens: 7000,
    stream: true,
    openRouterZdr: true,
    groqFreePlanConfirmed: false,
  };
  const parsed = settingsSchema.parse(legacy);
  assert.equal(parsed.groqMaxTokens, 3500);
  assert.equal(parsed.models.groq, "openai/gpt-oss-20b");
  assert.deepEqual(
    settingsSchema.parse({ ...legacy, order: ["gemini", "gemini"] }).order,
    ["gemini", "groq", "openrouter", "cloudflare", "pollinations"],
  );
});

test("plans carry a file structure and follow the website or raw-idea target", () => {
  const { db, input } = setup();
  try {
    const project = db.project(input.projectId)!;
    const settings = db.settings().value;
    const text = (target: "website" | "idea") =>
      generationMessages(
        { ...input, target, mode: "plan" },
        project,
        settings,
        [],
        [],
      )[0].content;
    assert.match(text("website"), /Planning target: WEBSITE/);
    assert.match(text("idea"), /Planning target: RAW IDEA/);
    assert.match(text("idea"), /"fileStructure"/);
    const bare = { ...fixture(), fileStructure: "" };
    assert.deepEqual(structureIssues(bare, "plan"), ["Missing file structure"]);
    const raw = JSON.stringify({
      ...fixture(),
      fileStructure: "",
      executionPrompt: "",
      implementationPlan:
        "## Steps\nDo it.\n\n## File structure\n```text\napp/  # code\n```\n\n## Risks\nNone.",
    });
    assert.equal(parseDraft(raw).fileStructure, "```text\napp/  # code\n```");
  } finally {
    db.close();
  }
});

test("a draft from a token-limited provider skips the second pass and records who answered", async () => {
  for (const limited of [true, false]) {
    const { db, input } = setup();
    try {
      let calls = 0;
      await generate(
        db,
        input,
        quiet(),
        () => {},
        async (o) => {
          calls++;
          o.onRoute?.({ id: "groq", provider: "Groq", model: "m", limited });
          return JSON.stringify(fixture());
        },
      );
      assert.equal(calls, limited ? 1 : 2);
      assert.equal(db.versions(input.projectId)[0].provider, "Groq");
    } finally {
      db.close();
    }
  }
});
