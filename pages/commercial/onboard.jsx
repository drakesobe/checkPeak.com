// pages/commercial/onboard.jsx
// Trainer / org onboarding - light theme (org-side), 3 steps.
// Step 1: Profile   - name, specialty, bio
// Step 2: Program   - client count, org type, primary goal, sport/focus
// Step 3: Pricing   - tier pricing with free toggle
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";
import { Lightbulb } from "lucide-react";

// ─── Design tokens - light org theme ─────────────────────────────────────────
const DS = {
  brand:         "#1E3A5F",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
  banned:        "#C0392B",
  bannedBg:      "#FDF2F2",
};

const TIER_COLORS = {
  Basic:   { color: DS.safe,    bg: DS.safeBg,    border: DS.safeBorder    },
  Premium: { color: DS.caution, bg: DS.cautionBg, border: DS.cautionBorder },
  Ultra:   { color: DS.brand,   bg: DS.brandBg,   border: DS.brandBorder   },
};

// ─── Step 1 options ───────────────────────────────────────────────────────────
const SPECIALTIES = [
  "Personal Trainer",
  "Strength & Conditioning Coach",
  "Physical Therapist",
  "Massage Therapist",
  "Sports Nutritionist",
  "Online Coach",
  "Other",
];

// ─── Step 2 options ───────────────────────────────────────────────────────────
const CLIENT_COUNTS = [
  { value: "1-10",   label: "1–10",   sub: "Just starting out"  },
  { value: "11-50",  label: "11–50",  sub: "Growing program"    },
  { value: "51-200", label: "51–200", sub: "Established"        },
  { value: "200+",   label: "200+",   sub: "Large program"      },
];

const ORG_TYPES = [
  "Individual Trainer",
  "Private Gym / Studio",
  "Collegiate / University Program",
  "High School Program",
  "Sports Team / Club",
  "Corporate Wellness",
  "Other",
];

const GOALS = [
  { value: "video_library",    label: "Share workout videos",        sub: "Centralize your content for athletes" },
  { value: "paid_coaching",    label: "Build paid online coaching",  sub: "Monetize your expertise remotely"    },
  { value: "supplement",       label: "Supplement in-person work",   sub: "Extend your training beyond the gym" },
  { value: "collegiate",       label: "Run a collegiate program",    sub: "Manage an athletic program at scale" },
  { value: "accountability",   label: "Athlete accountability",      sub: "Track and motivate your athletes"    },
];

