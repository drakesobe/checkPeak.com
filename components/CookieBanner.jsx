import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/consent";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";

function requestAndStoreGeolocation() {
  if (typeof window === "undefined") return;
  if (!navigator?.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      try {
        localStorage.setItem(
          "cp_geo",
          JSON.stringify({
            lat: parseFloat(pos.coords.latitude.toFixed(4)),
            lng: parseFloat(pos.coords.longitude.toFixed(4)),
            accuracy: Math.round(pos.coords.accuracy),
          })
        );
      } catch {}
    },
    () => {
      try { localStorage.setItem("cp_geo", JSON.stringify({ denied: true })); } catch {}
    },
    { timeout: 8000, maximumAge: 3_600_000 }
  );
}

export default function CookieBanner({ onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = getConsent();
    if (!c.decided) {
      const t = setTimeout(() => setOpen(true), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    setConsent({ analytics: true });
    onChange?.({ analytics: true, decided: true });
    requestAndStoreGeolocation();
    setOpen(false);
  };

  const decline = () => {
    setConsent({ analytics: false });
    onChange?.({ analytics: false, decided: true });
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position:             "fixed",
            bottom:               0,
            left:                 0,
            right:                0,
            zIndex:               100,
            background:           "rgba(6,8,16,0.96)",
            backdropFilter:       "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop:            "0.5px solid rgba(255,255,255,0.09)",
            padding:              "1.1rem clamp(1.25rem, 6vw, 3rem)",
          }}
        >
          {/* Thin accent line at top */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "1.5px",
            background: `linear-gradient(to right, transparent, ${ACCENT}44, transparent)`,
            pointerEvents: "none",
          }} />

          <div style={{
            maxWidth:       960,
            margin:         "0 auto",
            display:        "flex",
            flexWrap:       "wrap",
            gap:            "clamp(0.75rem, 2vw, 1.5rem)",
            alignItems:     "center",
            justifyContent: "space-between",
          }}>
            {/* Copy */}
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <p style={{
                fontFamily:    "'Barlow Condensed', sans-serif",
                fontWeight:    900,
                fontSize:      "0.68rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         ACCENT,
                marginBottom:  "0.3rem",
              }}>
                Analytics
              </p>
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize:   "0.85rem",
                color:      "rgba(255,255,255,0.55)",
                lineHeight: 1.55,
                margin:     0,
              }}>
                We use analytics to understand how CheckPeak is used and make it better.{" "}
                <span style={{ color: "rgba(255,255,255,0.32)" }}>No data is sold.</span>
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexShrink: 0 }}>
              <button
                type="button"
                onClick={decline}
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    700,
                  fontSize:      "0.75rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color:         "rgba(255,255,255,0.38)",
                  background:    "none",
                  border:        "0.5px solid rgba(255,255,255,0.12)",
                  padding:       "0.6rem 1rem",
                  cursor:        "pointer",
                  transition:    "color 0.18s, border-color 0.18s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.38)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                Decline
              </button>

              <button
                type="button"
                onClick={accept}
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontSize:      "0.78rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color:         BLACK,
                  background:    ACCENT,
                  border:        "none",
                  padding:       "0.65rem 1.4rem",
                  cursor:        "pointer",
                  transition:    "filter 0.18s",
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           "0.45rem",
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
              >
                Allow analytics
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
