"use client";
import { useEffect, useState } from "react";
import type {
  Settings,
  Example,
  Control,
  ProviderId,
} from "@/lib/schema";
import { DEFAULT_CONTROLS } from "@/lib/checklist";
import { Icon, Modal, request, download } from "./ui";
export type SettingsResponse = {
  value: Settings;
  checklistVersion: number;
  connected: Record<ProviderId, boolean>;
  providers: {
    id: ProviderId;
    label: string;
    note: string;
    keyEnv: string[];
    keyUrl: string;
    hasKey: boolean;
    hasFallbackKey: boolean;
    defaultModel: string;
    model: string;
    limited: boolean;
  }[];
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
  const [catalogs, setCatalogs] = useState<
    Partial<Record<ProviderId, { id: string; free: boolean }[]>>
  >({});
  const [query, setQuery] = useState("");
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
  const [loadingModels, setLoadingModels] = useState<ProviderId[]>([]);
  const [modelErrors, setModelErrors] = useState<
    Partial<Record<ProviderId, string>>
  >({});
  async function fetchModels(id: ProviderId) {
    setLoadingModels((l) => [...l, id]);
    try {
      const r = await request<{ models: { id: string; free: boolean }[] }>(
        "/api/provider",
        "POST",
        { action: "models", provider: id },
      );
      setCatalogs((c) => ({ ...c, [id]: r.models }));
      setModelErrors((e) => ({ ...e, [id]: undefined }));
    } catch (e) {
      setModelErrors((m) => ({ ...m, [id]: (e as Error).message }));
    } finally {
      setLoadingModels((l) => l.filter((x) => x !== id));
    }
  }
  // Every provider that has a key lists its models as soon as Settings opens.
  useEffect(() => {
    for (const info of current.providers) if (info.hasKey) void fetchModels(info.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const moveProvider = (index: number, by: -1 | 1) => {
    const order = [...value.order];
    [order[index], order[index + by]] = [order[index + by], order[index]];
    setValue({ ...value, order });
  };
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
            <h3>Provider routing.</h3>
            <p className="muted">
              Providers are tried top to bottom and the first one that answers
              wins. A provider with no key or no model is skipped. Keys live in{" "}
              <code>.env</code> on your server, never in the browser.
            </p>
            <ol className="route-list">
              {value.order.map((id, index) => {
                const info = current.providers.find((p) => p.id === id);
                if (!info) return null;
                const chosen = value.models[id] ?? "";
                const ready =
                  info.hasKey && Boolean(chosen.trim() || info.defaultModel);
                return (
                  <li key={id} className={`route ${ready ? "ready" : ""}`}>
                    <div className="route-head">
                      <span className="route-rank">{index + 1}</span>
                      <strong>{info.label}</strong>
                      <span className={ready ? "connection yes" : "connection"}>
                        {!info.hasKey
                          ? "Key needed"
                          : ready
                            ? "Ready"
                            : "Pick a model"}
                      </span>
                      <span className="route-moves">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Move ${info.label} up`}
                          disabled={index === 0}
                          onClick={() => moveProvider(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Move ${info.label} down`}
                          disabled={index === value.order.length - 1}
                          onClick={() => moveProvider(index, 1)}
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                    <label className="field">
                      Model
                      <select
                        value={chosen}
                        disabled={busy || !info.hasKey}
                        onChange={(e) =>
                          setValue({
                            ...value,
                            models: { ...value.models, [id]: e.target.value },
                          })
                        }
                      >
                        <option value="">
                          {info.defaultModel
                            ? `Default (${info.defaultModel})`
                            : loadingModels.includes(id)
                              ? "Loading models…"
                              : "Select a model"}
                        </option>
                        {chosen && !(catalogs[id] ?? []).some((m) => m.id === chosen) && (
                          <option value={chosen}>{chosen}</option>
                        )}
                        {(catalogs[id] ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                            {m.free ? " · free" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {loadingModels.includes(id) && (
                      <p className="help" role="status">
                        Fetching {info.label} models…
                      </p>
                    )}
                    {modelErrors[id] && (
                      <p className="notice error" role="alert">
                        {modelErrors[id]}
                      </p>
                    )}
                    {info.limited && (
                      <label className="field">
                        Output token limit (this provider only)
                        <input
                          type="number"
                          min={512}
                          max={8000}
                          value={value.groqMaxTokens}
                          onChange={(e) =>
                            setValue({
                              ...value,
                              groqMaxTokens: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    <p className="help">
                      {info.note}
                      {!info.hasKey && (
                        <>
                          {" "}
                          Add <code>{info.keyEnv.join(" + ")}</code> to{" "}
                          <code>.env</code>, then restart.{" "}
                          <a href={info.keyUrl} target="_blank" rel="noreferrer">
                            Get a key
                          </a>
                        </>
                      )}
                    </p>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy || !info.hasKey || loadingModels.includes(id)}
                        onClick={() => void fetchModels(id)}
                      >
                        <Icon name="refresh" /> Refresh models
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy || !info.hasKey}
                        onClick={() =>
                          action(async () => {
                            const r = await request<{ message: string }>(
                              "/api/provider",
                              "POST",
                              { action: "test", provider: id, model: chosen },
                            );
                            setNotice(r.message);
                          })
                        }
                      >
                        <Icon name="check" /> Test
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
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
            <div className="info-box">
              <Icon name="shield" />
              <div>
                <strong>Private by design, local by default</strong>
                <p>
                  Only the providers above receive your ideas and context. A
                  second key for the same provider can be set as{" "}
                  <code>GROQ_API_KEY_FALLBACK</code> (likewise for the others);
                  it takes over when the first is out of quota.
                </p>
              </div>
            </div>
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
