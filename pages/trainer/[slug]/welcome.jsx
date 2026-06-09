// pages/trainer/[slug]/welcome.jsx
// The moment after subscribing. The most important screen in the product.
// "You made the right call." Give them their first video immediately.
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";

const D = {
  bg:        "#070808",
  bgSection: "#0D1117",
  bgCard:    "#0F1318",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.13)",
  text:      "#F0F6FC",
  dim:       "rgba(255,255,255,0.52)",
  faint:     "rgba(255,255,255,0.26)",
  whisper:   "rgba(255,255,255,0.1)",
  red:       "#DA3633",
};

const TIER_COLOR = {
  Basic:   "#3FB950",
  Premium: "#F0883E",
  Ultra:   "#79B8FF",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes lineSlide {
    from { transform: scaleX(0); transform-origin: left; }
    to   { transform: scaleX(1); transform-origin: left; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(218,54,51,0.3); }
    50%     { box-shadow: 0 0 0 12px rgba(218,54,51,0); }
  }

  .vid-card {
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    text-decoration: none;
    display: block;
  }
  .vid-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255,255,255,0.16) !important;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6);
  }
  .vid-card .play-icon { opacity: 0; transition: opacity 0.16s; }
  .vid-card:hover .play-icon { opacity: 1; }

  .start-btn {
    transition: opacity 0.14s, transform 0.1s;
    animation: pulseGlow 2.5s ease-in-out 1.5s infinite;
  }
  .start-btn:hover { opacity: 0.84; }
  .start-btn:active { transform: scale(0.98); }

  @media (max-width: 640px) {
    .welcome-section { padding: 48px 24px !important; }
    .vid-grid { grid-template-columns: 1fr !important; }
    .welcome-name { font-size: clamp(3rem, 14vw, 5rem) !important; }
  }
