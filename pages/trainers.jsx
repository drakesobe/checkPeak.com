// pages/trainers.jsx
// The Arena — dark editorial marketplace matching the brand.
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

// ─── Design tokens — matches trainer profile exactly ──────────────────────────
const D = {
  bg:        "#070808",
  bgSection: "#0D1117",
  bgCard:    "#0F1318",
  bgCardHov: "#141820",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.13)",
  text:      "#F0F6FC",
  dim:       "rgba(255,255,255,0.52)",
  faint:     "rgba(255,255,255,0.26)",
  whisper:   "rgba(255,255,255,0.1)",
  red:       "#DA3633",
};

const TIER_COLORS = {
  Basic:   "#3FB950",
  Premium: "#F0883E",
  Ultra:   "#79B8FF",
};

const SPECIALTY_CONFIG = {
  "Strength & Conditioning Coach": { icon: "⚡", short: "S&C"         },
  "Personal Trainer":              { icon: "🏋️", short: "PT"           },
  "Physical Therapist":            { icon: "🩺", short: "PT / Rehab"   },
  "Massage Therapist":             { icon: "💆", short: "Recovery"      },
  "Sports Nutritionist":           { icon: "🥗", short: "Nutrition"     },
  "Online Coach":                  { icon: "💻", short: "Online"        },
};

const GOAL_PRESETS = {
  strength:  { specialties: ["Strength & Conditioning Coach", "Personal Trainer"] },
  recovery:  { specialties: ["Physical Therapist", "Massage Therapist"]           },
  nutrition: { specialties: ["Sports Nutritionist"]                               },
  online:    { specialties: ["Online Coach"]                                      },
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin   { to { transform: rotate(360deg); } }

  .arena-card {
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    cursor: pointer;
  }
  .arena-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 28px 64px rgba(0,0,0,0.7);
    border-color: rgba(255,255,255,0.14) !important;
  }
  .arena-card .card-cta { opacity: 0.6; transition: opacity 0.16s; }
  .arena-card:hover .card-cta { opacity: 1; }
  .arena-card .red-bar { transform: scaleX(0); transition: transform 0.22s ease; transform-origin: left; }
  .arena-card:hover .red-bar { transform: scaleX(1); }

  .filter-pill {
    transition: background 0.14s, border-color 0.14s, color 0.14s;
    cursor: pointer;
  }
  .filter-pill:hover { border-color: rgba(255,255,255,0.22) !important; }

  .search-input::placeholder { color: rgba(255,255,255,0.28); }
  .search-input:focus { outline: none; border-color: rgba(218,54,51,0.5) !important; box-shadow: 0 0 0 3px rgba(218,54,51,0.1); }

  @media (max-width: 640px) {
    .arena-grid { grid-template-columns: 1fr !important; }
    .arena-hero-title { font-size: clamp(3rem, 14vw, 5rem) !important; }
  }
