import { z } from "zod";

export const TEMPLATE_VERSION = "1.0.0";
export const providerSchema = z.enum(["groq", "openrouter"]);
export const modeSchema = z.enum(["refine", "plan", "prompt"]);
export const contextSchema = z
  .object({
    notes: z.string().max(12000).default(""),
    budget: z.string().max(300).default(""),
    stack: z.string().max(500).default(""),
    hosting: z.string().max(300).default(""),
    audience: z.string().max(500).default(""),
    deadline: z.string().max(100).default(""),
  })
  .strict();
export const projectSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    idea: z.string().max(16000),
    context: contextSchema,
  })
  .strict();
export const controlSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,50}$/),
    title: z.string().min(1).max(120),
    requirement: z.string().min(1).max(1200),
    verification: z.string().min(1).max(800),
    reference: z.string().max(200),
    enabled: z.boolean(),
  })
  .strict();
export const settingsSchema = z
  .object({
    provider: providerSchema,
    models: z
      .object({ groq: z.string().max(150), openrouter: z.string().max(150) })
      .strict(),
    preferences: z
      .object({
        stack: z.string().max(500),
        style: z.string().max(500),
        budget: z.string().max(300),
        hosting: z.string().max(300),
      })
      .strict(),
    controls: z.array(controlSchema).min(1).max(30),
    maxTokens: z.number().int().min(1024).max(12000),
    stream: z.boolean(),
    openRouterZdr: z.boolean(),
    groqFreePlanConfirmed: z.boolean().default(false),
  })
  .strict()
  .refine(
    (s) => new Set(s.controls.map((c) => c.id)).size === s.controls.length,
    "Checklist IDs must be unique",
  );
export const generationSchema = z
  .object({
    projectId: z.string().uuid(),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(16000),
    mode: modeSchema,
    approach: z.enum(["quick", "clarify"]),
    tool: z.enum([
      "Generic",
      "Codex",
      "Claude Code",
      "Cursor",
      "GitHub Copilot",
      "Windsurf",
      "Lovable",
      "Bolt",
    ]),
    exampleIds: z.array(z.string().uuid()).max(3).default([]),
  })
  .strict();
export const coverageSchema = z
  .object({
    id: z.string(),
    status: z.enum(["specified", "missing", "not applicable"]),
    reason: z.string().min(1).max(1500),
    evidence: z.string().max(2000),
    verification: z.string().max(2000),
  })
  .strict();
export const draftSchema = z
  .object({
    kind: z.enum(["questions", "draft"]),
    refinedIdea: z.string().max(50000),
    implementationPlan: z.string().max(50000),
    executionPrompt: z.string().max(70000),
    phasePrompts: z
      .array(
        z
          .object({ title: z.string().max(200), prompt: z.string().max(30000) })
          .strict(),
      )
      .max(6),
    assumptions: z.array(z.string().max(1500)).max(20),
    questions: z.array(z.string().min(1).max(1000)).max(3),
    coverage: z.array(coverageSchema).max(30),
  })
  .strict()
  .refine(
    (d) => d.kind !== "questions" || d.questions.length > 0,
    "A clarification must include questions",
  );
export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5).nullable(),
    correction: z.string().max(8000),
    outcome: z.string().max(8000),
  })
  .strict();
export const exampleSchema = z
  .object({
    projectId: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(100),
    content: z.string().trim().min(1).max(16000),
  })
  .strict();
export type Context = z.infer<typeof contextSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Control = z.infer<typeof controlSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type GenerationInput = z.infer<typeof generationSchema>;
export type Project = z.infer<typeof projectSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
export type Version = {
  id: string;
  projectId: string;
  createdAt: string;
  provider: string;
  model: string;
  mode: string;
  tool: string;
  templateVersion: string;
  checklistVersion: number;
  checklist: Control[];
  draft: Draft;
  rating: number | null;
  correction: string;
  outcome: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
export type Example = z.infer<typeof exampleSchema> & {
  id: string;
  createdAt: string;
};
