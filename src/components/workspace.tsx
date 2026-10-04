"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Context,
  Draft,
  Example,
  Message,
  Project,
  Version,
} from "@/lib/schema";
import { Icon, Modal, Markdown, request, download, type IconName } from "./ui";
import { SettingsModal, type SettingsResponse } from "./settings";
import { TerminalIntro, TerminalEmptyVisual } from "./style-scenes";

const MODES: {
  id: "refine" | "plan" | "prompt";
  title: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    id: "refine",
    title: "Refine my idea",
    detail: "Find the clarity in your concept",
    icon: "spark",
  },
  {
    id: "plan",
    title: "Plan implementation",
    detail: "Map out how to bring it to life",
    icon: "plan",
  },
  {
    id: "prompt",
    title: "Generate a prompt",
    detail: "Get instructions ready to build",
    icon: "prompt",
  },
];
const TABS = [
  "Refined idea",
  "Implementation",
  "Execution prompt",
  "Coverage",
] as const;
const EMPTY_CONTEXT: Context = {
  notes: "",
  budget: "",
  stack: "",
  hosting: "",
  audience: "",
  deadline: "",
};
const STARTERS = [
  {
    label: "A client portal",
    idea: "I want a simple client portal where my freelance clients can see project updates, share feedback, and find their files in one place.",
  },
  {
    label: "A portfolio site",
    idea: "A clean portfolio website to showcase my design work, explain my process, and let potential clients contact me. It should feel personal and work beautifully on phones.",
  },
  {
    label: "An existing app",
    idea: "I want to improve an existing app. Help me define the change, inspect the current implementation, and plan a focused update that preserves the rest of the project.",
  },
];
type Detail = { project: Project; versions: Version[]; messages: Message[] };
export default function Workspace() {

  const [motionPaused, setMotionPaused] = useState(false);

  const [settings, setSettings] = useState<SettingsResponse | null>(null),
    [examples, setExamples] = useState<Example[]>([]);
  const [projects, setProjects] = useState<Project[]>([]),
    [search, setSearch] = useState("");
  const [project, setProject] = useState<Project | null>(null),
    [idea, setIdea] = useState(""),
    [context, setContext] = useState<Context>(EMPTY_CONTEXT);
  const [versions, setVersions] = useState<Version[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [versionId, setVersionId] = useState("");
  const [mode, setMode] = useState<"refine" | "plan" | "prompt">("prompt"),
    [approach, setApproach] = useState<"quick" | "clarify">("quick"),
    [tool, setTool] = useState("Generic");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Execution prompt"),
    [followup, setFollowup] = useState(""),
    [answers, setAnswers] = useState<string[]>([]);
  const [selectedExamples, setSelectedExamples] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [characters, setCharacters] = useState(0);
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [showSettings, setShowSettings] = useState(false),
    [showSidebar, setShowSidebar] = useState(false);
  const [editingProject, setEditingProject] = useState(false),
    [title, setTitle] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false),
    [rating, setRating] = useState<number | null>(null),
    [correction, setCorrection] = useState(""),
    [outcome, setOutcome] = useState("");
  const [exampleOpen, setExampleOpen] = useState(false),
    [exampleTitle, setExampleTitle] = useState(""),
    [exampleText, setExampleText] = useState(""),
    [exampleGlobal, setExampleGlobal] = useState(false);
  const [editArtifact, setEditArtifact] = useState(false),
    [artifactText, setArtifactText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null),
    [messageText, setMessageText] = useState("");
  const controller = useRef<AbortController | null>(null),
    generationLock = useRef(false),
    activeProject = useRef<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null), menuRef = useRef<HTMLButtonElement>(null), menuWasOpen = useRef(false);
  useEffect(() => {
    if (showSidebar) { sidebarRef.current?.querySelector("button")?.focus(); menuWasOpen.current = true; }
    else if (menuWasOpen.current) { menuRef.current?.focus(); menuWasOpen.current = false; }
  }, [showSidebar]);
  const selectedVersion =
    versions.find((v) => v.id === versionId) || versions[0];
  const draft = selectedVersion?.draft;
  const relevantExamples = examples.filter(
    (e) => !e.projectId || e.projectId === project?.id,
  );
  const artifact =
    tab === "Refined idea"
      ? draft?.refinedIdea
      : tab === "Implementation"
        ? draft?.implementationPlan
        : draft?.executionPrompt;
  const reloadSettings = useCallback(async () => {
    setSettings(await request<SettingsResponse>("/api/settings"));
  }, []);
  const reloadExamples = useCallback(async () => {
    setExamples(await request<Example[]>("/api/examples"));
  }, []);
  const reloadProjects = useCallback(async () => {
    setProjects(await request<Project[]>("/api/projects"));
  }, []);
  useEffect(() => {
    let current = true;
    Promise.all([
      request<SettingsResponse>("/api/settings"),
      request<Example[]>("/api/examples"),
      request<Project[]>("/api/projects"),
    ])
      .then(([s, e, p]) => {
        if (current) {
          setSettings(s);
          setExamples(e);
          setProjects(p);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function loadProject(id: string) {
    try {
      const detail = await request<Detail>(`/api/projects/${id}`);
      setProject(detail.project);
      activeProject.current = id;
      setIdea(detail.project.idea);
      setContext(detail.project.context);
      setVersions(detail.versions);
      setMessages(detail.messages);
      setVersionId(detail.versions[0]?.id || "");
      setFollowup("");
      setAnswers([]);
      setSelectedExamples([]);
      setError("");
      setShowSidebar(false);
      const m = detail.versions[0]?.mode;
      if (m === "refine" || m === "plan" || m === "prompt") {
        setMode(m);
        setTab(
          m === "refine"
            ? "Refined idea"
            : m === "plan"
              ? "Implementation"
              : "Execution prompt",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function newProject() {
    setProject(null);
    activeProject.current = null;
    setIdea("");
    setContext(EMPTY_CONTEXT);
    setVersions([]);
    setMessages([]);
    setVersionId("");
    setFollowup("");
    setAnswers([]);
    setSelectedExamples([]);
    setError("");
    setShowSidebar(false);
  }
  async function saveProject(): Promise<Project> {
    const data = {
      title:
        project?.title ||
        idea.trim().split(/[.\n]/)[0].slice(0, 65) ||
        "Untitled idea",
      idea,
      context,
    };
    const saved = await request<Project>(
      project ? `/api/projects/${project.id}` : "/api/projects",
      project ? "PATCH" : "POST",
      data,
    );
    setProject(saved);
    activeProject.current = saved.id;
    await reloadProjects();
    return saved;
  }
  async function runGeneration(customMessage?: string) {
    if (generationLock.current || !idea.trim()) return;
    if (
      !settings?.value.models[settings.value.provider] ||
      !settings.connected[settings.value.provider]
    ) {
      setShowSettings(true);
      setError("Set up a server key and choose a model before generating.");
      return;
    }
    generationLock.current = true;
    setBusy(true);
    setError("");
    setStatus("Saving your starting point…");
    setCharacters(0);
    const abort = new AbortController();
    controller.current = abort;
    let savedId = project?.id;
    try {
      const saved = await saveProject();
      savedId = saved.id;
      const message =
        customMessage ||
        followup.trim() ||
        (messages.length
          ? `Regenerate the ${mode === "prompt" ? "execution prompt" : mode === "plan" ? "implementation plan" : "refined idea"} using the updated project idea and context. Preserve prior confirmed answers and agreed requirements.`
          : idea.trim());
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: saved.id,
          requestId: crypto.randomUUID(),
          message,
          mode,
          approach,
          tool,
          exampleIds: selectedExamples,
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.error || "Could not start generation.");
      }
      if (!response.body)
        throw new Error("The server did not return a stream.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        completed = false;
      const event = (line: string) => {
        if (!line.trim()) return;
        const value = JSON.parse(line);
        if (value.type === "error") throw new Error(value.message);
        if (value.type === "status") setStatus(value.message);
        if (value.type === "progress") setCharacters(value.characters);
        if (value.type === "complete") completed = true;
      };
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          buffer += decoder.decode(part.value, { stream: true });
          let i: number;
          while ((i = buffer.indexOf("\n")) >= 0) {
            event(buffer.slice(0, i));
            buffer = buffer.slice(i + 1);
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) event(buffer);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (!completed)
        throw new Error(
          "Generation ended before a reviewed draft was saved. Previous work is intact.",
        );
      const detail = await request<Detail>(`/api/projects/${saved.id}`);
      setVersions(detail.versions);
      setMessages(detail.messages);
      setVersionId(detail.versions[0]?.id || "");
      setFollowup("");
      setAnswers([]);
      setTab(
        mode === "refine"
          ? "Refined idea"
          : mode === "plan"
            ? "Implementation"
            : "Execution prompt",
      );
      await reloadProjects();
      setToast(
        detail.versions[0]?.draft.kind === "questions"
          ? "A few answers will make this more useful."
          : "Reviewed draft saved as a new version.",
      );
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Generation cancelled. Your saved versions are intact."
          : (e as Error).message,
      );
      // Reconcile after a disconnect: the server may have committed just before cancellation.
      if (savedId) {
        try {
          const detail = await request<Detail>(`/api/projects/${savedId}`);
          setVersions(detail.versions);
          setMessages(detail.messages);
        } catch {}
      }
    } finally {
      generationLock.current = false;
      controller.current = null;
      setBusy(false);
      setStatus("");
    }
  }
  async function cancelGeneration() {
    controller.current?.abort();
    if (activeProject.current) {
      try {
        await request("/api/generate", "DELETE", {
          projectId: activeProject.current,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(artifact || "");
      setToast("Copied to clipboard.");
    } catch {
      setError(
        "Clipboard access was denied. Export Markdown or select the text to copy it.",
      );
    }
  }
  function exportMarkdown() {
    if (!draft || !project) return;
    const sections = [
      `# ${project.title}`,
      `Provider: ${selectedVersion.provider} · Model: ${selectedVersion.model}\nTemplate: ${selectedVersion.templateVersion} · Checklist revision: ${selectedVersion.checklistVersion}`,
      draft.refinedIdea && `# Refined idea\n\n${draft.refinedIdea}`,
      draft.implementationPlan &&
        `# Implementation plan\n\n${draft.implementationPlan}`,
      draft.executionPrompt &&
        `# Master execution prompt\n\n${draft.executionPrompt}`,
      ...draft.phasePrompts.map((p) => `# ${p.title}\n\n${p.prompt}`),
      draft.assumptions.length &&
        `# Labeled assumptions\n\n${draft.assumptions.map((a) => "- " + a).join("\n")}`,
      draft.questions.length &&
        `# Clarification questions\n\n${draft.questions.join("\n\n")}`,
      `# Specification coverage\n\n${draft.coverage.map((c) => `- ${c.id}: **${c.status}** — ${c.reason}\n  Verification: ${c.verification || "Not applicable"}`).join("\n")}\n\nAI review does not guarantee secure implementation.`,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");
    download(
      `${project.title.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60)}.md`,
      sections,
    );
    setToast("Markdown exported.");
  }
  function openFeedback() {
    if (!selectedVersion) return;
    setRating(selectedVersion.rating);
    setCorrection(selectedVersion.correction);
    setOutcome(selectedVersion.outcome);
    setFeedbackOpen(true);
  }
  async function deleteVersion() {
    if (
      !selectedVersion ||
      !project ||
      !window.confirm("Delete this saved prompt version?")
    )
      return;
    try {
      await request(`/api/versions/${selectedVersion.id}`, "DELETE", {});
      await loadProject(project.id);
      setToast("Version deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const covered =
    draft?.coverage.filter((c) => c.status === "specified").length || 0;
  return (
    <div className="app-shell" data-visual-style="terminal" data-motion-paused={motionPaused}>
      {showSidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close project menu"
          onClick={() => setShowSidebar(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="project-sidebar"
        className={`sidebar ${showSidebar ? "open" : ""}`}
        aria-label="Project sidebar"
      >
        <button className="brand" disabled={busy} onClick={newProject}>
          <span className="brand-mark">
            <Icon name="spark" size={24} />
          </span>
          <span>
            idea<span className="brand-light">prompt</span>
            <small>FROM IDEA TO ACTION</small>
          </span>
        </button>
        <button className="new-project" disabled={busy} onClick={newProject}>
          <Icon name="plus" size={17} /> New project <span>↗</span>
        </button>
        <div className="sidebar-label">
          <span>YOUR PROJECTS</span>
          <span>{projects.length.toString().padStart(2, "0")}</span>
        </div>
        <label className="sidebar-search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search projects"
            value={search}
            placeholder="Find a project…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav className="project-list" aria-label="Saved projects">
          {projects
            .filter((p) =>
              (p.title + p.idea).toLowerCase().includes(search.toLowerCase()),
            )
            .map((p) => (
              <button
                disabled={busy}
                key={p.id}
                className={project?.id === p.id ? "active" : ""}
                onClick={() => loadProject(p.id)}
              >
                <Icon name="folder" size={17} />
                <div>
                  <strong>{p.title}</strong>
                  <span>
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · Saved locally
                  </span>
                </div>
              </button>
            ))}
          {projects.length === 0 && (
            <div className="sidebar-empty">
              <Icon name="folder" size={25} />
              <p>A home for your next big idea.</p>
              <span>Your saved projects will appear here.</span>
            </div>
          )}
          {projects.length > 0 &&
            !projects.some((p) =>
              (p.title + p.idea).toLowerCase().includes(search.toLowerCase()),
            ) && <p className="help">No matching projects.</p>}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <span className="note-doodle">✳</span>
            <strong>
              Less guessing.
              <br />
              More building.
            </strong>
            <p>Good prompts start with a clear picture of what matters.</p>
          </div>
          <button
            className="sidebar-settings"
            disabled={busy || !settings}
            onClick={() => setShowSettings(true)}
          >
            <Icon name="settings" /> Settings & memory{" "}
            <Icon name="chevron" size={14} />
          </button>
          <div className="local-user">
            <span className="avatar">Y</span>
            <div>
              <strong>Your workspace</strong>
              <span>
                <i className="status-dot" /> Local & private
              </span>
            </div>
            <Icon name="shield" size={17} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open project menu"
              ref={menuRef}
              aria-controls="project-sidebar"
              aria-expanded={showSidebar}
              onClick={() => setShowSidebar(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{project?.title || "New project"}</strong>
            {project && (
              <button
                aria-label="Rename project"
                className="text-button edit-title"
                disabled={busy}
                onClick={() => {
                  setTitle(project.title);
                  setEditingProject(true);
                }}
              >
                Edit
              </button>
            )}
          </div>
          <div className="topbar-actions">
            <button className="motion-toggle" type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>
              {motionPaused ? "Resume motion" : "Pause motion"}
            </button>
            <span className="local-badge"><i className="status-dot" /> Local workspace</span>
          </div>
        </header>
        <div className="page-content">
          <TerminalIntro paused={motionPaused} />
          <div className="mode-grid" aria-label="Choose a mode">
            {MODES.map((m, i) => (
              <button
                disabled={busy}
                key={m.id}
                className={`mode-card ${mode === m.id ? "selected" : ""}`}
                aria-pressed={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setTab(
                    m.id === "refine"
                      ? "Refined idea"
                      : m.id === "plan"
                        ? "Implementation"
                        : "Execution prompt",
                  );
                }}
              >
                <span className="mode-icon">
                  <Icon name={m.icon} size={21} />
                </span>
                <div>
                  <strong>{m.title}</strong>
                  <span>{m.detail}</span>
                </div>
                <span className="mode-number">0{i + 1}</span>
              </button>
            ))}
          </div>
          {error && (
            <div className="notice error workspace-error" role="alert">
              <div>{error}</div>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <div className="workspace-grid">
            <section
              className="input-column"
              aria-label="Idea and conversation"
            >
              <div className="panel idea-panel">
                <div className="panel-heading">
                  <div className="title-with-icon">
                    <span className="tiny-icon">
                      <Icon name="spark" size={17} />
                    </span>
                    <h2>Your starting point</h2>
                  </div>
                  <span className="pill">
                    {project ? "SAVED PROJECT" : "NEW IDEA"}
                  </span>
                </div>
                <div className="idea-body">
                  <label className="field idea-field">
                    <span>What do you want to build?</span>
                    <textarea
                      id="idea-input"
                      disabled={busy}
                      value={idea}
                      maxLength={16000}
                      rows={7}
                      placeholder={
                        "A website, a feature, a small change…\nDescribe it in your own words. Messy is welcome."
                      }
                      onChange={(e) => setIdea(e.target.value)}
                    />
                  </label>
                  <div className="idea-bottom">
                    <span>No perfect wording needed.</span>
                    <span>{idea.length.toLocaleString()} / 16,000</span>
                  </div>
                  {!project && !idea && (
                    <div className="starter-row">
                      <span>Need a spark?</span>
                      {STARTERS.map((s) => (
                        <button
                          key={s.label}
                          disabled={busy}
                          onClick={() => setIdea(s.idea)}
                        >
                          {s.label}
                          <Icon name="plus" size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  <details className="context-details">
                    <summary>
                      <span>
                        <Icon name="folder" size={16} /> Add project context{" "}
                        <span className="optional">optional</span>
                      </span>
                      <Icon name="chevron" size={16} />
                    </summary>
                    <div className="context-fields">
                      <label className="field">
                        Existing project or useful background
                        <textarea
                          disabled={busy}
                          rows={3}
                          maxLength={12000}
                          value={context.notes}
                          placeholder="Current stack, repository structure, what already works, constraints…"
                          onChange={(e) =>
                            setContext({ ...context, notes: e.target.value })
                          }
                        />
                      </label>
                      <div className="field-grid">
                        {(
                          [
                            [
                              "budget",
                              "Budget",
                              "e.g. under ₹5,000 / month",
                              300,
                            ],
                            [
                              "stack",
                              "Preferred technologies",
                              "e.g. React, Python",
                              500,
                            ],
                            ["hosting", "Hosting", "e.g. local, Vercel", 300],
                            [
                              "audience",
                              "Intended audience",
                              "Who is this for?",
                              500,
                            ],
                          ] as const
                        ).map(([key, label, hint, max]) => (
                          <label className="field" key={key}>
                            {label}
                            <input
                              disabled={busy}
                              maxLength={max}
                              placeholder={hint}
                              value={context[key]}
                              onChange={(e) =>
                                setContext({
                                  ...context,
                                  [key]: e.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                        <label className="field">
                          Deadline
                          <input
                            disabled={busy}
                            type="date"
                            value={context.deadline}
                            onChange={(e) =>
                              setContext({
                                ...context,
                                deadline: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </details>
                  <div className="generation-options">
                    <div>
                      <label className="small-label" htmlFor="destination">
                        MADE FOR
                      </label>
                      <div className="select-wrap">
                        <Icon name="prompt" size={16} />
                        <select
                          id="destination"
                          disabled={busy}
                          value={tool}
                          onChange={(e) => setTool(e.target.value)}
                        >
                          {[
                            "Generic",
                            "Codex",
                            "Claude Code",
                            "Cursor",
                            "GitHub Copilot",
                            "Windsurf",
                            "Lovable",
                            "Bolt",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t === "Generic" ? "Any coding tool" : t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <span className="small-label">HOW SHOULD WE START?</span>
                      <div className="segmented">
                        <button
                          disabled={busy}
                          aria-pressed={approach === "quick"}
                          className={approach === "quick" ? "active" : ""}
                          onClick={() => setApproach("quick")}
                        >
                          <Icon name="spark" size={14} /> Quick draft
                        </button>
                        <button
                          disabled={busy}
                          aria-pressed={approach === "clarify"}
                          className={approach === "clarify" ? "active" : ""}
                          onClick={() => setApproach("clarify")}
                        >
                          Clarify first
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="approach-note">
                    {approach === "quick"
                      ? "Keep the momentum. We’ll label assumptions as we go."
                      : "A few focused questions first. Up to three per round."}
                  </p>
                  {relevantExamples.length > 0 && (
                    <details className="context-details">
                      <summary>
                        <span>
                          <Icon name="book" size={16} /> Approved references{" "}
                          <span className="optional">
                            {selectedExamples.length} / 3 selected
                          </span>
                        </span>
                        <Icon name="chevron" size={16} />
                      </summary>
                      {relevantExamples.map((e) => (
                        <label key={e.id} className="check-field">
                          <input
                            type="checkbox"
                            disabled={
                              busy ||
                              (!selectedExamples.includes(e.id) &&
                                selectedExamples.length >= 3)
                            }
                            checked={selectedExamples.includes(e.id)}
                            onChange={(event) =>
                              setSelectedExamples(
                                event.target.checked
                                  ? [...selectedExamples, e.id]
                                  : selectedExamples.filter(
                                      (id) => id !== e.id,
                                    ),
                              )
                            }
                          />
                          {e.title}
                        </label>
                      ))}
                    </details>
                  )}
                </div>
                <div className="generation-footer">
                  <div className="provider-line">
                    <span className="provider-symbol">
                      {settings?.value.provider === "openrouter" ? "O" : "G"}
                    </span>
                    <div>
                      <strong>
                        {settings?.value.provider === "openrouter"
                          ? "OpenRouter"
                          : "Groq"}
                        <span> · </span>
                        <span>
                          {settings?.value.models[settings.value.provider] ||
                            "Choose a model"}
                        </span>
                      </strong>
                      <span>
                        Ideas & selected context are sent to this provider.
                      </span>
                    </div>
                    <button
                      disabled={busy || !settings}
                      className="icon-button"
                      aria-label="Configure provider and model"
                      onClick={() => setShowSettings(true)}
                    >
                      <Icon name="settings" size={16} />
                    </button>
                  </div>
                  <div className="generate-row">
                    <button
                      className="text-button"
                      disabled={busy || !idea.trim()}
                      onClick={async () => {
                        try {
                          await saveProject();
                          setToast("Project saved.");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Icon name="folder" size={15} /> Save idea
                    </button>
                    {busy ? (
                      <button className="secondary" onClick={cancelGeneration}>
                        <Icon name="close" size={15} /> Cancel generation
                      </button>
                    ) : (
                      <button
                        className="primary generate-button"
                        disabled={!idea.trim() || !settings}
                        onClick={() => runGeneration()}
                      >
                        {mode === "prompt"
                          ? "Generate prompt"
                          : mode === "plan"
                            ? "Create plan"
                            : "Refine idea"}
                        <Icon name="arrow" size={17} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flow-note">
                <Icon name="shield" size={15} />
                <span>Built-in engineering review. You stay in control.</span>
                <span className="note-line" />
              </div>
              {messages.length > 0 && (
                <div className="panel conversation-panel">
                  <div className="panel-heading">
                    <div className="title-with-icon">
                      <Icon name="clock" size={17} />
                      <h2>Keep shaping it</h2>
                    </div>
                    <span className="optional">{messages.length} messages</span>
                  </div>
                  <div className="conversation-list">
                    {messages.map((m) => (
                      <details
                        key={m.id}
                        className={`conversation-message ${m.role}`}
                      >
                        <summary>
                          <span className="message-author">
                            {m.role === "user" ? "You" : "IdeaPrompt"}
                          </span>
                          <span>
                            {m.content.slice(0, 140)}
                            {m.content.length > 140 ? "…" : ""}
                          </span>
                          <Icon name="chevron" size={13} />
                        </summary>
                        <Markdown text={m.content} />
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() => {
                            setEditingMessage(m);
                            setMessageText(m.content);
                          }}
                        >
                          Edit message
                        </button>
                      </details>
                    ))}
                  </div>
                  <div className="followup">
                    <label className="field">
                      What would you like to change?
                      <textarea
                        rows={3}
                        disabled={busy}
                        value={followup}
                        maxLength={16000}
                        onChange={(e) => setFollowup(e.target.value)}
                        placeholder="Add a requirement, answer a question, or tell us what to rethink…"
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={busy || !followup.trim()}
                      onClick={() => runGeneration()}
                    >
                      Refine this project
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section
              className="panel output-panel"
              aria-label="Generated artifacts"
            >
              <div className="panel-heading">
                <div className="title-with-icon">
                  <span className="output-dot" />
                  <h2>Your build brief</h2>
                </div>
                <span className="pill">
                  {draft
                    ? "VERSION " +
                      (versions.length -
                        versions.findIndex((v) => v.id === selectedVersion.id))
                    : "THE NEXT STEP"}
                </span>
              </div>
              <div
                className="output-tabs"
                role="tablist"
                aria-label="Output sections"
              >
                {TABS.map((t, i) => (
                  <button
                    key={t}
                    id={`tab-${i}`}
                    role="tab"
                    aria-selected={tab === t}
                    aria-controls="output-content"
                    tabIndex={tab === t ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        const next = (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                        setTab(TABS[next]);
                        document.getElementById(`tab-${next}`)?.focus();
                      }
                    }}
                    onClick={() => setTab(t)}
                  >
                    {t}
                    {t === "Coverage" && draft?.coverage.length ? (
                      <span className="tab-count">{covered}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              {versions.length > 0 && (
                <div className="version-bar">
                  <label>
                    <Icon name="clock" size={14} />
                    <select
                      aria-label="Select saved version"
                      disabled={busy}
                      value={selectedVersion?.id || ""}
                      onChange={(e) => {
                        setVersionId(e.target.value);
                        setAnswers([]);
                      }}
                    >
                      {versions.map((v, i) => (
                        <option key={v.id} value={v.id}>
                          Version {versions.length - i} ·{" "}
                          {v.draft.kind === "questions"
                            ? "Clarification"
                            : v.mode}{" "}
                          ·{" "}
                          {new Date(v.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={busy}
                    aria-label="Delete selected version"
                    className="icon-button"
                    onClick={deleteVersion}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )}
              {busy && (
                <div className="stream-status" role="status">
                  <span className="spinner" />
                  <div>
                    <strong>{status}</strong>
                    <span>
                      {characters
                        ? `${characters.toLocaleString()} characters received · Your earlier draft stays safe`
                        : "Connecting to your selected model…"}
                    </span>
                  </div>
                </div>
              )}
              <div
                className={`output-content ${!draft ? "is-empty" : ""}`}
                id="output-content"
                role="tabpanel"
                aria-labelledby={`tab-${TABS.indexOf(tab)}`}
              >
                {!draft ? (
                  <div className="empty-output">
                    <TerminalEmptyVisual />
                    <span className="eyebrow">A CLEARER PATH FORWARD</span>
                    <h3>
                      Your idea, ready for
                      <br />
                      {" "}its next chapter.
                    </h3>
                    <p>
                      Add your starting point and we’ll turn it into a practical
                      brief, with the details that make a difference.
                    </p>
                    <div className="empty-features">
                      <span>
                        <Icon name="check" size={14} /> Clear scope &
                        requirements
                      </span>
                      <span>
                        <Icon name="check" size={14} /> Thoughtful engineering
                        checks
                      </span>
                      <span>
                        <Icon name="check" size={14} /> A prompt you can
                        actually use
                      </span>
                    </div>
                    <span className="empty-bottom">
                      The good kind of head start.
                    </span>
                  </div>
                ) : draft.kind === "questions" ? (
                  <div className="clarification">
                    <span className="eyebrow">
                      LET’S GET THE IMPORTANT PARTS RIGHT
                    </span>
                    <h3>A little context goes a long way.</h3>
                    <p className="muted">
                      Answer these questions to shape the next draft.
                    </p>
                    {draft.questions.map((q, i) => (
                      <label className="field" key={i}>
                        <span>
                          {i + 1}. {q}
                        </span>
                        <textarea
                          rows={2}
                          disabled={busy}
                          maxLength={4000}
                          value={answers[i] || ""}
                          onChange={(e) =>
                            setAnswers((a) => {
                              const next = [...a];
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                        />
                      </label>
                    ))}
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        draft.questions.some((_, i) => !answers[i]?.trim())
                      }
                      onClick={() =>
                        runGeneration(
                          draft.questions
                            .map(
                              (q, i) => `Question: ${q}\nAnswer: ${answers[i]}`,
                            )
                            .join("\n\n"),
                        )
                      }
                    >
                      Continue with answers
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                ) : tab === "Coverage" ? (
                  <>
                    <div className="coverage-intro">
                      <Icon name="shield" size={24} />
                      <div>
                        <h3>
                          {covered} of{" "}
                          {
                            draft.coverage.filter(
                              (c) => c.status !== "not applicable",
                            ).length
                          }{" "}
                          applicable controls specified
                        </h3>
                        <p>
                          Requirements coverage, not a security guarantee.
                          Checklist revision {selectedVersion.checklistVersion}.
                        </p>
                      </div>
                    </div>
                    {draft.coverage.length === 0 && (
                      <p className="help">
                        No checklist controls were enabled for this generation.
                      </p>
                    )}
                    {draft.coverage.map((c) => (
                      <details key={c.id} className="coverage-item">
                        <summary>
                          <span>
                            {selectedVersion.checklist.find(
                              (x) => x.id === c.id,
                            )?.title || c.id}
                          </span>
                          <span
                            className={`coverage-status ${c.status.replace(" ", "-")}`}
                          >
                            {c.status === "specified" && (
                              <Icon name="check" size={12} />
                            )}{" "}
                            {c.status}
                          </span>
                        </summary>
                        <p>{c.reason}</p>
                        {c.evidence && <blockquote>{c.evidence}</blockquote>}
                        {c.verification && (
                          <p>
                            <strong>Verify:</strong> {c.verification}
                          </p>
                        )}
                        <p className="help">
                          {
                            selectedVersion.checklist.find((x) => x.id === c.id)
                              ?.reference
                          }
                        </p>
                      </details>
                    ))}
                  </>
                ) : artifact ? (
                  <>
                    <Markdown text={artifact} />
                    {draft.assumptions.length > 0 && (
                      <details className="assumptions">
                        <summary>
                          Labeled assumptions{" "}
                          <span>{draft.assumptions.length}</span>
                          <Icon name="chevron" size={14} />
                        </summary>
                        {draft.assumptions.map((a, i) => (
                          <p key={i}>
                            {i + 1}. {a}
                          </p>
                        ))}
                      </details>
                    )}
                    {tab === "Execution prompt" &&
                      draft.phasePrompts.map((p, i) => (
                        <details className="phase-prompt" key={i}>
                          <summary>
                            <Icon name="plan" size={16} />
                            {p.title}
                            <Icon name="chevron" size={14} />
                          </summary>
                          <Markdown text={p.prompt} />
                          <button
                            className="text-button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(p.prompt);
                                setToast("Phase prompt copied.");
                              } catch {
                                setError("Clipboard access denied.");
                              }
                            }}
                          >
                            <Icon name="copy" size={14} /> Copy phase
                          </button>
                        </details>
                      ))}
                  </>
                ) : (
                  <div className="empty-artifact">
                    <Icon name="plan" size={30} />
                    <h3>This artifact hasn’t been generated yet.</h3>
                    <p>Choose the matching mode and generate a new version.</p>
                  </div>
                )}
              </div>
              {draft && (
                <footer className="output-footer">
                  <div className="output-actions">
                    <button
                      className="secondary"
                      disabled={busy || !artifact}
                      onClick={copy}
                    >
                      <Icon name="copy" size={15} /> Copy
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label="Export all artifacts as Markdown"
                      title="Export Markdown"
                      onClick={exportMarkdown}
                    >
                      <Icon name="download" size={17} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy || !artifact}
                      aria-label="Edit this artifact"
                      title="Edit artifact"
                      onClick={() => {
                        setArtifactText(artifact || "");
                        setEditArtifact(true);
                      }}
                    >
                      <Icon name="plan" size={17} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label="Regenerate selected mode"
                      title="Regenerate"
                      onClick={() => runGeneration()}
                    >
                      <Icon name="refresh" size={17} />
                    </button>
                    <button
                      className="text-button feedback-link"
                      disabled={busy}
                      onClick={openFeedback}
                    >
                      Give feedback
                    </button>
                  </div>
                  <div className="version-meta">
                    {selectedVersion.provider} · {selectedVersion.model} ·
                    Template {selectedVersion.templateVersion}
                  </div>
                  {draft.kind === "draft" && (
                    <button
                      className="text-button approve-button"
                      disabled={busy || !artifact}
                      onClick={() => {
                        setExampleTitle(
                          project?.title.slice(0, 100) || "Approved example",
                        );
                        setExampleText((artifact || "").slice(0, 16000));
                        setExampleGlobal(false);
                        setExampleOpen(true);
                      }}
                    >
                      <Icon name="book" size={14} /> Approve as a reusable
                      example
                    </button>
                  )}
                </footer>
              )}
            </section>
          </div>
          <footer className="page-footer">
            <span>Made for the moment before you start building.</span>
            <span>YOUR IDEA → A CLEAR PLAN → A BETTER BUILD</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {showSettings && settings && (
        <SettingsModal
          current={settings}
          examples={examples}
          onClose={() => setShowSettings(false)}
          onSave={reloadSettings}
          refreshExamples={reloadExamples}
          onReset={async () => {
            newProject();
            await Promise.all([
              reloadSettings(),
              reloadExamples(),
              reloadProjects(),
            ]);
          }}
        />
      )}
      {editingProject && project && (
        <Modal title="Project details" onClose={() => setEditingProject(false)}>
          <form
            className="settings-body"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const p = await request<Project>(
                  `/api/projects/${project.id}`,
                  "PATCH",
                  { title, idea, context },
                );
                setProject(p);
                await reloadProjects();
                setEditingProject(false);
                setToast("Project updated.");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label className="field">
              Project name
              <input
                autoFocus
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                Save changes
              </button>
              <button
                type="button"
                className="text-button danger-text"
                onClick={async () => {
                  if (
                    window.confirm(
                      "Delete this project and its conversation, versions and associated examples?",
                    )
                  ) {
                    try {
                      await request(
                        `/api/projects/${project.id}`,
                        "DELETE",
                        {},
                      );
                      newProject();
                      await Promise.all([reloadProjects(), reloadExamples()]);
                      setEditingProject(false);
                      setToast("Project deleted.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }
                }}
              >
                Delete project
              </button>
            </div>
          </form>
        </Modal>
      )}
      {feedbackOpen && selectedVersion && (
        <Modal
          title="Help the next draft get better"
          onClose={() => setFeedbackOpen(false)}
        >
          <form
            className="settings-body"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await request(`/api/versions/${selectedVersion.id}`, "PATCH", {
                  rating,
                  correction,
                  outcome,
                });
                setVersions((vs) =>
                  vs.map((v) =>
                    v.id === selectedVersion.id
                      ? { ...v, rating, correction, outcome }
                      : v,
                  ),
                );
                setFeedbackOpen(false);
                setToast(
                  "Feedback saved. Corrections only affect generation when you send them.",
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label className="field">
              How useful was this draft?
              <select
                value={rating || ""}
                onChange={(e) =>
                  setRating(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5{" "}
                    {n === 5 ? "— Very useful" : n === 1 ? "— Needs work" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Corrections
              <textarea
                rows={4}
                maxLength={8000}
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                placeholder="What should change?"
              />
            </label>
            <label className="field">
              Implementation outcome (optional)
              <textarea
                rows={3}
                maxLength={8000}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What happened when you used this prompt?"
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                Save feedback
              </button>
              <button
                className="secondary"
                type="button"
                disabled={!correction.trim()}
                onClick={() => {
                  setFollowup(correction);
                  setFeedbackOpen(false);
                  setToast(
                    "Correction added to your follow-up. Send it when ready.",
                  );
                }}
              >
                Use correction in follow-up
              </button>
            </div>
            <p className="help">
              Learning comes from actual outputs and build outcomes, not
              checklist counts. Nothing here automatically updates your approved
              preferences.
            </p>
          </form>
        </Modal>
      )}
      {exampleOpen && (
        <Modal
          title="Approve a reference"
          onClose={() => setExampleOpen(false)}
        >
          <form
            className="settings-body"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await request("/api/examples", "POST", {
                  title: exampleTitle,
                  content: exampleText,
                  projectId: exampleGlobal ? null : project?.id || null,
                });
                await reloadExamples();
                setExampleOpen(false);
                setToast(
                  "Approved example saved. Select it explicitly in future generations.",
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <p className="muted">
              Review and edit this reference before approving it. It will be
              treated as reference data, not instructions that override security
              rules.
            </p>
            <label className="field">
              Title
              <input
                required
                maxLength={100}
                value={exampleTitle}
                onChange={(e) => setExampleTitle(e.target.value)}
              />
            </label>
            <label className="field">
              Approved reference
              <textarea
                required
                rows={9}
                maxLength={16000}
                value={exampleText}
                onChange={(e) => setExampleText(e.target.value)}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={exampleGlobal}
                onChange={(e) => setExampleGlobal(e.target.checked)}
              />{" "}
              Make available across my projects
            </label>
            <button className="primary" type="submit">
              Approve & save
              <Icon name="check" size={16} />
            </button>
          </form>
        </Modal>
      )}
      {editArtifact && selectedVersion && (
        <Modal
          title="Edit the saved artifact"
          onClose={() => setEditArtifact(false)}
        >
          <form
            className="settings-body"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const key =
                  tab === "Refined idea"
                    ? "refinedIdea"
                    : tab === "Implementation"
                      ? "implementationPlan"
                      : "executionPrompt";
                const newDraft: Draft = {
                  ...selectedVersion.draft,
                  [key]: artifactText,
                };
                const result = await request<{ draft: Draft }>(
                  `/api/versions/${selectedVersion.id}`,
                  "PUT",
                  { draft: newDraft },
                );
                setVersions((vs) =>
                  vs.map((v) =>
                    v.id === selectedVersion.id
                      ? { ...v, draft: result.draft }
                      : v,
                  ),
                );
                setEditArtifact(false);
                setToast(
                  "Artifact updated. Coverage is marked for review; regenerate to review it again.",
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <p className="help">
              Manual edits invalidate coverage claims. Regenerate to obtain a
              new reviewed version; export before editing if you want a copy of
              the original.
            </p>
            <label className="field">
              {tab}
              <textarea
                required
                rows={16}
                maxLength={70000}
                value={artifactText}
                onChange={(e) => setArtifactText(e.target.value)}
              />
            </label>
            <button className="primary" type="submit">
              Save edited artifact
            </button>
          </form>
        </Modal>
      )}
      {editingMessage && (
        <Modal
          title="Edit conversation"
          onClose={() => setEditingMessage(null)}
        >
          <form
            className="settings-body"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await request(`/api/messages/${editingMessage.id}`, "PATCH", {
                  content: messageText,
                });
                setMessages((ms) =>
                  ms.map((m) =>
                    m.id === editingMessage.id
                      ? { ...m, content: messageText }
                      : m,
                  ),
                );
                setEditingMessage(null);
                setToast(
                  "Conversation updated. Saved artifacts are unchanged.",
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <p className="help">
              Conversation edits affect future context. Existing prompt versions
              retain their own text.
            </p>
            <label className="field">
              Message
              <textarea
                required
                rows={12}
                maxLength={70000}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                Save message
              </button>
              <button
                type="button"
                className="text-button danger-text"
                onClick={async () => {
                  if (window.confirm("Delete this conversation message?")) {
                    try {
                      await request(
                        `/api/messages/${editingMessage.id}`,
                        "DELETE",
                        {},
                      );
                      setMessages((ms) =>
                        ms.filter((m) => m.id !== editingMessage.id),
                      );
                      setEditingMessage(null);
                      setToast("Message deleted.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }
                }}
              >
                Delete message
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
