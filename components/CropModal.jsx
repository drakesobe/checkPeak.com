// components/CropModal.jsx
"use client";

import { useState } from "react";
import Cropper from "react-easy-crop";

/**
 * CropModal v3 — Immersive, native-feel crop UI
 *
 * Design philosophy:
 *   The image IS the UI. Everything else is chrome that gets out of the way.
 *
 *   - Cropper fills the entire screen edge-to-edge
 *   - A frosted glass strip floats at the bottom with just what's needed
 *   - Zoom slider is integrated into the glass strip, large thumb, easy to hit
 *   - Aspect toggle is a subtle pill button in the top-right (most users never touch it)
 *   - Confirm is a full-width pill at the very bottom — thumb-reachable from anywhere
 *   - Step dots show progress in multi-file mode (minimal, non-intrusive)
 *   - Close is a small circle in the top-left — easy to reach, hard to accidentally hit
 *   - No blocky panels, no cards, no borders
 */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap');

  /* Zoom slider — large thumb, invisible tall hit area */
  .cm-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    border-radius: 99px;
    background: rgba(255,255,255,0.25);
    outline: none;
    cursor: pointer;
    padding: 16px 0;
    box-sizing: content-box;
    margin: -16px 0;
  }
  .cm-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.45);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .cm-slider:active::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 4px 16px rgba(0,0,0,0.55);
  }
  .cm-slider::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 2px 12px rgba(0,0,0,0.45);
  }

  /* Frosted glass panel */
  .cm-glass {
    background: rgba(10, 12, 18, 0.72);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid rgba(255,255,255,0.08);
  }

  /* Confirm button press animation */
  .cm-confirm:active {
    transform: scale(0.97);
  }

  /* Fade-in for the whole modal */
  @keyframes cm-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .cm-enter {
    animation: cm-fade-up 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
`;

// Step dots for multi-file mode
function StepDots({ total, current }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width:  i === current ? 16 : 6,
            height: 6,
            borderRadius: 99,
            backgroundColor: i === current
              ? "rgba(255,255,255,0.9)"
              : i < current
              ? "rgba(255,255,255,0.35)"
              : "rgba(255,255,255,0.15)",
            transition: "width 0.2s, background-color 0.2s",
          }}
        />
      ))}
    </div>
  );
}

export default function CropModal({
  isOpen,
  previewURL,
  cropIndex,
  totalFiles,
  multiple,
  crop,
  zoom,
  aspectMode,
  aspectValue,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onAspectChange,
  onConfirm,
  onClose,
}) {
  const [aspectOpen, setAspectOpen] = useState(false);

  if (!isOpen || !previewURL) return null;

  const isLastFile = !multiple || cropIndex + 1 >= totalFiles;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── Backdrop + centered card ────────────────────────────── */}
      {/*
        Mobile:  full screen (max sizes exceed viewport = fills it)
        Desktop: centered card, max 480px wide, 820px tall, rounded corners
        The dark backdrop shows around the card on large screens.
      */}
      <div
        className="fixed inset-0 z-[60] cm-enter flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      >
        <div
          className="relative w-full h-full sm:rounded-3xl sm:overflow-hidden"
          style={{
            maxWidth:  "min(480px, 100vw)",
            maxHeight: "min(820px, 100dvh)",
            backgroundColor: "#060810",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          }}
        >

        {/* ── Cropper — fills the inner container ─────────────────── */}
        <div className="absolute inset-0">
          <Cropper
            image={previewURL}
            crop={crop}
            zoom={zoom}
            aspect={aspectValue}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
            showGrid={true}
            style={{
              containerStyle: {
                background: "#060810",
              },
              cropAreaStyle: {
                border: "2px solid rgba(255,255,255,0.75)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              },
            }}
          />
        </div>

        {/* ── Top bar — minimal, floating over image ──────────────── */}
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-4 pt-4"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
            paddingTop: "max(16px, env(safe-area-inset-top, 16px))",
          }}
        >
          {/* Close — small circle, easy to find, hard to mis-tap */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center rounded-full transition"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.85)",
              fontSize: 18,
              lineHeight: 1,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            ×
          </button>

          {/* Right side: step dots + aspect toggle */}
          <div className="flex flex-col items-end gap-2">

            {/* Step dots */}
            <StepDots total={totalFiles} current={cropIndex} />

            {/* Aspect toggle — subtle pill, top right */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAspectOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
                style={{
                  backgroundColor: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  fontFamily: "'Barlow', sans-serif",
                  letterSpacing: "0.03em",
                }}
              >
                <span style={{ fontSize: 12 }}>⊞</span>
                {aspectMode === "label" ? "Label" : "Free"}
              </button>

              {/* Aspect dropdown */}
              {aspectOpen && (
                <div
                  className="absolute top-full right-0 mt-2 rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: "rgba(15,18,26,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    minWidth: 140,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  {[
                    { key: "label", label: "Label Text",  hint: "Tall — best for panels" },
                    { key: "free",  label: "Free Crop",   hint: "Any shape"              },
                  ].map(({ key, label, hint }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { onAspectChange(key); setAspectOpen(false); }}
                      className="w-full flex flex-col items-start px-4 py-3 transition text-left"
                      style={{
                        backgroundColor: aspectMode === key
                          ? "rgba(91,158,201,0.18)"
                          : "transparent",
                        borderBottom: key === "label" ? "1px solid rgba(255,255,255,0.07)" : "none",
                      }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: aspectMode === key ? "#5B9EC9" : "rgba(255,255,255,0.85)",
                          fontFamily: "'Barlow', sans-serif",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-[10px] mt-0.5"
                        style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow', sans-serif" }}
                      >
                        {hint}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Floating hint — center top, fades away ──────────────── */}
        <div
          className="absolute left-0 right-0 z-10 flex justify-center pointer-events-none"
          style={{ top: "max(64px, calc(env(safe-area-inset-top, 16px) + 52px))" }}
        >
          <div
            className="px-3 py-1.5 rounded-full text-[11px]"
            style={{
              backgroundColor: "rgba(0,0,0,0.35)",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "'Barlow', sans-serif",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              letterSpacing: "0.03em",
            }}
          >
            Drag to reposition · Pinch or slide to zoom
          </div>
        </div>

        {/* ── Bottom glass strip — floats over the image ──────────── */}
        <div
          className="cm-glass absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-4 px-5 pt-5"
          style={{
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
          }}
        >

          {/* Zoom row */}
          <div className="flex items-center gap-4">
            {/* Zoom out icon */}
            <span
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.4)",
                userSelect: "none",
                lineHeight: 1,
              }}
            >
              ⊖
            </span>

            {/* Slider */}
            <div className="flex-1" style={{ padding: "8px 0" }}>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="cm-slider"
                aria-label="Zoom"
              />
            </div>

            {/* Zoom in icon */}
            <span
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.4)",
                userSelect: "none",
                lineHeight: 1,
              }}
            >
              ⊕
            </span>

            {/* Numeric readout */}
            <span
              className="text-xs font-semibold tabular-nums shrink-0"
              style={{
                color: "rgba(255,255,255,0.45)",
                fontFamily: "'Barlow', sans-serif",
                minWidth: 30,
                textAlign: "right",
              }}
            >
              {zoom.toFixed(1)}×
            </span>
          </div>

          {/* Confirm button */}
          <button
            type="button"
            onClick={onConfirm}
            className="cm-confirm w-full flex items-center justify-center rounded-2xl font-bold"
            style={{
              height: 56,
              fontSize: 16,
              letterSpacing: "0.06em",
              fontFamily: "'Barlow Condensed', sans-serif",
              background: "linear-gradient(135deg, #254d80 0%, #1E3A5F 100%)",
              color: "#fff",
              border: "1px solid rgba(91,158,201,0.35)",
              boxShadow: "0 4px 20px rgba(30,58,95,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = "scale(0.97)";
              e.currentTarget.style.boxShadow = "0 2px 10px rgba(30,58,95,0.4)";
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(30,58,95,0.5), inset 0 1px 0 rgba(255,255,255,0.1)";
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #2d5a94 0%, #254d80 100%)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #254d80 0%, #1E3A5F 100%)";
            }}
          >
            {isLastFile
              ? "Use This Crop"
              : `Use Crop  ·  Next Label ${cropIndex + 2} of ${totalFiles}`}
          </button>
        </div>

        </div>{/* end centered card */}
      </div>
    </>
  );
}