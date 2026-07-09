// pages/api/stats/og.js
// Edge function — broadcast-style OG image for individual game stat cards.
// Usage: /api/stats/og?name=Jake+M&sport=Football&pos=QB&school=Lake+HS
//        &result=W&opp=Riverside&score=24-17
//        &stat1=312&lbl1=PASS+YDS&stat2=3&lbl2=TD&stat3=68%25&lbl3=COMP+%25&stat4=0&lbl4=INT

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default function handler(req) {
  const p = new URL(req.url).searchParams;

  const name   = (p.get("name")   || "Athlete").slice(0, 40);
  const sport  = (p.get("sport")  || "").slice(0, 24);
  const pos    = (p.get("pos")    || "").slice(0, 18);
  const school = (p.get("school") || "").slice(0, 44);
  const result = (p.get("result") || "").slice(0, 3);
  const opp    = (p.get("opp")    || "").slice(0, 32);
  const score  = (p.get("score")  || "").slice(0, 10);

  const stats = [1, 2, 3, 4]
    .map(i => ({ val: p.get(`stat${i}`) || null, lbl: p.get(`lbl${i}`) || null }))
    .filter(s => s.val);

  const displayName = name.length > 18
    ? name.split(" ").map((w, i) => i === 0 ? w[0] + "." : w).join(" ")
    : name;

  const resultColor = result === "W" ? "#00C851" : result === "L" ? "#EF4444" : result ? "#FFD700" : "#4FABFF";
  const resultBg    = result === "W" ? "rgba(0,200,81,0.15)" : result === "L" ? "rgba(239,68,68,0.15)" : "rgba(255,215,0,0.12)";

  const sportLabel = sport ? sport.toUpperCase() : null;
  const posLabel   = pos   ? pos.toUpperCase()   : null;
  const topRight   = [sportLabel, posLabel].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    <div
      style={{
        background: "#08090B",
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: "100%", background: "#4FABFF", display: "flex" }} />

      {/* Subtle radial glow behind stats */}
      <div style={{ position: "absolute", bottom: -160, left: "50%", width: 700, height: 400, borderRadius: "50%", background: "rgba(79,171,255,0.035)", display: "flex", transform: "translateX(-50%)" }} />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "42px 70px 0 76px" }}>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.22em", color: "#4FABFF", display: "flex" }}>
          CHECKPEAK
        </span>
        {topRight && (
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "rgba(244,246,250,0.40)", display: "flex" }}>
            {topRight}
          </span>
        )}
      </div>

      {/* Athlete + result */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 70px 0 76px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: displayName.length > 14 ? 68 : 80, fontWeight: 900, color: "#F4F6FA", letterSpacing: "-0.04em", lineHeight: 1, display: "flex" }}>
            {displayName}
          </div>
          {school && (
            <div style={{ fontSize: 20, fontWeight: 600, color: "rgba(244,246,250,0.42)", marginTop: 12, display: "flex" }}>
              {school}
            </div>
          )}
        </div>

        {/* Result block */}
        {(result || opp || score) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, marginTop: 8 }}>
            {result && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 28px", background: resultBg, border: `2px solid ${resultColor}40`, borderRadius: 10 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: resultColor, display: "flex", letterSpacing: "-0.02em" }}>
                  {result}
                </span>
                {score && (
                  <span style={{ fontSize: 22, fontWeight: 700, color: "rgba(244,246,250,0.7)", display: "flex" }}>
                    {score}
                  </span>
                )}
              </div>
            )}
            {opp && (
              <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(244,246,250,0.38)", display: "flex" }}>
                vs {opp}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats grid */}
      {stats.length > 0 && (
        <div style={{
          display: "flex",
          position: "absolute",
          bottom: 90,
          left: 70,
          right: 70,
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "26px 0",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: i === 0 ? "rgba(79,171,255,0.07)" : "rgba(255,255,255,0.018)",
                borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <div style={{ fontSize: i === 0 ? 54 : 46, fontWeight: 900, color: i === 0 ? "#F4F6FA" : "rgba(244,246,250,0.78)", letterSpacing: "-0.04em", lineHeight: 1, display: "flex" }}>
                {s.val}
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", color: "rgba(244,246,250,0.32)", marginTop: 11, display: "flex" }}>
                {(s.lbl || "").toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: "absolute",
        bottom: 34,
        left: 76,
        right: 70,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: "rgba(244,246,250,0.18)", fontWeight: 600, letterSpacing: "0.07em", display: "flex" }}>
          checkpeak.com
        </span>
        <div style={{ padding: "8px 20px", background: "#4FABFF", borderRadius: 6, fontSize: 11, fontWeight: 900, color: "#08090B", letterSpacing: "0.1em", display: "flex" }}>
          VIEW PROFILE →
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