`;

function splitName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return parts;
  return [parts[0], parts.slice(1).join(" ")];
}

function muxThumb(id) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`;
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
function TrainerCard({ trainer, index }) {
  const f      = trainer.fields ?? {};
  const parts  = splitName(f.name ?? "");
  const spec   = SPECIALTY_CONFIG[f.specialty] ?? { icon: "💪", short: f.specialty };
  const lowest = lowestTier(f);

  // Use first published video thumbnail if available
  const thumb = null; // Would need extra API call — use gradient instead

  return (
    <Link href={`/trainer/${f.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        className="arena-card"
        style={{
          background:     D.bgCard,
          border:         `0.5px solid ${D.border}`,
          borderRadius:   3,
          overflow:       "hidden",
          height:         "100%",
          display:        "flex",
          flexDirection:  "column",
          animation:      `fadeUp 0.45s ease ${index * 0.06}s both`,
          position:       "relative",
        }}
      >
        {/* Red slide bar on hover */}
        <div
          className="red-bar"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: D.red, zIndex: 2 }}
        />

        {/* Card hero — gradient + name */}
        <div style={{
          background:  `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(218,54,51,0.07) 0%, transparent 70%),
            repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.008) 23px, rgba(255,255,255,0.008) 24px),
            repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(255,255,255,0.008) 23px, rgba(255,255,255,0.008) 24px),
            ${D.bgSection}
          `,
          padding:     "28px 24px 20px",
          position:    "relative",
        }}>
          {/* Specialty chip */}
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{spec.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: D.faint }}>
              {spec.short}
            </span>
          </div>

          {/* Name */}
          <div>
            {parts.map((part, i) => (
              <div
                key={i}
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(1.8rem, 4.5vw, 2.4rem)",
                  lineHeight:    0.88,
                  letterSpacing: "-0.025em",
                  textTransform: "uppercase",
                  color:         D.text,
                }}
              >
                {part}
              </div>
            ))}
          </div>
        </div>

        {/* Divider line */}
        <div style={{ height: "0.5px", background: D.border, margin: "0 24px" }} />

        {/* Stats + pricing */}
        <div style={{ padding: "16px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { value: f.activeClientCount ?? 0, label: "Athletes" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "1.6rem",
                  lineHeight:    1,
                  letterSpacing: "-0.02em",
                  color:         D.text,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: D.faint, marginTop: 3 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Bio */}
          {f.bio && (
            <p style={{
              fontSize:            12,
              color:               D.faint,
              lineHeight:          1.6,
              display:             "-webkit-box",
              WebkitLineClamp:     2,
              WebkitBoxOrient:     "vertical",
              overflow:            "hidden",
            }}>
              {f.bio}
            </p>
          )}

          {/* Tier chips */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["Basic", "Premium", "Ultra"].map(tier => {
              if (!tierAvailable(f, tier)) return null;
              const price = Number(f[`${tier.toLowerCase()}Price`]);
              const color = TIER_COLORS[tier];
              return (
                <span key={tier} style={{
                  fontSize:      10,
                  fontWeight:    700,
                  color:         color,
                  background:    `${color}12`,
                  border:        `0.5px solid ${color}30`,
                  padding:       "3px 9px",
                  letterSpacing: "0.04em",
                }}>
                  {tier} · {price === 0 ? "Free" : `$${price}/mo`}
                </span>
              );
            })}
          </div>
        </div>

        {/* CTA footer */}
        <div style={{ padding: "14px 24px", borderTop: `0.5px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="card-cta" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red }}>
            Start Training →
          </span>
          {lowest && (
            <span style={{ fontSize: 11, color: D.faint }}>
              {lowest.isFree ? "Free access" : `From $${lowest.price}/mo`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TrainersPage() {
  const router      = useRouter();
  const { goal }    = router.query;
  const preset      = goal ? GOAL_PRESETS[goal] ?? null : null;

  const [trainers, setTrainers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [specialty, setSpecialty] = useState("");

  useEffect(() => {
    fetch("/api/commercial/trainers")
      .then(r => r.ok ? r.json() : { trainers: [] })
      .then(d => setTrainers(d.trainers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (preset?.specialties?.length === 1) setSpecialty(preset.specialties[0]);
  }, [router.isReady, goal]);

  const filtered = useMemo(() => {
    return trainers.filter(t => {
      const f = t.fields ?? {};
      if (preset?.specialties?.length > 1 && !specialty) {
        if (!preset.specialties.includes(f.specialty)) return false;
      }
      if (specialty && f.specialty !== specialty) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !String(f.name      || "").toLowerCase().includes(q) &&
          !String(f.specialty || "").toLowerCase().includes(q) &&
          !String(f.bio       || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [trainers, specialty, search, preset]);

  const allSpecialties = Object.keys(SPECIALTY_CONFIG);

  return (
    <>
      <Head>
        <title>The Arena — CheckPeak Commercial</title>
        <meta name="description" content="Find elite coaches and trainers on CheckPeak Commercial." />
      </Head>
      <style>{GLOBAL_CSS}</style>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* ── Hero ── */}
        <section style={{
          padding:    "80px 56px 64px",
          background: `
            radial-gradient(ellipse 100% 80% at 50% -10%, rgba(218,54,51,0.08) 0%, transparent 60%),
            repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
            repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
            ${D.bg}
          `,
          borderBottom: `0.5px solid ${D.border}`,
        }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>

            {/* Eyebrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, animation: "fadeUp 0.4s ease 0.1s both" }}>
              <div style={{ width: 28, height: 2, background: D.red }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.25em", textTransform: "uppercase", color: D.red }}>
                CheckPeak Commercial
              </span>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 20, animation: "fadeUp 0.5s ease 0.18s both" }}>
              <h1
                className="arena-hero-title"
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(3.5rem, 10vw, 8rem)",
                  lineHeight:    0.86,
                  letterSpacing: "-0.03em",
                  textTransform: "uppercase",
                  color:         D.text,
                  marginBottom:  8,
                }}
              >
                The Arena.
              </h1>
              <p style={{ fontSize: 14, color: D.faint, maxWidth: 440, lineHeight: 1.65 }}>
                Elite coaches. Serious programs. Train with the people who actually know what they're doing.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", maxWidth: 500, animation: "fadeUp 0.5s ease 0.26s both" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={D.faint} strokeWidth="2.5" strokeLinecap="round"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search coaches by name or specialty…"
                style={{
                  width:         "100%",
                  padding:       "12px 14px 12px 42px",
                  background:    D.bgCard,
                  border:        `0.5px solid ${D.borderMid}`,
                  borderRadius:  3,
                  fontSize:      13,
                  color:         D.text,
                  fontFamily:    "inherit",
                  transition:    "border-color 0.14s, box-shadow 0.14s",
                }}
              />
            </div>
          </div>
        </section>

        {/* ── Filter bar ── */}
        <div style={{ borderBottom: `0.5px solid ${D.border}`, padding: "0 56px", background: D.bgSection, overflowX: "auto" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 2, padding: "12px 0", whiteSpace: "nowrap" }}>
            {[
              { key: "", label: "All Coaches" },
              ...allSpecialties.map(sp => ({ key: sp, label: SPECIALTY_CONFIG[sp].icon + " " + SPECIALTY_CONFIG[sp].short })),
            ].map(({ key, label }) => {
              const isActive = specialty === key;
              return (
                <button
                  key={key}
                  className="filter-pill"
                  onClick={() => setSpecialty(key)}
                  style={{
                    padding:       "8px 16px",
                    background:    isActive ? `${D.red}18` : "transparent",
                    border:        `0.5px solid ${isActive ? `${D.red}55` : D.border}`,
                    color:         isActive ? D.red : D.faint,
                    fontSize:      11,
                    fontWeight:    isActive ? 800 : 600,
                    letterSpacing: "0.06em",
                    fontFamily:    "inherit",
                    borderRadius:  2,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Grid ── */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 56px 80px" }}>

          {/* Result count */}
          <p style={{ fontSize: 11, color: D.faint, marginBottom: 24, letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}>
            {loading ? "Loading coaches…" : `${filtered.length} Coach${filtered.length !== 1 ? "es" : ""}`}
          </p>

          {loading ? (
            <div className="arena-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{
                  height: 340, background: D.bgCard,
                  border: `0.5px solid ${D.border}`, borderRadius: 3,
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <p style={{
                fontFamily:    "'Barlow Condensed', sans-serif",
                fontWeight:    900,
                fontStyle:     "italic",
                fontSize:      "clamp(2rem, 5vw, 3.5rem)",
                lineHeight:    0.9,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color:         D.text,
                marginBottom:  16,
              }}>
                Nobody Found.
              </p>
              <p style={{ fontSize: 13, color: D.faint, marginBottom: 28 }}>
                Try adjusting your search or filter.
              </p>
              {(search || specialty) && (
                <button
                  onClick={() => { setSearch(""); setSpecialty(""); }}
                  style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Clear filters →
                </button>
              )}
            </div>
          ) : (
            <div className="arena-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {filtered.map((t, i) => (
                <TrainerCard key={t.id} trainer={t} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "24px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>
            CheckPeak
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.14)", letterSpacing: "0.06em" }}>
            Commercial Platform · {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </>
  );
}