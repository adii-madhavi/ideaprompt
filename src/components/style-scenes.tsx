"use client";

import { useEffect, useRef } from "react";

// Finite heading decode inspired by React Bits' Decrypted Text.
function DecodeHeading({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    const text = "Clear instructions.";
    if (!el) return;
    el.textContent = text;
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      el.textContent = [...text].map((letter, i) => i < frame / 2 || letter === " " ? letter : "01[]{}<>"[(frame + i * 3) % 8]).join("");
      if (frame >= text.length * 2) window.clearInterval(timer);
    }, 32);
    return () => window.clearInterval(timer);
  }, [paused]);
  return <span aria-label="Clear instructions."><span ref={ref} aria-hidden="true">Clear instructions.</span></span>;
}

export function TerminalIntro({ paused }: { paused: boolean }) {
  return (
    <section className="intro scene-intro terminal-intro">
      <div className="scene-copy"><div className="scene-eyebrow">IdeaPrompt / Command workspace</div>
        <h1>Big ideas.<br /><DecodeHeading paused={paused} /></h1>
        <p>Capture the intent. Resolve the unknowns. Compile a brief you can build.</p></div>
      <div className="signal-display" aria-hidden="true"><div className="signal-bars">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ "--bar": i, "--amplitude": `${18 + ((i * 17) % 65)}%` } as React.CSSProperties} />)}</div><span>INPUT → CLARITY → EXECUTION</span></div>
    </section>
  );
}

export function TerminalEmptyVisual() {
  return <div className="style-empty-visual terminal-empty" aria-hidden="true">
    <span className="terminal-await">&gt; awaiting_idea<span className="terminal-caret">▌</span></span>
  </div>;
}
