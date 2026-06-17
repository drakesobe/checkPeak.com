// pages/trainers.jsx
// The Arena - compact directory layout. Sticky search + filters.
// Scales from 1 to 500+ coaches without wasted space.
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

const D = {
  bg:        "#070808",
  bgSection: "#0D1117",
  bgCard:    "#0F1318",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.13)",
  text:      "#F0F6FC",
  dim:       "rgba(255,255,255,0.52)",
  faint:     "rgba(255,255,255,0.26)",
  whisper:   "rgba(255,255,255,0.08)",
  red:       "#DA3633",
};

const TIER_COLORS = {
  Basic:   { color: "#3FB950", bg: "rgba(63,185,80,0.1)"   },
  Premium: { color: "#F0883E", bg: "rgba(240,136,62,0.1)"  },
  Ultra:   { color: "#79B8FF", bg: "rgba(121,184,255,0.1)" },
};

const SPECIALTIES = {
  "Strength & Conditioning Coach": { icon: "⚡", short: "S&C"       },
  "Personal Trainer":              { icon: "🏋️", short: "Personal"   },
  "Physical Therapist":            { icon: "🩺", short: "PT / Rehab" },
  "Massage Therapist":             { icon: "💆", short: "Recovery"    },
  "Sports Nutritionist":           { icon: "🥗", short: "Nutrition"   },
  "Online Coach":                  { icon: "💻", short: "Online"      },
};

