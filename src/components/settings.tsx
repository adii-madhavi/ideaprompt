"use client";
import { useEffect, useState } from "react";
import type { Settings, Example, Control } from "@/lib/schema";
import { DEFAULT_CONTROLS } from "@/lib/checklist";
import { Icon, Modal, request, download } from "./ui";
export type SettingsResponse = {
  value: Settings;
  checklistVersion: number;
  connected: Record<"groq" | "openrouter", boolean>;
  checklistHistory: {
    version: number;
    controls: Control[];
    createdAt: string;
  }[];
};

export function SettingsModal({
  current,
  examples,
  onClose,
  onSave,
  onReset,
  refreshExamples,
}: {
  current: SettingsResponse;
  examples: Example[];
  onClose: () => void;
  onSave: () => Promise<void>;
  onReset: () => Promise<void>;
  refreshExamples: () => Promise<void>;
}) {
  const [tab, setTab] = useState("Connections"),
    [value, setValue] = useState<Settings>(structuredClone(current.value));
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [catalog, setCatalog] = useState<{
    provider: Settings["provider"];
    models: string[];
    error?: string;
  } | null>(null);
  const [catalogRefresh, setCatalogRefresh] = useState(0),
    [query, setQuery] = useState("");
  const [editingExample, setEditingExample] = useState<Example | null>(null);
  const [exampleTitle, setExampleTitle] = useState(""),
    [exampleContent, setExampleContent] = useState("");
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const provider = value.provider;
  const loadingModels = catalog?.provider !== provider;
  const models = catalog?.provider === provider ? catalog.models : [];
  useEffect(() => {
    let current = true;
    request<{ models: string[] }>("/api/provider", "POST", {
      action: "models",
      provider,
    })
      .then((response) => {
        if (current)
          setCatalog({
            provider,
            models: [...new Set(response.models)]
              .filter((model) => model !== "openrouter/auto")
              .sort(),
          });
      })
      .catch((e) => {
        if (current)
          setCatalog({ provider, models: [], error: (e as Error).message });
      });
    return () => {
      current = false;
    };
  }, [provider, catalogRefresh]);
  const updateControl = (id: string, update: Partial<Control>) =>
    setValue({
      ...value,
      controls: value.controls.map((c) =>
        c.id === id ? { ...c, ...update } : c,
      ),
    });
  return (
    <Modal title="Make it yours" onClose={onClose}>
      <nav className="settings-tabs" aria-label="Settings sections">
        {["Connections", "Preferences", "Checklist", "Memory"].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => {
              setTab(t);
              setNotice("");
              setError("");
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="settings-body">
        {tab === "Connections" && (
          <>
            <h3>Free models only.</h3>
            <p className="muted">
              Keys stay on your server. Only this connection receives the ideas
              and context you choose to send.
            </p>
            <div className="provider-choices">
              {(["groq", "openrouter"] as const).map((p) => (
                <button
                  key={p}
                  className={provider === p ? "selected" : ""}
                  onClick={() => {
                    setValue({ ...value, provider: p });
                    if (p !== provider) setCatalog(null);
                  }}
                >
                  <strong>{p === "groq" ? "Groq" : "OpenRouter"}</strong>
                  <span
                    className={
                      current.connected[p] ? "connection yes" : "connection"
                    }
                  >
                    {current.connected[p]
                      ? "Server key configured"
                      : "Server key needed"}
                  </span>
                </button>
              ))}
            </div>
            <label className="field">
              Model
              <select
                value={
                  models.includes(value.models[provider])
                    ? value.models[provider]
                    : ""
                }
                disabled={busy || loadingModels || models.length === 0}
                onChange={(e) =>
                  setValue({
                    ...value,
                    models: { ...value.models, [provider]: e.target.value },
                  })
                }
              >
                <option value="">
                  {loadingModels
                    ? "Loading free models…"
                    : models.length
                      ? "Select a free model"
                      : "No free models available"}
                </option>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            {loadingModels && (
              <p className="help" role="status">
                Fetching the selected provider’s catalog…
              </p>
            )}
            {!loadingModels && catalog?.error && (
              <p className="notice error" role="alert">
                {catalog.error}
              </p>
            )}
            {!loadingModels && !catalog?.error && (
              <p className="help" role="status">
                {models.length
                  ? `${models.length} ${provider === "groq" ? "Free plan chat" : "free chat"} models available. Free usage has rate limits.`
                  : "No eligible free chat models were found. Check your key permissions and refresh."}
              </p>
            )}
            {!loadingModels &&
              value.models[provider] &&
              !models.includes(value.models[provider]) && (
                <p className="help">
                  Your saved model is excluded. Select a model from the free
                  list.
                </p>
              )}
            {provider === "groq" ? (
              <>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={value.groqFreePlanConfirmed}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        groqFreePlanConfirmed: e.target.checked,
                      })
                    }
                  />
                  My Groq organization is on the Free plan
                </label>
                <p className="help">
                  Check your plan in the{" "}
                  <a
                    href="https://console.groq.com/settings/billing"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Groq console
                  </a>
                  . The app cannot verify your billing tier. These models are
                  billed on the Developer plan; clear this confirmation if you
                  upgrade.
                </p>
              </>
            ) : (
              <p className="help">
                Only zero-priced :free variants are listed. Requests enforce a
                zero-price ceiling and never fall back to a paid model.
              </p>
            )}
            <div className="button-row">
              <button
                disabled={busy || loadingModels}
                className="secondary"
                onClick={() => {
                  setCatalog(null);
                  setCatalogRefresh((n) => n + 1);
                }}
              >
                <Icon name="refresh" /> Refresh models
              </button>
              <button
                className="secondary"
                disabled={
                  busy ||
                  loadingModels ||
                  !models.includes(value.models[provider]) ||
                  (provider === "groq" && !value.groqFreePlanConfirmed)
                }
                onClick={() =>
                  action(async () => {
                    await request("/api/settings", "PUT", value);
                    await onSave();
                    const r = await request<{ message: string }>(
                      "/api/provider",
                      "POST",
                      {
                        action: "test",
                        provider,
                        model: value.models[provider],
                      },
                    );
                    setNotice(r.message);
                  })
                }
              >
                <Icon name="check" /> Save & test connection
              </button>
            </div>
            <div className="info-box">
              <Icon name="shield" />
              <div>
                <strong>Private by design, local by default</strong>
                <p>
                  Add{" "}
                  {provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY"}{" "}
                  to <code>.env</code> or <code>.env.local</code> and restart.
                  The app never asks for your key in the browser.
                </p>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                Output token limit
                <input
                  type="number"
                  min={1024}
                  max={12000}
                  value={value.maxTokens}
                  onChange={(e) =>
                    setValue({ ...value, maxTokens: Number(e.target.value) })
                  }
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={value.stream}
                  onChange={(e) =>
                    setValue({ ...value, stream: e.target.checked })
                  }
                />{" "}
                Stream provider responses
              </label>
            </div>
            {provider === "openrouter" ? (
              <>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={value.openRouterZdr}
                    onChange={(e) =>
                      setValue({ ...value, openRouterZdr: e.target.checked })
                    }
                  />{" "}
                  Require zero data retention endpoints
                </label>
                <p className="help">
                  Requests always deny provider data collection and disable
                  endpoint fallback. ZDR may limit model availability.
                  OpenRouter routes your selected model to an eligible upstream
                  endpoint. Review your account logging and training settings.
                </p>
                <a
                  className="text-link"
                  href="https://openrouter.ai/docs/guides/privacy-and-logging"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenRouter privacy documentation{" "}
                  <Icon name="external" size={13} />
                </a>
              </>
            ) : (
              <>
                <p className="help">
                  Enable Zero Data Retention in Groq’s organization Data
                  Controls. Inference data can otherwise be retained for
                  reliability or abuse monitoring. This setting cannot be
                  enabled through the app.
                </p>
                <a
                  className="text-link"
                  href="https://console.groq.com/docs/your-data"
                  target="_blank"
                  rel="noreferrer"
                >
                  Groq data controls <Icon name="external" size={13} />
                </a>
              </>
            )}
          </>
        )}
        {tab === "Preferences" && (
          <>
            <h3>A starting point that feels like you.</h3>
            <p className="muted">
              Saving explicitly approves these reusable preferences.
              Project-specific choices take precedence.
            </p>
            {(
              [
                [
                  "stack",
                  "Preferred technologies",
                  "e.g. Next.js, TypeScript, SQLite",
                ],
                [
                  "style",
                  "Prompt style",
                  "e.g. concise, phased, with acceptance criteria",
                ],
                [
                  "budget",
                  "Usual budget",
                  "e.g. free services where practical",
                ],
                [
                  "hosting",
                  "Preferred deployment",
                  "e.g. a local server or Vercel",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <label className="field" key={key}>
                {label}
                <input
                  maxLength={key === "budget" || key === "hosting" ? 300 : 500}
                  value={value.preferences[key]}
                  placeholder={hint}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      preferences: {
                        ...value.preferences,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
            <button
              className="text-button"
              onClick={() =>
                setValue({
                  ...value,
                  preferences: {
                    stack: "",
                    style: "",
                    budget: "",
                    hosting: "",
                  },
                })
              }
            >
              Clear preferences
            </button>
          </>
        )}
        {tab === "Checklist" && (
          <>
            <div className="section-row">
              <div>
                <h3>Engineering coverage</h3>
                <p className="muted">
                  Revision {current.checklistVersion}. Every change creates a
                  saved revision.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  setValue({
                    ...value,
                    controls: structuredClone(DEFAULT_CONTROLS),
                  })
                }
              >
                Restore defaults
              </button>
            </div>
            <p className="help">
              Applicable controls are reviewed and repaired before a draft is
              presented. Coverage describes the text, not the security of a
              built application. Custom reference labels are your annotations;
              only the default ASVS IDs have been checked.
            </p>
            <label className="field">
              Restore a previous revision
              <select
                defaultValue=""
                onChange={(e) => {
                  const old = current.checklistHistory.find(
                    (h) => h.version === Number(e.target.value),
                  );
                  if (old) setValue({ ...value, controls: old.controls });
                }}
              >
                <option value="">Choose saved revision</option>
                {current.checklistHistory.map((h) => (
                  <option key={h.version} value={h.version}>
                    Revision {h.version} ·{" "}
                    {new Date(h.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            {value.controls.map((c) => (
              <details key={c.id} className="control-editor">
                <summary>
                  <span className="control-title">
                    <input
                      aria-label={`Include ${c.title}`}
                      type="checkbox"
                      checked={c.enabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateControl(c.id, { enabled: e.target.checked })
                      }
                    />
                    {c.title}
                  </span>
                  <Icon name="chevron" size={14} />
                </summary>
                <label className="field">
                  Title
                  <input
                    value={c.title}
                    maxLength={120}
                    onChange={(e) =>
                      updateControl(c.id, { title: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Requirement
                  <textarea
                    rows={3}
                    maxLength={1200}
                    value={c.requirement}
                    onChange={(e) =>
                      updateControl(c.id, { requirement: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Verification
                  <textarea
                    rows={2}
                    maxLength={800}
                    value={c.verification}
                    onChange={(e) =>
                      updateControl(c.id, { verification: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Reference
                  <input
                    maxLength={200}
                    value={c.reference}
                    onChange={(e) =>
                      updateControl(c.id, { reference: e.target.value })
                    }
                  />
                </label>
                <button
                  className="text-button danger-text"
                  disabled={value.controls.length <= 1}
                  onClick={() =>
                    setValue({
                      ...value,
                      controls: value.controls.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  Remove control
                </button>
              </details>
            ))}
            <button
              className="secondary"
              disabled={value.controls.length >= 30}
              onClick={() =>
                setValue({
                  ...value,
                  controls: [
                    ...value.controls,
                    {
                      id: "custom-" + crypto.randomUUID().slice(0, 8),
                      title: "Custom control",
                      requirement: "Define the concrete requirement.",
                      verification: "Define a testable verification step.",
                      reference: "Owner-defined control",
                      enabled: true,
                    },
                  ],
                })
              }
            >
              <Icon name="plus" /> Add control
            </button>
          </>
        )}
        {tab === "Memory" && (
          <>
            <h3>Remember only what you approve.</h3>
            <p className="muted">
              Answers never become trusted knowledge automatically. Select up to
              three approved references when generating; your full history is
              never sent.
            </p>
            <label className="field">
              Search approved examples
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or content…"
              />
            </label>
            {examples
              .filter((e) =>
                (e.title + e.content)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((e) => (
                <div className="memory-row" key={e.id}>
                  <div>
                    <strong>{e.title}</strong>
                    <span>
                      {e.projectId
                        ? "Associated with one project"
                        : "Reusable across your projects"}
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditingExample(e);
                      setExampleTitle(e.title);
                      setExampleContent(e.content);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    aria-label={`Delete ${e.title}`}
                    className="icon-button"
                    onClick={() =>
                      action(async () => {
                        await request("/api/examples", "DELETE", { id: e.id });
                        await refreshExamples();
                      })
                    }
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            {!examples.length && (
              <p className="empty-small">
                No approved examples yet. Add a lesson or approve an output you
                want to reuse.
              </p>
            )}
            <label className="field">
              {editingExample
                ? "Edit approved example"
                : "New reusable lesson or example"}
              <input
                maxLength={100}
                value={exampleTitle}
                onChange={(e) => setExampleTitle(e.target.value)}
                placeholder="Give it a short title"
              />
            </label>
            <label className="field">
              Reference text
              <textarea
                rows={4}
                maxLength={16000}
                value={exampleContent}
                onChange={(e) => setExampleContent(e.target.value)}
                placeholder="An approach, correction, or example worth remembering…"
              />
            </label>
            <div className="button-row">
              <button
                className="secondary"
                disabled={
                  busy || !exampleTitle.trim() || !exampleContent.trim()
                }
                onClick={() =>
                  action(async () => {
                    await request("/api/examples", "POST", {
                      title: exampleTitle,
                      content: exampleContent,
                      projectId: editingExample?.projectId || null,
                      ...(editingExample ? { id: editingExample.id } : {}),
                    });
                    await refreshExamples();
                    setEditingExample(null);
                    setExampleTitle("");
                    setExampleContent("");
                    setNotice("Approved reference saved.");
                  })
                }
              >
                <Icon name="check" /> Approve & save
              </button>
              {editingExample && (
                <button
                  className="text-button"
                  onClick={() => {
                    setEditingExample(null);
                    setExampleTitle("");
                    setExampleContent("");
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
            <hr />
            <div className="section-row">
              <div>
                <strong>Your data belongs to you.</strong>
                <p className="help">
                  Export projects, conversations, versions, preferences and
                  checklist history.
                </p>
              </div>
              <button
                disabled={busy}
                className="secondary"
                onClick={() =>
                  action(async () => {
                    const data = await request("/api/data");
                    download(
                      "ideaprompt-backup.json",
                      JSON.stringify(data, null, 2),
                      "application/json",
                    );
                    setNotice("Workspace exported.");
                  })
                }
              >
                <Icon name="download" /> Export all
              </button>
            </div>
            <button
              disabled={busy}
              className="text-button danger-text"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete every project, conversation, version, example and preference? This cannot be undone. Export your data first if needed.",
                  )
                )
                  action(async () => {
                    await request("/api/data", "DELETE", {
                      confirmation: "RESET",
                    });
                    await onReset();
                    onClose();
                  });
              }}
            >
              Reset all workspace data
            </button>
          </>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice success" role="status">
            {notice}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <p className="help">Single owner · Stored locally in SQLite</p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await request("/api/settings", "PUT", value);
              await onSave();
              setNotice(
                "Settings saved. Preferences are approved for future generations.",
              );
            })
          }
        >
          {busy ? "Working…" : "Save settings"}
          <Icon name="check" size={16} />
        </button>
      </footer>
    </Modal>
  );
}
