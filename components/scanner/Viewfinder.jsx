// components/scanner/Viewfinder.jsx
// Empty-state capture target: a dark camera frame previewing what to aim at.
"use client";

import { useState } from "react";
import { DS } from "@/components/scanResultsTokens";

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };
const INK = "#0D1B2A";

// Faint sketch of a Supplement Facts panel
function LabelSketch() {
  const rows = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 220 250" aria-hidden="true" style={{ height: "74%", width: "auto", opacity: 0.3 }}>
      <rect x="4" y="4" width="212" height="242" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="18" y="20" width="118" height="16" fill="#fff" />
      <rect x="18" y="44" width="150" height="6" fill="#fff" opacity="0.7" />
      <rect x="14" y="60" width="192" height="7" fill="#fff" />
      {rows.map((i) => (
        <g key={i} transform={`translate(0 ${80 + i * 24})`}>
          <rect x="18" y="0" width={[92, 70, 104, 80][i]} height="7" fill="#fff" opacity="0.75" />
          <rect x={202 - [36, 44, 30, 40][i]} y="0" width={[36, 44, 30, 40][i]} height="7" fill="#fff" opacity="0.75" />
          <rect x="14" y="15" width="192" height="1.5" fill="#fff" opacity="0.5" />
        </g>
      ))}
      <rect x="14" y="178" width="192" height="7" fill="#fff" />
      <rect x="18" y="196" width="176" height="5" fill="#fff" opacity="0.55" />
      <rect x="18" y="208" width="150" height="5" fill="#fff" opacity="0.55" />
      <rect x="18" y="220" width="164" height="5" fill="#fff" opacity="0.55" />
    </svg>
  );
}

// Faint barcode
function BarcodeSketch() {
  const widths = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 1, 3];
  let x = 10;
  const bars = widths.map((w, i) => {
    const bar = i % 2 === 0 ? <rect key={i} x={x} y="10" width={w * 2.6} height={i === 0 || i === widths.length - 1 ? 104 : 94} fill="#fff" /> : null;
    x += w * 2.6 + 1.6;
    return bar;
  });
  return (
    <svg viewBox={`0 0 ${x + 10} 116`} aria-hidden="true" style={{ width: "62%", maxWidth: 320, height: "auto", opacity: 0.32 }}>
      {bars}
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export default function Viewfinder({ variant = "label", onActivate, onFiles, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const isLabel = variant === "label";

  const dropHandlers = onFiles ? {
    onDragOver:  (e) => { e.preventDefault(); if (!disabled) setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop:      (e) => { e.preventDefault(); setDragging(false); if (!disabled) onFiles(e.dataTransfer.files); },
  } : {};

  return (
    <button
      type="button"
      className={`vf${dragging ? " vf-drag" : ""}`}
      onClick={onActivate}
      disabled={disabled}
      aria-label={isLabel ? "Photograph or upload the label" : "Start the camera to scan a barcode"}
      {...dropHandlers}
    >
      <span className="vf-art">{isLabel ? <LabelSketch /> : <BarcodeSketch />}</span>
      {!isLabel && <span className="vf-line" aria-hidden="true" />}
      <span className="vf-corner vf-tl" aria-hidden="true" />
      <span className="vf-corner vf-tr" aria-hidden="true" />
      <span className="vf-corner vf-bl" aria-hidden="true" />
      <span className="vf-corner vf-br" aria-hidden="true" />

      <span className="vf-cta">
        <span className="vf-icon"><CameraIcon /></span>
        <span className="vf-title">
          {isLabel ? (
            <>
              <span className="vf-touch">Tap to photograph the label</span>
              <span className="vf-mouse">{dragging ? "Drop your photos" : "Click to upload label photos"}</span>
            </>
          ) : "Start camera"}
        </span>
        <span className="vf-sub">
          {isLabel ? (
            <>
              <span className="vf-touch">Get the Supplement Facts and ingredient list in frame</span>
              <span className="vf-mouse">or drag them here · up to 4 photos</span>
            </>
          ) : "Point at the barcode and it reads automatically"}
        </span>
      </span>

      <style>{`
        .vf {
          position: relative; display: grid; place-items: center; width: 100%;
          aspect-ratio: 4 / 3; max-height: 56vh; min-height: 240px;
          padding: 0; border: none; cursor: pointer; overflow: hidden;
          background: radial-gradient(120% 90% at 50% 40%, #16293F 0%, ${INK} 70%);
          color: #fff; font: inherit; text-align: center;
          transition: filter 0.15s;
        }
        @media (min-width: 720px) { .vf { aspect-ratio: 16 / 9; max-height: 400px; } }
        .vf:disabled { cursor: not-allowed; filter: grayscale(0.6) brightness(0.8); }
        .vf:focus-visible { outline: 3px solid ${DS.brand}; outline-offset: 3px; }
        .vf-art { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .vf-corner { position: absolute; width: 34px; height: 34px; border-color: ${DS.brand}; border-style: solid; border-width: 0; transition: transform 0.2s ease; }
        .vf-tl { top: 18px; left: 18px; border-top-width: 3px; border-left-width: 3px; }
        .vf-tr { top: 18px; right: 18px; border-top-width: 3px; border-right-width: 3px; }
        .vf-bl { bottom: 18px; left: 18px; border-bottom-width: 3px; border-left-width: 3px; }
        .vf-br { bottom: 18px; right: 18px; border-bottom-width: 3px; border-right-width: 3px; }
        .vf:hover:not(:disabled) .vf-tl, .vf-drag .vf-tl { transform: translate(6px, 6px); }
        .vf:hover:not(:disabled) .vf-tr, .vf-drag .vf-tr { transform: translate(-6px, 6px); }
        .vf:hover:not(:disabled) .vf-bl, .vf-drag .vf-bl { transform: translate(6px, -6px); }
        .vf:hover:not(:disabled) .vf-br, .vf-drag .vf-br { transform: translate(-6px, -6px); }
        .vf-drag { filter: brightness(1.15); }
        .vf-line { position: absolute; left: 14%; right: 14%; top: 50%; height: 2px; background: ${DS.brand}; box-shadow: 0 0 12px ${DS.brand}; animation: vf-sweep 2.2s ease-in-out infinite; pointer-events: none; }
        @keyframes vf-sweep { 0%, 100% { transform: translateY(-46px); } 50% { transform: translateY(46px); } }
        .vf-cta { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 34px 48px; max-width: 100%; background: radial-gradient(closest-side, rgba(13,27,42,0.94) 55%, rgba(13,27,42,0)); text-shadow: 0 1px 8px rgba(13,27,42,0.9); }
        .vf-icon { width: 56px; height: 56px; display: grid; place-items: center; border-radius: 50%; background: ${DS.brand}; color: #fff; box-shadow: 0 0 0 8px rgba(79,171,255,0.18); }
        .vf-title { font-family: ${F.cond}; font-weight: 900; font-size: clamp(1.15rem, 4.6vw, 1.45rem); letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.05; text-wrap: balance; }
        .vf-sub { font-family: ${F.body}; font-size: 14px; line-height: 1.4; color: rgba(255,255,255,0.72); }
        .vf-mouse { display: none; }
        @media (hover: hover) and (pointer: fine) { .vf-touch { display: none; } .vf-mouse { display: inline; } }
        @media (prefers-reduced-motion: reduce) { .vf-line { animation: none; } .vf-corner { transition: none; } }
      `}</style>
    </button>
  );
}
