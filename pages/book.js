// pages/book.js
"use client";
import Head from "next/head";
import { useState } from "react";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  input, textarea, select {
    outline: none;
    font-family: 'Barlow', sans-serif;
  }
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.28); }
  select option { background: #0D1B2A; color: #fff; }
`;

const FIELD_STYLE = {
  width: "100%",
  padding: "0.85rem 1rem",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 2,
  color: WHITE,
  fontSize: "0.95rem",
  fontFamily: "'Barlow', sans-serif",
  transition: "border-color 0.18s, background 0.18s",
};

const LABEL_STYLE = {
  display: "block",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
  marginBottom: "0.45rem",
};

const WHAT_TO_EXPECT = [
  "30 minutes, no sales pressure",
  "Live walkthrough of the full platform",
  "NCAA compliance calendar setup",
  "Film room and nutrition queue demo",
  "Q&A with the team",
  "Free 30-day trial if it's a fit",
];

export default function BookPage() {
  const [form, setForm] = useState({
    name: "", email: "", organization: "", role: "", athletes: "", message: "",
    website: "", // honeypot — hidden from real users, bots fill it
  });
  const [status, setStatus]   = useState("idle"); // idle | submitting | success | error
  const [focused, setFocused] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const focusStyle = (field) => focused === field
    ? { ...FIELD_STYLE, borderColor: ACCENT, background: "rgba(79,171,255,0.04)" }
    : FIELD_STYLE;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.organization || !form.role) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/walkthrough-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <>
      <style>{STYLE}</style>
      <Head>
        <title>Book a Walkthrough | CheckPeak</title>
        <meta name="description" content="Schedule a 30-minute Google Meet walkthrough with the CheckPeak team. See the platform live and get your questions answered." />
      </Head>

      <main style={{ background: BLACK, color: WHITE, minHeight: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
          backgroundSize: "256px 256px", opacity: 0.04,
          mixBlendMode: "screen", pointerEvents: "none",
        }} />

        {/* Glow */}
        <div aria-hidden="true" style={{
          position: "fixed", right: "-10%", top: "20%",
          width: "60vw", height: "60vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,171,255,0.04) 0%, transparent 65%)",
          zIndex: 0, pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", zIndex: 1,
          maxWidth: 1100, margin: "0 auto",
          padding: "clamp(5rem, 10vw, 8rem) clamp(1.25rem, 6vw, 4rem)",
          display: "flex", gap: "clamp(3rem, 8vw, 7rem)",
          alignItems: "flex-start", flexWrap: "wrap",
        }}>

          {/* ── LEFT: Form ── */}
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>

            {/* Eyebrow */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(1rem, 2vw, 1.5rem)" }}>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>
                CheckPeak
              </span>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(3rem, 8vw, 6.5rem)",
              lineHeight: 0.88, letterSpacing: "-0.03em",
              textTransform: "uppercase", color: WHITE,
              marginBottom: "clamp(1rem, 2vw, 1.5rem)",
            }}>
              Let&apos;s<br />
              <span style={{ color: ACCENT }}>talk.</span>
            </h1>

            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)",
              lineHeight: 1.75, color: "rgba(255,255,255,0.62)",
              marginBottom: "clamp(2.5rem, 5vw, 3.5rem)",
              maxWidth: "44ch",
            }}>
              Tell us about your program. We&apos;ll send a Google Meet link within one business day.
            </p>

            {status === "success" ? (
              <div style={{
                padding: "2.5rem",
                background: "rgba(79,171,255,0.05)",
                border: `1px solid ${ACCENT}33`,
                borderTop: `3px solid ${ACCENT}`,
                borderRadius: 2,
              }}>
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900, fontStyle: "italic",
                  fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                  color: WHITE, lineHeight: 1.1,
                  marginBottom: "0.75rem",
                }}>
                  You&apos;re on the list.
                </p>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "1rem", lineHeight: 1.7, color: "rgba(255,255,255,0.65)" }}>
                  Check <strong style={{ color: WHITE }}>{form.email}</strong> — we&apos;ll send a Google Meet invite within one business day.
                </p>
                <p style={{ marginTop: "1.5rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.42)" }}>
                  Questions in the meantime?{" "}
                  <a href="mailto:support@checkpeak.com" style={{ color: ACCENT, textDecoration: "none" }}>support@checkpeak.com</a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Honeypot — invisible to real users, bots fill it and get silently rejected */}
                <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" type="text" name="website" tabIndex={-1} autoComplete="off"
                    value={form.website} onChange={set("website")} />
                </div>

                {/* Row 1: Name + Email */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={LABEL_STYLE}>Full name *</label>
                    <input
                      type="text" required value={form.name} onChange={set("name")}
                      placeholder="Coach Smith"
                      style={focusStyle("name")}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Email address *</label>
                    <input
                      type="email" required value={form.email} onChange={set("email")}
                      placeholder="you@university.edu"
                      style={focusStyle("email")}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                {/* Row 2: Organization + Role */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={LABEL_STYLE}>Program / Organization *</label>
                    <input
                      type="text" required value={form.organization} onChange={set("organization")}
                      placeholder="State University Athletics"
                      style={focusStyle("organization")}
                      onFocus={() => setFocused("organization")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Your role *</label>
                    <input
                      type="text" required value={form.role} onChange={set("role")}
                      placeholder="Head S&C Coach"
                      style={focusStyle("role")}
                      onFocus={() => setFocused("role")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                {/* Athletes dropdown */}
                <div>
                  <label style={LABEL_STYLE}>How many athletes in your program?</label>
                  <select
                    value={form.athletes} onChange={set("athletes")}
                    style={{ ...focusStyle("athletes"), appearance: "none", cursor: "pointer" }}
                    onFocus={() => setFocused("athletes")}
                    onBlur={() => setFocused(null)}
                  >
                    <option value="">Select a range</option>
                    <option value="1-25">1 – 25</option>
                    <option value="25-100">25 – 100</option>
                    <option value="100-300">100 – 300</option>
                    <option value="300+">300+</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label style={LABEL_STYLE}>Anything specific you want to cover? <span style={{ opacity: 0.45, fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>(optional)</span></label>
                  <textarea
                    value={form.message} onChange={set("message")}
                    placeholder="Compliance tracking, film room, nutrition queue..."
                    rows={4}
                    style={{ ...focusStyle("message"), resize: "vertical", lineHeight: 1.65 }}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused(null)}
                  />
                </div>

                {status === "error" && (
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "#D92B3A" }}>
                    Something went wrong. Email us directly at{" "}
                    <a href="mailto:support@checkpeak.com" style={{ color: "#D92B3A", fontWeight: 600 }}>support@checkpeak.com</a>.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.65rem",
                    padding: "1rem 2rem",
                    background: status === "submitting" ? "rgba(79,171,255,0.5)" : ACCENT,
                    color: BLACK,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.95rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    border: "none", borderRadius: 2,
                    cursor: status === "submitting" ? "not-allowed" : "pointer",
                    transition: "filter 0.2s",
                    alignSelf: "flex-start",
                  }}
                  onMouseEnter={e => { if (status !== "submitting") e.currentTarget.style.filter = "brightness(1.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                  {status === "submitting" ? "Sending…" : "Request Your Walkthrough"}
                  {status !== "submitting" && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>

                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.02em" }}>
                  We respond within one business day. No spam, ever.
                </p>
              </form>
            )}
          </div>

          {/* ── RIGHT: What to expect ── */}
          <div style={{
            flex: "0 0 clamp(240px, 28%, 300px)", minWidth: 0,
            paddingTop: "clamp(4rem, 8vw, 7rem)",
          }}>
            <div style={{
              padding: "clamp(1.5rem, 3vw, 2rem)",
              background: "#0B0F17",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderTop: `3px solid ${ACCENT}`,
              borderRadius: 2,
            }}>
              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontSize: "0.68rem",
                letterSpacing: "0.2em", textTransform: "uppercase",
                color: ACCENT, marginBottom: "1.25rem",
              }}>
                What to expect
              </p>

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {WHAT_TO_EXPECT.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", lineHeight: 1.55, color: "rgba(255,255,255,0.68)" }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "1.75rem", paddingTop: "1.5rem", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: "0.4rem" }}>
                  Meeting format
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.62)" }}>
                    Google Meet · 30 minutes
                  </span>
                </div>
              </div>
            </div>

            <p style={{ marginTop: "1.25rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>
              Already a coach or trainer?{" "}
              <a href="/commercial/onboard" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600, transition: "opacity 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                Start your Studio →
              </a>
            </p>
          </div>

        </div>
      </main>
    </>
  );
}
