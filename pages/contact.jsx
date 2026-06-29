// pages/contact.jsx
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
  input, textarea { outline: none; font-family: 'Barlow', sans-serif; }
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.28); }
`;

const FIELD = {
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

const LABEL = {
  display: "block",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
  marginBottom: "0.45rem",
};

const CONTACTS = [
  {
    label: "Programs & Universities",
    desc: "Walkthrough requests, onboarding, and org questions.",
    email: "programs@checkpeak.com",
    cta: { label: "Book a walkthrough instead", href: "/book" },
    accent: ACCENT,
  },
  {
    label: "Support",
    desc: "Account issues, bugs, and feature questions.",
    email: "support@checkpeak.com",
    cta: null,
    accent: "#3FB950",
  },
  {
    label: "Partnerships & Press",
    desc: "Arena trainer applications, media, and partnership inquiries.",
    email: "hello@checkpeak.com",
    cta: null,
    accent: "#A78BFA",
  },
];

export default function ContactPage() {
  const [form, setForm]       = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus]   = useState("idle");
  const [focused, setFocused] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const fieldStyle = (f) => focused === f
    ? { ...FIELD, borderColor: ACCENT, background: "rgba(79,171,255,0.04)" }
    : FIELD;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <style>{STYLE}</style>
      <Head>
        <title>Contact | CheckPeak</title>
        <meta name="description" content="Get in touch with the CheckPeak team. Support, program inquiries, partnerships, and press." />
      </Head>

      <main style={{ background: BLACK, color: WHITE, minHeight: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
          backgroundSize: "256px 256px", opacity: 0.04,
          mixBlendMode: "screen", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "clamp(5rem, 10vw, 8rem) clamp(1.25rem, 6vw, 4rem)" }}>

          {/* Header */}
          <div style={{ marginBottom: "clamp(3.5rem, 7vw, 6rem)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(0.75rem, 1.5vw, 1.25rem)" }}>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>Contact</span>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(3rem, 9vw, 7rem)",
              lineHeight: 0.88, letterSpacing: "-0.03em",
              textTransform: "uppercase", color: WHITE,
              marginBottom: "clamp(1rem, 2vw, 1.5rem)",
            }}>
              We read<br />
              <span style={{ color: ACCENT }}>everything.</span>
            </h1>

            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "clamp(1rem, 1.3vw, 1.1rem)",
              lineHeight: 1.75, color: "rgba(255,255,255,0.62)",
              maxWidth: "50ch",
            }}>
              We&apos;re a small team. Every message goes to a real person and gets a real reply — usually within one business day.
            </p>
          </div>

          {/* Contact cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "clamp(1rem, 2vw, 1.5rem)",
            marginBottom: "clamp(4rem, 8vw, 6rem)",
          }}>
            {CONTACTS.map((c) => (
              <div key={c.label} style={{
                padding: "clamp(1.5rem, 3vw, 2rem)",
                background: "#0B0F17",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderTop: `3px solid ${c.accent}`,
                borderRadius: 2,
                display: "flex", flexDirection: "column", gap: "0.6rem",
              }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", color: c.accent }}>
                  {c.label}
                </p>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.6, color: "rgba(255,255,255,0.58)" }}>
                  {c.desc}
                </p>
                <a href={`mailto:${c.email}`} style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: "0.9rem",
                  letterSpacing: "0.04em", color: WHITE,
                  textDecoration: "none", transition: "color 0.18s",
                  marginTop: "0.25rem",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = c.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.color = WHITE; }}
                >
                  {c.email}
                </a>
                {c.cta && (
                  <a href={c.cta.href} style={{
                    marginTop: "0.35rem",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, fontSize: "0.75rem",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: c.accent, textDecoration: "none",
                    transition: "opacity 0.18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {c.cta.label} →
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* ── Divider ── */}
          <div style={{ height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "clamp(3rem, 6vw, 5rem)" }} />

          {/* Message form */}
          <div style={{ maxWidth: 640 }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              lineHeight: 1, letterSpacing: "-0.02em",
              textTransform: "uppercase", color: WHITE,
              marginBottom: "clamp(1.5rem, 3vw, 2.5rem)",
            }}>
              Send us a message.
            </p>

            {status === "success" ? (
              <div style={{
                padding: "2rem",
                background: "rgba(63,185,80,0.05)",
                border: "1px solid rgba(63,185,80,0.2)",
                borderTop: "3px solid #3FB950",
                borderRadius: 2,
              }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.25rem", color: WHITE, marginBottom: "0.5rem" }}>
                  Got it. Talk soon.
                </p>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.58)" }}>
                  We&apos;ll reply to <strong style={{ color: WHITE }}>{form.email}</strong> within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={LABEL}>Name *</label>
                    <input
                      type="text" required value={form.name} onChange={set("name")}
                      placeholder="Your name"
                      style={fieldStyle("name")}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Email *</label>
                    <input
                      type="email" required value={form.email} onChange={set("email")}
                      placeholder="you@example.com"
                      style={fieldStyle("email")}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                <div>
                  <label style={LABEL}>Subject</label>
                  <input
                    type="text" value={form.subject} onChange={set("subject")}
                    placeholder="What's this about?"
                    style={fieldStyle("subject")}
                    onFocus={() => setFocused("subject")}
                    onBlur={() => setFocused(null)}
                  />
                </div>

                <div>
                  <label style={LABEL}>Message *</label>
                  <textarea
                    required value={form.message} onChange={set("message")}
                    placeholder="Tell us what you're working on..."
                    rows={5}
                    style={{ ...fieldStyle("message"), resize: "vertical", lineHeight: 1.65 }}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused(null)}
                  />
                </div>

                {status === "error" && (
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "#D92B3A" }}>
                    Something went wrong — email us directly at{" "}
                    <a href="mailto:support@checkpeak.com" style={{ color: "#D92B3A", fontWeight: 600 }}>support@checkpeak.com</a>.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.6rem",
                    padding: "0.9rem 2rem",
                    background: status === "submitting" ? "rgba(79,171,255,0.5)" : ACCENT,
                    color: BLACK,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.9rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    border: "none", borderRadius: 2,
                    cursor: status === "submitting" ? "not-allowed" : "pointer",
                    transition: "filter 0.2s",
                    alignSelf: "flex-start",
                  }}
                  onMouseEnter={e => { if (status !== "submitting") e.currentTarget.style.filter = "brightness(1.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                  {status === "submitting" ? "Sending…" : "Send Message"}
                  {status !== "submitting" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