const SPORT_FOCUSES = [
  "Football", "Basketball", "Baseball / Softball", "Soccer",
  "Track & Field", "Swimming", "Strength Sports", "Combat Sports",
  "Tennis", "Golf", "General Fitness", "Multi-sport / Other",
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin   { to { transform: rotate(360deg); } }

  .ob-input {
    width: 100%; padding: 10px 12px;
    border: 1px solid ${DS.border}; border-radius: 6px;
    font-size: 14px; font-weight: 500; color: ${DS.bodyText};
    background: #fff; outline: none; font-family: inherit;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .ob-input::placeholder { color: ${DS.dimText}; }
  .ob-input:focus { border-color: ${DS.brand}; box-shadow: 0 0 0 3px ${DS.brandBg}; }

  .ob-textarea {
    width: 100%; padding: 10px 12px;
    border: 1px solid ${DS.border}; border-radius: 6px;
    font-size: 14px; font-weight: 500; color: ${DS.bodyText};
    background: #fff; outline: none; font-family: inherit;
    resize: vertical; min-height: 80px;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .ob-textarea::placeholder { color: ${DS.dimText}; }
  .ob-textarea:focus { border-color: ${DS.brand}; box-shadow: 0 0 0 3px ${DS.brandBg}; }

  .ob-pill {
    padding: 8px 12px; border: 1px solid ${DS.border}; border-radius: 6px;
    background: ${DS.pageBg}; font-size: 12px; font-weight: 600;
    color: ${DS.labelText}; cursor: pointer; font-family: inherit;
    text-align: left; transition: all 0.12s; line-height: 1.3;
  }
  .ob-pill:hover { border-color: ${DS.brandBorder}; color: ${DS.brand}; background: ${DS.brandBg}; }
  .ob-pill.active { background: ${DS.brandBg}; border-color: ${DS.brand}; color: ${DS.brand}; font-weight: 700; }

  .ob-goal-pill {
    padding: 12px 14px; border: 1px solid ${DS.border}; border-radius: 8px;
    background: ${DS.pageBg}; cursor: pointer; font-family: inherit;
    text-align: left; transition: all 0.12s; display: flex; flex-direction: column; gap: 3px;
  }
  .ob-goal-pill:hover { border-color: ${DS.brandBorder}; background: ${DS.brandBg}; }
  .ob-goal-pill.active { background: ${DS.brandBg}; border-color: ${DS.brand}; }

  .ob-btn-primary {
    width: 100%; padding: 12px; background: ${DS.brand}; color: #fff;
    border: none; border-radius: 7px; font-size: 13px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: opacity 0.14s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .ob-btn-primary:hover:not(:disabled) { opacity: 0.87; }
  .ob-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .ob-btn-ghost {
    padding: 11px 18px; background: transparent;
    border: 1px solid ${DS.border}; border-radius: 7px;
    font-size: 13px; font-weight: 600; color: ${DS.labelText};
    cursor: pointer; font-family: inherit; transition: all 0.12s; white-space: nowrap;
  }
  .ob-btn-ghost:hover { background: ${DS.pageBg}; border-color: ${DS.brandBorder}; color: ${DS.brand}; }

  .ob-price-row {
    border: 1px solid ${DS.border}; border-radius: 8px;
    background: #fff; overflow: hidden; margin-bottom: 10px;
    transition: border-color 0.15s;
  }
`;

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepHeader({ step, total, label, title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.brand }}>
          Step {step} of {total}
        </span>
        <div style={{ flex: 1, height: "0.5px", background: DS.border }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: DS.dimText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      <h1 style={{ fontSize: "1.45rem", fontWeight: 900, color: DS.bodyText, marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
        {title}
      </h1>
      <p style={{ fontSize: 13, color: DS.labelText, lineHeight: 1.65 }}>{sub}</p>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 7 }}>
      {children}
    </label>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      {children}
      {hint && <p style={{ fontSize: 11, color: DS.dimText, marginTop: 5 }}>{hint}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CommercialOnboard() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;

  // Step 1
  const [name,      setName]      = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio,       setBio]       = useState("");

  // Step 2
  const [clientCount, setClientCount] = useState("");
  const [orgType,     setOrgType]     = useState("");
  const [goal,        setGoal]        = useState("");
  const [sport,       setSport]       = useState("");

  // Step 3
  const [prices, setPrices] = useState({ Basic: "", Premium: "", Ultra: "" });

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push("/login"); return; }
    fetch("/api/commercial/trainer", { credentials: "include" })
      .then(r => { if (r.ok) router.push("/commercial/dashboard"); })
      .catch(() => {});
  }, [user, authReady, router]);

  function toggleFree(tier) {
    setPrices(prev => ({ ...prev, [tier]: prev[tier] === "0" ? "" : "0" }));
  }

  async function handleFinish() {
    const filled = ["Basic", "Premium", "Ultra"].every(t => prices[t] !== "");
    if (!filled) return setError("Set a price for each tier - or toggle Free.");

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/commercial/trainer", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, specialty, bio,
          basicPrice:   prices.Basic,
          premiumPrice: prices.Premium,
          ultraPrice:   prices.Ultra,
          // Program metadata
          clientCount, orgType, goal, sport,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/commercial/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  const step1Valid = name.trim() && specialty;
  const step2Valid = clientCount && orgType && goal;

  if (!authReady || !user) return null;

  return (
    <>
      <Head><title>Set up your CheckPeak profile</title></Head>

      <div style={{ minHeight: "100vh", backgroundColor: DS.pageBg, fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 560, animation: "fadeUp 0.4s ease both" }}>

          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.brand, textDecoration: "none" }}>
              CheckPeak
            </a>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.dimText, marginLeft: 8 }}>
              Commercial
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28, height: 3 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: 99,
                background: i + 1 <= step ? DS.brand : DS.border,
                transition: "background 0.3s",
              }} />
            ))}
          </div>

          {/* Card */}
          <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, borderRadius: 12, padding: "32px 28px" }}>

            {/* ── STEP 1: Profile ── */}
            {step === 1 && (
              <>
                <StepHeader
                  step={1} total={TOTAL_STEPS} label="Profile"
                  title="Create your profile"
                  sub="This is what athletes and programs see when they find you on CheckPeak."
                />

                <Field label="Your name">
                  <input className="ob-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Marcus Johnson" />
                </Field>

                <Field label="Specialty">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {SPECIALTIES.map(sp => (
                      <button key={sp} type="button" className={`ob-pill${specialty === sp ? " active" : ""}`} onClick={() => setSpecialty(sp)}>
                        {sp}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Bio" hint="Optional - your background, philosophy, and what athletes can expect.">
                  <textarea className="ob-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. S&C Coach at Arizona State. Focused on athlete performance and longevity." />
                </Field>

                <button className="ob-btn-primary" disabled={!step1Valid} onClick={() => setStep(2)}>
                  Continue →
                </button>
              </>
            )}

            {/* ── STEP 2: Program details ── */}
            {step === 2 && (
              <>
                <StepHeader
                  step={2} total={TOTAL_STEPS} label="Program"
                  title="Tell us about your program"
                  sub="Helps us tailor CheckPeak to how you actually work. Takes 30 seconds."
                />

                {/* Client count */}
                <Field label="How many athletes or clients do you work with?">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {CLIENT_COUNTS.map(({ value, label, sub }) => (
                      <button
                        key={value}
                        type="button"
                        className={`ob-pill${clientCount === value ? " active" : ""}`}
                        onClick={() => setClientCount(value)}
                        style={{ textAlign: "center", padding: "10px 8px" }}
                      >
                        <span style={{ display: "block", fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{label}</span>
                        <span style={{ display: "block", fontSize: 10, fontWeight: 500, marginTop: 2, color: "inherit", opacity: 0.7 }}>{sub}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Org type */}
                <Field label="What best describes your organization?">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {ORG_TYPES.map(o => (
                      <button key={o} type="button" className={`ob-pill${orgType === o ? " active" : ""}`} onClick={() => setOrgType(o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Primary goal */}
                <Field label="Primary goal with CheckPeak?">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {GOALS.map(({ value, label, sub }) => (
                      <button
                        key={value}
                        type="button"
                        className={`ob-goal-pill${goal === value ? " active" : ""}`}
                        onClick={() => setGoal(value)}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: goal === value ? DS.brand : DS.bodyText }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 11, color: DS.labelText }}>{sub}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Sport focus - optional */}
                <Field label="Sport or focus area" hint="Optional - skip if multi-sport or general fitness.">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {SPORT_FOCUSES.map(s => (
                      <button key={s} type="button" className={`ob-pill${sport === s ? " active" : ""}`} onClick={() => setSport(prev => prev === s ? "" : s)} style={{ fontSize: 11, textAlign: "center" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="ob-btn-ghost" onClick={() => setStep(1)}>← Back</button>
                  <button className="ob-btn-primary" style={{ flex: 1 }} disabled={!step2Valid} onClick={() => setStep(3)}>
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3: Pricing ── */}
            {step === 3 && (
              <>
                <StepHeader
                  step={3} total={TOTAL_STEPS} label="Pricing"
                  title="Set your pricing"
                  sub="You keep 100% of what clients pay. Toggle Free to give open access at no cost."
                />

                {[
                  { tier: "Basic",   desc: "Video library access"                    },
                  { tier: "Premium", desc: "Library + custom workouts from you"      },
                  { tier: "Ultra",   desc: "Library + workouts + in-person sessions" },
                ].map(({ tier, desc }) => {
                  const tc     = TIER_COLORS[tier];
                  const isFree = prices[tier] === "0";

                  return (
                    <div key={tier} className="ob-price-row" style={{ borderLeft: `3px solid ${tc.color}`, borderColor: isFree ? tc.border : DS.border }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: isFree ? "none" : `1px solid ${DS.border}`, background: isFree ? tc.bg : "#fff", transition: "background 0.2s" }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: tc.color }}>{tier}</p>
                          <p style={{ fontSize: 12, color: DS.labelText, marginTop: 1 }}>{desc}</p>
                        </div>

                        {/* Free toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }} onClick={() => toggleFree(tier)}>
                          <div style={{ width: 30, height: 17, borderRadius: 99, background: isFree ? tc.color : DS.border, position: "relative", transition: "background 0.18s", flexShrink: 0 }}>
                            <div style={{ position: "absolute", top: 2.5, left: isFree ? 15 : 2.5, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.18s" }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isFree ? tc.color : DS.dimText, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Free
                          </span>
                        </label>
                      </div>

                      {!isFree && (
                        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: DS.dimText }}>$</span>
                          <input
                            type="number" min="0"
                            style={{ width: 100, padding: "8px 10px", border: `1px solid ${DS.border}`, borderRadius: 6, fontSize: 17, fontWeight: 800, color: DS.bodyText, outline: "none", fontFamily: "inherit", textAlign: "right" }}
                            value={prices[tier]}
                            onChange={e => setPrices(prev => ({ ...prev, [tier]: e.target.value }))}
                            placeholder="0"
                            onFocus={e => { e.target.style.borderColor = tc.color; e.target.style.boxShadow = `0 0 0 3px ${tc.bg}`; }}
                            onBlur={e =>  { e.target.style.borderColor = DS.border; e.target.style.boxShadow = "none"; }}
                          />
                          <span style={{ fontSize: 12, color: DS.dimText }}>/mo</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Tip */}
                <div style={{ padding: "11px 14px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderRadius: 7, fontSize: 12, color: "#0044AA", marginTop: 6, marginBottom: 20 }}>
                  <Lightbulb size={13} strokeWidth={1.6} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} /> Typical pricing: Basic $19–29 · Premium $39–59 · Ultra $79–149/mo
                </div>

                {error && (
                  <div style={{ padding: "10px 14px", background: DS.bannedBg, border: `1px solid ${DS.banned}`, borderRadius: 7, fontSize: 13, color: DS.banned, fontWeight: 600, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ob-btn-ghost" onClick={() => setStep(2)}>← Back</button>
                  <button className="ob-btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleFinish}>
                    {saving ? (
                      <>
                        <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                        Creating profile…
                      </>
                    ) : "Launch my profile →"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: DS.dimText }}>
            Already set up?{" "}
            <a href="/commercial/dashboard" style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>
              Go to dashboard →
            </a>
          </p>
        </div>
      </div>

      <style>{CSS}</style>
    </>
  );
}