`;

function muxThumb(id) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=480&height=270&fit_mode=smartcrop`;
}

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VideoPreviewCard({ video, slug, delay = 0 }) {
  const f     = video?.fields ?? {};
  const thumb = f.muxPlaybackId ? muxThumb(f.muxPlaybackId) : null;

  return (
    <a
      href={`/trainer/${slug}/library`}
      className="vid-card"
      style={{
        background:   "rgba(15,19,24,1)",
        border:       `0.5px solid ${D.border}`,
        borderRadius: 3,
        overflow:     "hidden",
        animation:    `fadeUp 0.5s ease ${delay}s both`,
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#0A0C10" }}>
        {thumb
          ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.08)" />
              </svg>
            </div>
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)" }} />

        {/* Hover play */}
        <div className="play-icon" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>
        </div>

        {fmtDuration(f.duration) && (
          <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.65)", padding: "2px 6px" }}>
            {fmtDuration(f.duration)}
          </span>
        )}
      </div>

      <div style={{ padding: "10px 14px 13px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {f.title || "Untitled"}
        </p>
      </div>
    </a>
  );
}

export default function WelcomePage() {
  const router   = useRouter();
  const { slug } = router.query;
  const { user, authReady } = useAuthContext();
  const tier     = router.query.tier || "";

  const [trainer, setTrainer]   = useState(null);
  const [videos,  setVideos]    = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push(`/login?next=/trainer/${slug}/welcome`); return; }
    if (!slug) return;

    // Verify subscription + get videos
    Promise.all([
      fetch(`/api/commercial/trainer-public?slug=${slug}`).then(r => r.json()),
      fetch(`/api/commercial/client-access?slug=${slug}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([trainerData, accessData]) => {
      if (!trainerData?.trainer) { router.push("/"); return; }
      // If no subscription, redirect to profile
      if (!accessData?.tier) { router.push(`/trainer/${slug}`); return; }

      setTrainer(trainerData.trainer);
      setVideos(accessData.videos ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, authReady, slug, router]);

  if (!authReady || loading) {
    return (
      <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: D.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trainer) return null;

  const f          = trainer.fields ?? {};
  const tierColor  = TIER_COLOR[tier] ?? D.red;
  const firstName  = f.name?.trim().split(/\s+/)[0] ?? "Your Coach";
  const firstThree = videos.slice(0, 3);

  return (
    <>
      <Head>
        <title>Welcome - {f.name} · CheckPeak</title>
      </Head>
      <style>{GLOBAL_CSS}</style>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>

        {/* ── WELCOME HERO ── */}
        <section
          className="welcome-section"
          style={{
            minHeight: "100vh",
            display:   "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding:   "80px 56px 64px",
            background: `
              radial-gradient(ellipse 80% 60% at 50% -5%, ${tierColor}0e 0%, transparent 55%),
              repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
              repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
              ${D.bg}
            `,
            position: "relative",
          }}>
          <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>

            {/* CheckPeak nav */}
            <div style={{ position: "absolute", top: 32, left: 56, animation: "fadeIn 0.5s ease 0.1s both" }}>
              <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }}>
                CheckPeak
              </a>
            </div>

            {/* Tier badge */}
            <div style={{ marginBottom: 28, animation: "fadeUp 0.5s ease 0.15s both" }}>
              <span style={{
                fontSize:      9,
                fontWeight:    900,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         tierColor,
                background:    `${tierColor}14`,
                border:        `0.5px solid ${tierColor}40`,
                padding:       "5px 14px",
              }}>
                {tier || "Member"} Access Granted
              </span>
            </div>

            {/* Main headline */}
            <div style={{ animation: "fadeUp 0.6s ease 0.22s both", marginBottom: 16 }}>
              <div style={{
                fontFamily:    "'Barlow Condensed', sans-serif",
                fontWeight:    900,
                fontStyle:     "italic",
                fontSize:      "clamp(2.5rem, 8vw, 6rem)",
                lineHeight:    0.86,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                color:         D.red,
              }}>
                You're In.
              </div>
            </div>

            {/* Sub-headline */}
            <div style={{ animation: "fadeUp 0.6s ease 0.30s both", marginBottom: 32 }}>
              <p style={{
                fontFamily:    "'Barlow Condensed', sans-serif",
                fontWeight:    900,
                fontStyle:     "italic",
                fontSize:      "clamp(1.8rem, 4.5vw, 3.5rem)",
                lineHeight:    0.9,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color:         D.text,
              }}>
                {firstName}'s full program.<br />
                <span style={{ color: D.faint }}>Ready when you are.</span>
              </p>
            </div>

            {/* Animated line */}
            <div style={{ width: "100%", maxWidth: 480, height: "0.5px", background: D.border, marginBottom: 32, animation: "lineSlide 0.8s ease 0.5s both" }} />

            {/* Context */}
            <p style={{ fontSize: 14, color: D.dim, lineHeight: 1.7, maxWidth: 440, marginBottom: 48, animation: "fadeUp 0.5s ease 0.55s both" }}>
              {videos.length > 0
                ? `${videos.length} video${videos.length !== 1 ? "s" : ""} in your library. Organized, indexed, and ready to train with from anywhere.`
                : `${f.name} is building out the library. Check back soon.`
              }
            </p>

            {/* CTA */}
            <div style={{ animation: "fadeUp 0.5s ease 0.62s both" }}>
              <a
                href={`/trainer/${slug}/library`}
                className="start-btn"
                style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           12,
                  padding:       "16px 44px",
                  background:    D.red,
                  color:         "#fff",
                  textDecoration:"none",
                  fontSize:      12,
                  fontWeight:    800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontFamily:    "inherit",
                  borderRadius:  2,
                }}
              >
                Open My Library
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* ── VIDEO PREVIEW ── */}
        {firstThree.length > 0 && (
          <section
            className="welcome-section"
            style={{ padding: "80px 56px", background: D.bgSection, borderTop: `0.5px solid ${D.border}` }}
          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>

              <div style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 24, height: 2, background: D.red }} />
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                    Start here
                  </span>
                </div>
                <h2 style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(1.8rem, 4vw, 3rem)",
                  lineHeight:    0.9,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color:         D.text,
                  marginBottom:  10,
                }}>
                  First session, three options.<br />
                  <span style={{ color: D.faint }}>Pick one. Go.</span>
                </h2>
                <p style={{ fontSize: 13, color: D.faint }}>
                  Your full library has {videos.length} video{videos.length !== 1 ? "s" : ""}. These are a good place to start.
                </p>
              </div>

              <div
                className="vid-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}
              >
                {firstThree.map((v, i) => (
                  <VideoPreviewCard key={v.id} video={v} slug={slug} delay={0.1 + i * 0.08} />
                ))}
              </div>

              <div style={{ marginTop: 28, textAlign: "center" }}>
                <a
                  href={`/trainer/${slug}/library`}
                  style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }}
                >
                  View all {videos.length} videos →
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "24px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>
            CheckPeak
          </a>
          <a href="/athlete/libraries" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textDecoration: "none", letterSpacing: "0.04em" }}>
            My Libraries →
          </a>
        </footer>
      </div>
    </>
  );
}