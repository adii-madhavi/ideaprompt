import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import cases from "../evaluations/ideas.json";
import { Store } from "../src/lib/db";
import { generate } from "../src/lib/generate";
import {
  generationMessages,
  PROMPT_SECTIONS,
  structureIssues,
  reviewCoverage,
} from "../src/lib/prompts";
import {
  draftSchema,
  providerSchema,
  type Draft,
  type Settings,
} from "../src/lib/schema";

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2),
    fileIndex = args.indexOf("--file"),
    live = args.includes("--live");
  function inspect(
    draft: Draft,
    settings: Settings,
    id: string,
    expected?: (typeof cases)[number],
  ) {
    const issues = structureIssues(draft, "prompt"),
      checked = reviewCoverage(draft, settings.controls, "prompt");
    if (draft.kind !== "draft")
      issues.push(
        "Clarification returned: answer questions before evaluating the artifact.",
      );
    checked.coverage
      .filter((c) => c.status === "missing")
      .forEach((c) => issues.push(`Missing coverage: ${c.id}`));
    for (const control of expected?.applicable || [])
      if (
        checked.coverage.find((c) => c.id === control)?.status !== "specified"
      )
        issues.push(`Expected applicable control: ${control}`);
    for (const control of expected?.notApplicable || [])
      if (
        checked.coverage.find((c) => c.id === control)?.status !==
        "not applicable"
      )
        issues.push(`Unnecessary control or wrong applicability: ${control}`);
    console.log(
      `${issues.length ? "FAIL" : "PASS"} ${id}${issues.length ? "\n  " + issues.join("\n  ") : ""}`,
    );
    if (issues.length) process.exitCode = 1;
  }
  const db = new Store(":memory:");
  try {
    if (fileIndex >= 0) {
      if (!args[fileIndex + 1])
        throw new Error(
          "Provide a JSON draft or exported workspace after --file.",
        );
      const value = JSON.parse(readFileSync(args[fileIndex + 1], "utf8"));
      if (value.format === "ideaprompt-v1") {
        for (const p of value.projects)
          for (const v of p.versions)
            if (v.mode === "prompt")
              inspect(
                draftSchema.parse(v.draft),
                { ...db.settings().value, controls: v.checklist },
                `${p.title} / ${v.id}`,
              );
      } else
        inspect(
          draftSchema.parse(value),
          db.settings().value,
          "provided draft",
        );
      return;
    }
    if (live) {
      const p = args.indexOf("--provider"),
        m = args.indexOf("--model");
      const settings = db.settings().value;
      if (p >= 0) {
        const first = providerSchema.parse(args[p + 1]);
        settings.order = [first, ...settings.order.filter((id) => id !== first)];
      }
      if (m >= 0) settings.models[settings.order[0]] = args[m + 1] || "";
      db.saveSettings(settings);
      mkdirSync(join(process.cwd(), "data", "evaluations"), {
        recursive: true,
      });
      for (const example of cases) {
        const project = db.createProject({
          title: example.id,
          idea: example.idea,
          context: example.context,
        });
        const draft = await generate(
          db,
          {
            projectId: project.id,
            requestId: randomUUID(),
            message: example.idea,
            mode: "prompt",
            target: "idea",
            approach: "quick",
            tool: "Generic",
            exampleIds: [],
          },
          new AbortController().signal,
          () => {},
        );
        writeFileSync(
          join(process.cwd(), "data", "evaluations", `${example.id}.json`),
          JSON.stringify(draft, null, 2),
          { mode: 0o600 },
        );
        inspect(draft, settings, example.id, example);
      }
    } else {
      for (const example of cases) {
        const p = db.createProject({
          title: example.id,
          idea: example.idea,
          context: example.context,
        });
        const messages = generationMessages(
          {
            projectId: p.id,
            requestId: randomUUID(),
            message: p.idea,
            mode: "prompt",
            target: "idea",
            approach: "quick",
            tool: "Generic",
            exampleIds: [],
          },
          p,
          db.settings().value,
          [],
          [],
        );
        for (const heading of PROMPT_SECTIONS)
          if (!messages[0].content.includes(heading))
            throw new Error(`Missing template heading ${heading}`);
        if (!messages[1].content.includes(example.context.notes))
          throw new Error("Project context was dropped");
        console.log(
          `PASS ${example.id}: prompt construction and selected context`,
        );
      }
      console.log(
        "Template sanity check only. Use --file with real outputs, or --live --provider groq|gemini|openrouter|cloudflare|pollinations --model MODEL for paid provider evaluation. Quality requires reviewing outputs and implementation outcomes.",
      );
    }
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Evaluation failed");
  process.exitCode = 1;
});