const GOAL_PRESETS = {
  strength:  ["Strength & Conditioning Coach", "Personal Trainer"],
  recovery:  ["Physical Therapist", "Massage Therapist"],
  nutrition: ["Sports Nutritionist"],
  online:    ["Online Coach"],
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse  { 0%,100%{opacity:0.5} 50%{opacity:0.25} }

  .ac { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
  .ac:hover { transform: translateY(-3px); box-shadow: 0 20px 52px rgba(0,0,0,0.65); border-color: rgba(255,255,255,0.14) !important; }
  .ac .cta { opacity: 0; transition: opacity 0.15s; }
  .ac:hover .cta { opacity: 1; }
  .ac .rbar { transform: scaleX(0); transform-origin: left; transition: transform 0.18s ease; }
  .ac:hover .rbar { transform: scaleX(1); }

  .fp { transition: background 0.12s, border-color 0.12s, color 0.12s; cursor: pointer; }
  .fp:hover { border-color: rgba(255,255,255,0.2) !important; }

  .si { transition: border-color 0.14s, box-shadow 0.14s; }
  .si::placeholder { color: rgba(255,255,255,0.25); }
  .si:focus { outline: none; border-color: rgba(218,54,51,0.45) !important; box-shadow: 0 0 0 3px rgba(218,54,51,0.08); }

  @media (max-width: 768px) {
    .ag { grid-template-columns: repeat(2, 1fr) !important; }
    .ag .bio-clamp { -webkit-line-clamp: 2 !important; }
  }
  @media (max-width: 1024px) {
    .ag { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important; }
  }
`;

function splitName(name = "") {
  const p = name.trim().split(/\s+/);
  return p.length <= 2 ? p : [p[0], p.slice(1).join(" ")];
}

function tierAvailable(f, tier) {
  const p = f[`${tier.toLowerCase()}Price`];
  return p !== null && p !== undefined && p !== "";
}

function lowestTier(f) {
  for (const tier of ["Basic", "Premium", "Ultra"]) {
    if (tierAvailable(f, tier)) {
      const p = Number(f[`${tier.toLowerCase()}Price`]);
      return { tier, price: p, isFree: p === 0 };
    }
  }
  return null;
}

// ─── Trainer card ─────────────────────────────────────────────────────────────
function TrainerCard({ trainer, idx }) {
  const f      = trainer.fields ?? {};
  const parts  = splitName(f.name ?? "");
  const spec   = SPECIALTIES[f.specialty] ?? { icon: "💪", short: f.specialty ?? "" };
  const lowest = lowestTier(f);
  const tiers  = ["Basic", "Premium", "Ultra"].filter(t => tierAvailable(f, t));
  const initials = (f.name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const bannerBg = f.photoUrl
    ? `url(${f.photoUrl})`
    : `radial-gradient(ellipse 120% 100% at 60% 50%, rgba(218,54,51,0.18) 0%, transparent 70%),
       repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.007) 23px, rgba(255,255,255,0.007) 24px),
       repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(255,255,255,0.007) 23px, rgba(255,255,255,0.007) 24px),
       ${D.bgSection}`;

  return (
    <Link href={`/trainer/${f.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div className="ac" style={{
        background:    D.bgCard,
        border:        `0.5px solid ${D.border}`,
        borderRadius:  3,
        overflow:      "hidden",
        display:       "flex",
        flexDirection: "column",
        height:        "100%",
        position:      "relative",
        animation:     `fadeUp 0.38s ease ${Math.min(idx * 0.04, 0.4)}s both`,
      }}>

        {/* ── Photo banner ── */}
        <div style={{
          position:           "relative",
          height:             100,
          backgroundImage:    bannerBg,
          backgroundSize:     f.photoUrl ? "cover" : "auto",
          backgroundPosition: "center top",
          flexShrink:         0,
        }}>
          {/* Bottom-fade scrim so specialty badge is always readable */}
          <div style={{
            position:   "absolute", inset: 0,
            background: "linear-gradient(to bottom, transparent 40%, rgba(7,8,8,0.72) 100%)",
          }} />

          {/* Specialty badge - bottom-left of banner */}
          <div style={{
            position: "absolute", bottom: 10, left: 14,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontSize: 11 }}>{spec.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
              {spec.short}
            </span>
          </div>

          {/* Fallback initials centered when no photo */}
          {!f.photoUrl && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontStyle: "italic",
                fontSize: "4rem", color: "rgba(218,54,51,0.25)",
                letterSpacing: "-0.04em", textTransform: "uppercase", userSelect: "none",
              }}>
                {initials}
              </span>
            </div>
          )}
        </div>

        {/* ── Name block ── */}
        <div style={{ padding: "14px 16px 10px" }}>
          {parts.map((p, i) => (
            <div key={i} style={{
              fontFamily:    "'Barlow Condensed', sans-serif",
              fontWeight:    900,
              fontStyle:     "italic",
              fontSize:      "clamp(1.4rem, 3vw, 1.9rem)",
              lineHeight:    0.9,
              letterSpacing: "-0.025em",
              textTransform: "uppercase",
              color:         D.text,
            }}>
              {p}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "0 16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>

          {(f.activeClientCount ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "1.1rem", color: D.text }}>
                {f.activeClientCount}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: D.faint }}>
                Athletes
              </span>
            </div>
          )}

          {f.bio && (
            <p className="bio-clamp" style={{ fontSize: 11, color: D.faint, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0 }}>
              {f.bio}
            </p>
          )}

          {tiers.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto", paddingTop: 4 }}>
              {tiers.map(tier => {
                const tc    = TIER_COLORS[tier];
                const price = Number(f[`${tier.toLowerCase()}Price`]);
                return (
                  <span key={tier} style={{ fontSize: 9, fontWeight: 700, color: tc.color, background: tc.bg, border: `0.5px solid ${tc.color}25`, padding: "3px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {tier} · {price === 0 ? "Free" : `$${price}`}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        <div style={{ padding: "10px 16px", borderTop: `0.5px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="cta" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red }}>
            Start Training →
          </span>
          {lowest && (
            <span style={{ fontSize: 10, color: D.faint }}>
              {lowest.isFree ? "Free access" : `From $${lowest.price}/mo`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ height: 310, background: D.bgCard, border: `0.5px solid ${D.border}`, borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TrainersPage() {
  const router   = useRouter();
  const { goal } = router.query;

  const [trainers,  setTrainers]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [specialty, setSpecialty] = useState("");
  const [sortBy,    setSortBy]    = useState("featured");

  useEffect(() => {
    fetch("/api/commercial/trainers-public")
      .then(r => r.ok ? r.json() : { trainers: [] })
      .then(d => setTrainers(d.trainers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Apply goal preset from query param
  useEffect(() => {
    if (!router.isReady || !goal) return;
    const preset = GOAL_PRESETS[goal];
    if (preset?.length === 1) setSpecialty(preset[0]);
  }, [router.isReady, goal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = trainers.filter(t => {
      const f = t.fields ?? {};
      if (specialty && f.specialty !== specialty) return false;
      if (q && !["name", "specialty", "bio"].some(k => String(f[k] || "").toLowerCase().includes(q))) return false;
      return true;
    });
    if (sortBy === "athletes") return [...list].sort((a, b) => (b.fields?.activeClientCount ?? 0) - (a.fields?.activeClientCount ?? 0));
    if (sortBy === "price_asc") return [...list].sort((a, b) => (lowestTier(a)?.price ?? 999) - (lowestTier(b)?.price ?? 999));
    if (sortBy === "price_desc") return [...list].sort((a, b) => (lowestTier(b)?.price ?? 0) - (lowestTier(a)?.price ?? 0));
    if (sortBy === "az") return [...list].sort((a, b) => (a.fields?.name ?? "").localeCompare(b.fields?.name ?? ""));
    return list;
  }, [trainers, specialty, search, sortBy]);

  const hasFilters = search.trim() || specialty;

  return (
    <>
      <Head>
        <title>The Arena - CheckPeak</title>
        <meta name="description" content="Find elite coaches and training programs on CheckPeak." />
      </Head>
      <style>{CSS}</style>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* ── Compact page header ── */}
        <header style={{
          padding:    "40px 48px 32px",
          background: `
            radial-gradient(ellipse 80% 120% at 50% -20%, rgba(218,54,51,0.07) 0%, transparent 55%),
            ${D.bg}
          `,
          borderBottom: `0.5px solid ${D.border}`,
        }}>
          <div style={{ maxWidth: 1140, margin: "0 auto" }}>

            {/* Eyebrow + title row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 22, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 2, background: D.red }} />
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                    CheckPeak Commercial
                  </span>
                </div>
                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 0.88, letterSpacing: "-0.03em", textTransform: "uppercase", color: D.text }}>
                  The Arena.
                </h1>
              </div>
              {!loading && (
                <p style={{ fontSize: 12, color: D.faint, paddingBottom: 4 }}>
                  {trainers.length} coach{trainers.length !== 1 ? "es" : ""} available
                </p>
              )}
            </div>

            {/* Search */}
            <div style={{ position: "relative", maxWidth: 480 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.faint} strokeWidth="2.5" strokeLinecap="round"
                style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="si"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, specialty, or bio…"
                style={{ width: "100%", padding: "10px 12px 10px 38px", background: D.bgCard, border: `0.5px solid ${D.borderMid}`, borderRadius: 3, fontSize: 13, color: D.text, fontFamily: "inherit" }}
              />
            </div>
          </div>
        </header>

        {/* ── Sticky filter bar ── */}
        <div style={{
          position:     "sticky",
          top:          0,
          zIndex:       50,
          background:   "rgba(13,17,23,0.96)",
          backdropFilter: "blur(10px)",
          borderBottom: `0.5px solid ${D.border}`,
          overflowX:    "auto",
        }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 48px", display: "flex", alignItems: "center", gap: 2, height: 48, whiteSpace: "nowrap", justifyContent: "space-between" }}>

            {/* All */}
            <button className="fp" onClick={() => setSpecialty("")}
              style={{ padding: "6px 14px", background: !specialty ? `${D.red}16` : "transparent", border: `0.5px solid ${!specialty ? `${D.red}50` : D.border}`, color: !specialty ? D.red : D.faint, fontSize: 11, fontWeight: !specialty ? 800 : 500, letterSpacing: "0.06em", fontFamily: "inherit", borderRadius: 2 }}>
              All
              {!loading && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6 }}>{trainers.length}</span>}
            </button>

            {/* Specialty filters */}
            {Object.entries(SPECIALTIES).map(([key, { icon, short }]) => {
              const isActive = specialty === key;
              const count    = trainers.filter(t => t.fields?.specialty === key).length;
              if (!loading && count === 0) return null; // hide empty specialties
              return (
                <button key={key} className="fp" onClick={() => setSpecialty(isActive ? "" : key)}
                  style={{ padding: "6px 14px", background: isActive ? `${D.red}16` : "transparent", border: `0.5px solid ${isActive ? `${D.red}50` : D.border}`, color: isActive ? D.red : D.faint, fontSize: 11, fontWeight: isActive ? 800 : 500, letterSpacing: "0.06em", fontFamily: "inherit", borderRadius: 2 }}>
                  {icon} {short}
                  {!loading && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6 }}>{count}</span>}
                </button>
              );
            })}

            {/* Clear - only when active */}
            {hasFilters && (
              <>
                <div style={{ width: "0.5px", height: 16, background: D.border, margin: "0 6px", flexShrink: 0 }} />
                <button className="fp" onClick={() => { setSearch(""); setSpecialty(""); }}
                  style={{ padding: "6px 12px", background: "transparent", border: "none", color: D.red, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "inherit", cursor: "pointer" }}>
                  Clear ✕
                </button>
              </>
            )}

            {/* Sort */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", paddingLeft: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: D.faint, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sort</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ background: D.bgCard, border: `0.5px solid ${D.border}`, color: D.dim, fontSize: 11, fontFamily: "inherit", padding: "4px 8px", borderRadius: 2, outline: "none", cursor: "pointer" }}>
                <option value="featured">Featured</option>
                <option value="athletes">Most Athletes</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="az">A → Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <main style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 48px 80px" }}>

          {/* Result count - only when filtered */}
          {!loading && hasFilters && (
            <p style={{ fontSize: 11, color: D.faint, marginBottom: 20, letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
          )}

          {loading ? (
            <div className="ag" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 14 }}>
                Nobody Found.
              </h2>
              <p style={{ fontSize: 13, color: D.faint, marginBottom: 24 }}>Try adjusting your search or filter.</p>
              {hasFilters && (
                <button onClick={() => { setSearch(""); setSpecialty(""); }}
                  style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear filters →
                </button>
              )}
            </div>
          ) : (
            <div className="ag" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {filtered.map((t, i) => <TrainerCard key={t.id} trainer={t} idx={i} />)}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>
            CheckPeak
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", letterSpacing: "0.06em" }}>
            Commercial Platform · {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </>
  );
}