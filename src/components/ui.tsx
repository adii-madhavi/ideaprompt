"use client";
import { useEffect, useRef, type ReactNode } from "react";

export type IconName =
  | "spark"
  | "plus"
  | "folder"
  | "clock"
  | "settings"
  | "arrow"
  | "check"
  | "copy"
  | "download"
  | "close"
  | "search"
  | "plan"
  | "prompt"
  | "shield"
  | "chevron"
  | "refresh"
  | "trash"
  | "menu"
  | "book"
  | "external";
export function Icon({
  name,
  size = 18,
  ...props
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    spark: (
      <>
        <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z" />
        <path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    folder: <path d="M3 7V5h6l2 2h10v13H3Z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1 2-3-2-2V7l-3-1-1-3Z" />
        <circle cx="11" cy="11" r="3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    plan: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </>
    ),
    prompt: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 18" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    refresh: (
      <>
        <path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    book: (
      <>
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
        <path d="M12 5v15" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
export async function request<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "The request failed.");
  return value;
}
export function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <header className="modal-head">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
// Markdown is displayed with text nodes only; links, images and HTML are never interpreted.
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="markdown">
      {blocks.map((block, i) =>
        block.startsWith("```") ? (
          <pre key={i}>
            <code>
              {block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}
            </code>
          </pre>
        ) : (
          block.split("\n").map((line, j) => {
            const key = `${i}-${j}`;
            if (/^#{1,3}\s/.test(line))
              return <h3 key={key}>{line.replace(/^#{1,3}\s+/, "")}</h3>;
            if (/^[-*]\s/.test(line))
              return (
                <p className="md-list" key={key}>
                  • {line.slice(2)}
                </p>
              );
            if (!line.trim()) return <div className="md-space" key={key} />;
            return (
              <p key={key}>
                {line
                  .split(/(\*\*[^*]+\*\*)/)
                  .map((s, k) =>
                    s.startsWith("**") ? (
                      <strong key={k}>{s.slice(2, -2)}</strong>
                    ) : (
                      <span key={k}>{s}</span>
                    ),
                  )}
              </p>
            );
          })
        ),
      )}
    </div>
  );
}
