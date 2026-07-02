// pages/api/recruit/og.js
// Edge function: generate dynamic OG image for recruiting profile share previews.
// Usage: /api/recruit/og?name=John+Smith&sport=Baseball&pos=SS&school=Lincoln+HS&year=2027

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default function handler(req) {
  const { searchParams } = new URL(req.url);

  const name   = (searchParams.get("name")   || "Athlete").slice(0, 40);
  const sport  = (searchParams.get("sport")  || "").slice(0, 30);
  const pos    = (searchParams.get("pos")    || "").slice(0, 20);
  const school = (searchParams.get("school") || "").slice(0, 50);
  const year   = (searchParams.get("year")   || "").slice(0, 6);

  const subtitle = [pos, school, year ? `Class of ${year}` : ""].filter(Boolean).join("  ·  ");

  // Shorten very long names to fit
  const displayName = name.length > 18
    ? name.split(" ").map((w, i) => (i === 0 ? w[0] + "." : w)).join(" ")
    : name;

  return new ImageResponse(
    <div
      style={{
        background: "#08090B",
        width:      "1200px",
        height:     "630px",
        display:    "flex",
        flexDirection: "column",
        padding:    "60px 70px",
        position:   "relative",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: "100%", background: "#4FABFF" }} />

      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.22em", color: "#4FABFF" }}>
          CHECKPEAK
        </span>
        {sport && (
          <div style={{
            padding:       "6px 18px",
            background:    "rgba(79,171,255,0.12)",
            border:        "1px solid rgba(79,171,255,0.3)",
            borderRadius:  6,
            fontSize:      11,
            fontWeight:    900,
            letterSpacing: "0.14em",
            color:         "#4FABFF",
          }}>
            {sport.toUpperCase()}
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize:      12,
        fontWeight:    800,
        letterSpacing: "0.2em",
        color:         "rgba(244,246,250,0.35)",
        marginBottom:  20,
      }}>
        RECRUITING PROFILE
      </div>

      {/* Athlete name */}
      <div style={{
        fontSize:      displayName.length > 14 ? 80 : 96,
        fontWeight:    900,
        color:         "#F4F6FA",
        letterSpacing: "-0.04em",
        lineHeight:    1.0,
        marginBottom:  20,
      }}>
        {displayName}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize:   22,
          fontWeight: 600,
          color:      "rgba(244,246,250,0.55)",
          lineHeight: 1.3,
        }}>
          {subtitle}
        </div>
      )}

      {/* Bottom */}
      <div style={{
        position:       "absolute",
        bottom:         44,
        left:           70,
        right:          70,
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
      }}>
        <span style={{ fontSize: 12, color: "rgba(244,246,250,0.25)", fontWeight: 600, letterSpacing: "0.04em" }}>
          checkpeak.com
        </span>
        <div style={{
          padding:       "10px 22px",
          background:    "#4FABFF",
          borderRadius:  6,
          fontSize:      12,
          fontWeight:    900,
          color:         "#08090B",
          letterSpacing: "0.1em",
        }}>
          VIEW PROFILE →
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
