import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultSettings } from "./checklist";
import {
  settingsSchema,
  TEMPLATE_VERSION,
  type Project,
  type Settings,
  type Draft,
  type GenerationInput,
  type Version,
  type Message,
  type Example,
} from "./schema";

type Row = Record<string, unknown>;
export class Store {
  readonly db: DatabaseSync;
  constructor(
    path = process.env.DATABASE_PATH ||
      join(process.cwd(), "data", "ideaprompt.sqlite"),
  ) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:" && process.platform !== "win32")
      chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    this.db.exec(
      readFileSync(
        join(process.cwd(), "migrations", "001_initial.sql"),
        "utf8",
      ),
    );
    this.db
      .prepare("INSERT OR IGNORE INTO schema_migrations VALUES (1,?)")
      .run(new Date().toISOString());
    if (!this.db.prepare("SELECT id FROM settings").get())
      this.saveSettings(defaultSettings());
    // A process exit cannot leave the persistent generation lock stuck forever.
    this.db
      .prepare(
        "UPDATE runs SET status='failed',error='Application restarted before completion' WHERE status='pending'",
      )
      .run();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  settings(): { value: Settings; checklistVersion: number } {
    const row = this.db.prepare("SELECT * FROM settings WHERE id=1").get()!;
    return {
      value: settingsSchema.parse(JSON.parse(String(row.value))),
      checklistVersion: Number(row.checklist_version),
    };
  }
  saveSettings(value: Settings) {
    return this.transaction(() => {
      const old = this.db.prepare("SELECT * FROM settings WHERE id=1").get();
      let revision = Number(old?.checklist_version || 0);
      if (
        !old ||
        JSON.stringify(JSON.parse(String(old.value)).controls) !==
          JSON.stringify(value.controls)
      ) {
        revision = Number(
          this.db
            .prepare(
              "INSERT INTO checklist_versions(controls,created_at) VALUES (?,?)",
            )
            .run(JSON.stringify(value.controls), new Date().toISOString())
            .lastInsertRowid,
        );
      }
      this.db
        .prepare(
          "INSERT INTO settings VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,checklist_version=excluded.checklist_version",
        )
        .run(JSON.stringify(value), revision);
      return revision;
    });
  }
  checklistHistory() {
    return this.db
      .prepare("SELECT * FROM checklist_versions ORDER BY version DESC")
      .all()
      .map((r) => ({
        version: Number(r.version),
        controls: JSON.parse(String(r.controls)),
        createdAt: String(r.created_at),
      }));
  }
  mapProject(r: Row): Project {
    return {
      id: String(r.id),
      title: String(r.title),
      idea: String(r.idea),
      context: JSON.parse(String(r.context)),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }
  projects(search = ""): Project[] {
    const pattern = `%${search.replace(/[\^%_]/g, "^$&")}%`;
    return this.db
      .prepare(
        "SELECT * FROM projects WHERE title LIKE ? ESCAPE '^' OR idea LIKE ? ESCAPE '^' ORDER BY updated_at DESC",
      )
      .all(pattern, pattern)
      .map((r) => this.mapProject(r));
  }
  project(id: string): Project | undefined {
    const r = this.db.prepare("SELECT * FROM projects WHERE id=?").get(id);
    return r ? this.mapProject(r) : undefined;
  }
  createProject(data: Pick<Project, "title" | "idea" | "context">): Project {
    const id = randomUUID(),
      now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)")
      .run(id, data.title, data.idea, JSON.stringify(data.context), now, now);
    return this.project(id)!;
  }
  updateProject(id: string, data: Pick<Project, "title" | "idea" | "context">) {
    this.db
      .prepare(
        "UPDATE projects SET title=?,idea=?,context=?,updated_at=? WHERE id=?",
      )
      .run(
        data.title,
        data.idea,
        JSON.stringify(data.context),
        new Date().toISOString(),
        id,
      );
    return this.project(id);
  }
  deleteProject(id: string) {
    this.db.prepare("DELETE FROM projects WHERE id=?").run(id);
  }
  messages(projectId: string, limit = 100): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM (SELECT rowid AS seq,* FROM messages WHERE project_id=? ORDER BY rowid DESC LIMIT ?) ORDER BY seq",
      )
      .all(projectId, limit);
    return rows.map((r) => ({
      id: String(r.id),
      role: r.role as Message["role"],
      content: String(r.content),
      createdAt: String(r.created_at),
    }));
  }
  editMessage(id: string, content: string) {
    return this.db
      .prepare("UPDATE messages SET content=? WHERE id=?")
      .run(content, id).changes;
  }
  deleteMessage(id: string) {
    this.db.prepare("DELETE FROM messages WHERE id=?").run(id);
  }
  versions(projectId: string): Version[] {
    return this.db
      .prepare(
        "SELECT v.*,c.controls FROM versions v JOIN checklist_versions c ON c.version=v.checklist_version WHERE project_id=? ORDER BY v.rowid DESC",
      )
      .all(projectId)
      .map((r) => ({
        id: String(r.id),
        projectId,
        createdAt: String(r.created_at),
        provider: String(r.provider),
        model: String(r.model),
        mode: String(r.mode),
        tool: String(r.tool),
        templateVersion: String(r.template_version),
        checklistVersion: Number(r.checklist_version),
        checklist: JSON.parse(String(r.controls)),
        draft: JSON.parse(String(r.draft)),
        rating: r.rating === null ? null : Number(r.rating),
        correction: String(r.correction),
        outcome: String(r.outcome),
      }));
  }
  beginRun(input: GenerationInput) {
    this.db
      .prepare(
        "INSERT INTO runs(id,project_id,status,created_at) VALUES(?,?,'pending',?)",
      )
      .run(input.requestId, input.projectId, new Date().toISOString());
  }
  finishRun(
    input: GenerationInput,
    draft: Draft,
    settings: Settings,
    checklistVersion: number,
    model: string,
  ) {
    this.transaction(() => {
      const run = this.db
        .prepare("SELECT status FROM runs WHERE id=?")
        .get(input.requestId);
      if (run?.status !== "pending")
        throw new Error("Generation is no longer active");
      const now = new Date().toISOString();
      this.db
        .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
        .run(randomUUID(), input.projectId, "user", input.message, now);
      const summary =
        draft.kind === "questions"
          ? draft.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")
          : input.mode === "refine"
            ? draft.refinedIdea
            : input.mode === "plan"
              ? draft.implementationPlan
              : draft.executionPrompt;
      this.db
        .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
        .run(randomUUID(), input.projectId, "assistant", summary, now);
      this.db
        .prepare(
          "INSERT INTO versions(id,project_id,run_id,draft,provider,model,mode,tool,template_version,checklist_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          input.projectId,
          input.requestId,
          JSON.stringify(draft),
          settings.provider,
          model,
          input.mode,
          input.tool,
          TEMPLATE_VERSION,
          checklistVersion,
          now,
        );
      this.db
        .prepare("UPDATE runs SET status='succeeded' WHERE id=?")
        .run(input.requestId);
      this.db
        .prepare("UPDATE projects SET updated_at=? WHERE id=?")
        .run(now, input.projectId);
    });
  }
  failRun(id: string, error: string, cancelled = false) {
    this.db
      .prepare(
        "UPDATE runs SET status=?,error=? WHERE id=? AND status='pending'",
      )
      .run(cancelled ? "cancelled" : "failed", error, id);
  }
  feedback(
    id: string,
    feedback: { rating: number | null; correction: string; outcome: string },
  ) {
    return this.db
      .prepare("UPDATE versions SET rating=?,correction=?,outcome=? WHERE id=?")
      .run(feedback.rating, feedback.correction, feedback.outcome, id).changes;
  }
  deleteVersion(id: string) {
    this.db.prepare("DELETE FROM versions WHERE id=?").run(id);
  }
  editVersion(id: string, draft: Draft) {
    const row = this.db
      .prepare(
        "SELECT c.controls FROM versions v JOIN checklist_versions c ON c.version=v.checklist_version WHERE v.id=?",
      )
      .get(id);
    if (!row) return null;
    const controls: Settings["controls"] = JSON.parse(String(row.controls));
    const updated = {
      ...draft,
      coverage: controls
        .filter((c) => c.enabled)
        .map((c) => ({
          id: c.id,
          status: "missing" as const,
          reason:
            "Manually edited. Regenerate to review these requirements again.",
          evidence: "",
          verification: c.verification,
        })),
    };
    this.db
      .prepare("UPDATE versions SET draft=? WHERE id=?")
      .run(JSON.stringify(updated), id);
    return updated;
  }
  examples(search = ""): Example[] {
    const pattern = `%${search.replace(/[\^%_]/g, "^$&")}%`;
    return this.db
      .prepare(
        "SELECT * FROM examples WHERE title LIKE ? ESCAPE '^' OR content LIKE ? ESCAPE '^' ORDER BY rowid DESC",
      )
      .all(pattern, pattern)
      .map((r) => ({
        id: String(r.id),
        projectId: r.project_id === null ? null : String(r.project_id),
        title: String(r.title),
        content: String(r.content),
        createdAt: String(r.created_at),
      }));
  }
  saveExample(
    data: Pick<Example, "projectId" | "title" | "content">,
    id: string = randomUUID(),
  ) {
    this.db
      .prepare(
        "INSERT INTO examples VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,content=excluded.content,project_id=excluded.project_id",
      )
      .run(
        id,
        data.projectId,
        data.title,
        data.content,
        new Date().toISOString(),
      );
    return id;
  }
  deleteExample(id: string) {
    this.db.prepare("DELETE FROM examples WHERE id=?").run(id);
  }
  exportData() {
    return {
      format: "ideaprompt-v1",
      exportedAt: new Date().toISOString(),
      settings: this.settings(),
      checklistHistory: this.checklistHistory(),
      projects: this.projects().map((p) => ({
        ...p,
        messages: this.messages(p.id, 100000),
        versions: this.versions(p.id),
      })),
      examples: this.examples(),
    };
  }
  reset() {
    this.transaction(() =>
      this.db.exec(
        "DELETE FROM projects; DELETE FROM examples; DELETE FROM settings; DELETE FROM checklist_versions;",
      ),
    );
    this.saveSettings(defaultSettings());
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }
  close() {
    this.db.close();
  }
}
const globalDb = globalThis as unknown as { ideaPromptStore?: Store };
export function store() {
  return (globalDb.ideaPromptStore ||= new Store());
}
