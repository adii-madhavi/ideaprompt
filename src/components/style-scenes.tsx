"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./ui";

export type VisualStyle = "original" | "atelier" | "blueprint" | "terminal" | "brutalist";

// Original CSS implementations inspired by React Bits' Decrypted Text and
// UI Layouts' Blocks / Clip-Path. No WebGL context or animation dependency.
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

export function StyleIntro({ style, paused }: { style: VisualStyle; paused: boolean }) {
  if (style === "original") return (
    <section className="intro">
      <div><div className="intro-tag"><span /> FROM A SPARK TO A STARTING POINT</div>
        <h1>Big ideas. <span>Clear instructions.</span></h1>
        <p>Turn what’s in your head into something you can build.</p></div>
      <div className="intro-art" aria-hidden="true"><span className="art-dot">✳</span><div className="art-line" /><span className="art-end"><Icon name="prompt" size={26} /></span></div>
    </section>
  );
  if (style === "atelier") return (
    <section className="intro scene-intro atelier-intro">
      <div className="scene-copy"><div className="scene-eyebrow">A little room for big thinking</div>
        <h1>Give your idea<br /><span>room to grow.</span></h1>
        <p>Start with a thought. Shape it into a clear, considered brief for whatever comes next.</p>
        <a className="scene-link" href="#idea-input">Put your idea on paper <span>↗</span></a></div>
      <div className="atelier-sculpture" aria-hidden="true"><div className="paper-fan">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--leaf": i } as React.CSSProperties} />)}</div><span className="sculpture-circle" /><span className="sculpture-caption">A thought taking shape</span></div>
    </section>
  );
  if (style === "blueprint") return (
    <section className="intro scene-intro blueprint-intro">
      <div className="scene-copy"><div className="scene-eyebrow">Your next build starts here</div>
        <h1>Think in possibilities.<br /><span>Build with precision.</span></h1>
        <p>A working canvas for turning a rough concept into a practical specification.</p></div>
      <div className="blueprint-object" aria-hidden="true"><div className="iso-block block-a" /><div className="iso-block block-b" /><div className="iso-block block-c" /><span className="object-orbit" /></div>
    </section>
  );
  if (style === "terminal") return (
    <section className="intro scene-intro terminal-intro">
      <div className="scene-copy"><div className="scene-eyebrow">IdeaPrompt / Command workspace</div>
        <h1>Big ideas.<br /><DecodeHeading paused={paused} /></h1>
        <p>Capture the intent. Resolve the unknowns. Compile a brief you can build.</p></div>
      <div className="signal-display" aria-hidden="true"><div className="signal-bars">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ "--bar": i, "--amplitude": `${18 + ((i * 17) % 65)}%` } as React.CSSProperties} />)}</div><span>INPUT → CLARITY → EXECUTION</span></div>
    </section>
  );
  return (
    <section className="intro scene-intro poster-intro">
      <div className="scene-copy"><div className="scene-eyebrow">Stop circling. Start making.</div>
        <h1>BIG IDEA?<br /><span>MAKE IT REAL.</span></h1>
        <p>Less guesswork. More doing. Your next great build starts with one messy thought.</p>
        <a className="poster-link" href="#idea-input">LET’S BUILD <span>↗</span></a></div>
      <div className="poster-graphic" aria-hidden="true"><span className="poster-arrow">↗</span><div className="poster-stamp">IDEAS<br />IN MOTION</div></div>
      <div className="poster-marquee" aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}>THINK IT. SHAPE IT. BUILD IT. ↗ </span>)}</div></div>
    </section>
  );
}

export function StyleEmptyVisual({ style }: { style: VisualStyle }) {
  if (style === "original") return null;
  return <div className={`style-empty-visual ${style}-empty`} aria-hidden="true">
    {style === "atelier" && <><span className="sheet-back" /><span className="sheet-front"><i /><i /><i /><b>↗</b></span></>}
    {style === "blueprint" && <><span className="blueprint-frame"><i /><i /><i /></span><span className="blueprint-node" /></>}
    {style === "terminal" && <span className="terminal-await">&gt; awaiting_idea<span className="terminal-caret">▌</span></span>}
    {style === "brutalist" && <span className="poster-empty-word">GO!</span>}
  </div>;
}
