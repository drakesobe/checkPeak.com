// components/CookieSettings.jsx
import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/consent";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";

export default function CookieSettings({ onChange }) {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = getConsent();
    setAnalytics(!!c.analytics);
  }, []);

  const save = () => {
    setConsent({ analytics });
    onChange?.({ analytics, decided: true });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontFamily:    "'Barlow Condensed', sans-serif",
          fontWeight:    700,
          fontSize:      "0.72rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         "rgba(255,255,255,0.38)",
          background:    "none",
          border:        "none",
          cursor:        "pointer",
          padding:       0,
          transition:    "color 0.18s",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.38)"; }}
      >
        Cookie settings
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position:             "fixed",
              inset:                0,
              zIndex:               200,
              display:              "flex",
              alignItems:           "center",
              justifyContent:       "center",
              background:           "rgba(6,8,16,0.75)",
              backdropFilter:       "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              padding:              "1rem",
            }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              style={{
                width:      "100%",
                maxWidth:   440,
                background: "#0B0F17",
                border:     "0.5px solid rgba(255,255,255,0.1)",
                padding:    "clamp(1.5rem, 4vw, 2rem)",
                position:   "relative",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent */}
              <div style={{
                position:   "absolute",
                top:        0,
                left:       0,
                right:      0,
                height:     "1.5px",
                background: `linear-gradient(to right, ${ACCENT}66, ${ACCENT}22, transparent)`,
              }} />

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <p style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontSize:      "0.68rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         ACCENT,
                    marginBottom:  "0.35rem",
                  }}>
                    Privacy
                  </p>
                  <h2 style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontStyle:     "italic",
                    fontSize:      "clamp(1.6rem, 5vw, 2rem)",
                    lineHeight:    0.9,
                    letterSpacing: "-0.02em",
                    textTransform: "uppercase",
                    color:         "#fff",
                    marginBottom:  "0.5rem",
                  }}>
                    Cookie settings
                  </h2>
                  <p style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize:   "0.82rem",
                    color:      "rgba(255,255,255,0.45)",
                    lineHeight: 1.55,
                    margin:     0,
                  }}>
                    Control optional analytics. Essential cookies are always on.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{
                    width:      36,
                    height:     36,
                    flexShrink: 0,
                    display:    "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.05)",
                    border:     "0.5px solid rgba(255,255,255,0.1)",
                    color:      "rgba(255,255,255,0.5)",
                    cursor:     "pointer",
                    fontSize:   "0.9rem",
                    transition: "background 0.18s, color 0.18s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Analytics toggle row */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border:     "0.5px solid rgba(255,255,255,0.08)",
                padding:    "1rem",
                marginBottom: "1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{
                      fontFamily:    "'Barlow Condensed', sans-serif",
                      fontWeight:    700,
                      fontSize:      "0.9rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color:         "#fff",
                      marginBottom:  "0.3rem",
                    }}>
                      Analytics
                    </p>
                    <p style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize:   "0.8rem",
                      color:      "rgba(255,255,255,0.42)",
                      lineHeight: 1.55,
                      margin:     0,
                      maxWidth:   "28ch",
                    }}>
                      Helps us understand usage and improve your experience. We do not sell your data.
                    </p>
                  </div>

                  {/* Toggle */}
                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={e => setAnalytics(e.target.checked)}
                      style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                    />
                    <span
                      onClick={() => setAnalytics(v => !v)}
                      style={{
                        display:        "inline-flex",
                        alignItems:     "center",
                        width:          44,
                        height:         24,
                        borderRadius:   12,
                        padding:        "2px",
                        background:     analytics ? ACCENT : "rgba(255,255,255,0.12)",
                        border:         analytics ? "none" : "0.5px solid rgba(255,255,255,0.15)",
                        transition:     "background 0.2s",
                        cursor:         "pointer",
                        position:       "relative",
                      }}
                    >
                      <span style={{
                        width:      20,
                        height:     20,
                        borderRadius: "50%",
                        background: analytics ? BLACK : "rgba(255,255,255,0.6)",
                        transform:  analytics ? "translateX(20px)" : "translateX(0)",
                        transition: "transform 0.2s, background 0.2s",
                        flexShrink: 0,
                      }} />
                    </span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={save}
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
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                  Save preferences
                </button>
              </div>

              <p style={{
                fontFamily:   "'Barlow', sans-serif",
                fontSize:     "0.72rem",
                color:        "rgba(255,255,255,0.22)",
                marginTop:    "1rem",
                margin:       "1rem 0 0",
              }}>
                You can update this anytime from the footer.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
