"use client";
// pages/onboarding.jsx — First-time athlete setup wizard (4 steps).
// Gated by localStorage "cp_onboarding_done". Shown once after first login.
// No nav rendered (_app.js has /onboarding in NO_NAV_ROUTES).

import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { Target } from "lucide-react";
import {
  IconSportFootball, IconSportBasketball, IconSportBaseball,
  IconSportSoccer, IconSportTrack, IconSportWrestling,
  IconSportSwimming, IconSportVolleyball, IconSportOther,
} from "@/components/Icons";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/hooks/useAuth";

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg:     "#060810",
  card:   "#0C1220",
  raised: "#121B2E",
  border: "#1C2A42",
  accent: "#4FABFF",
  green:  "#22C55E",
  white:  "#FFFFFF",
  dim:    "rgba(255,255,255,0.45)",
  muted:  "rgba(255,255,255,0.25)",
  faint:  "rgba(255,255,255,0.06)",
  font:   "'Barlow', sans-serif",
  cond:   "'Barlow Condensed', sans-serif",
};

/* ── Data ──────────────────────────────────────────────────────────────────── */
const SPORT_ICON_COMPONENTS = {
  Football:   IconSportFootball,
  Basketball: IconSportBasketball,
  Baseball:   IconSportBaseball,
  Soccer:     IconSportSoccer,
  Track:      IconSportTrack,
  Wrestling:  IconSportWrestling,
  Swimming:   IconSportSwimming,
  Volleyball: IconSportVolleyball,
  Softball:   IconSportBaseball,
  Other:      IconSportOther,
};

const SPORTS = [
  { key: "Football",   label: "Football"   },
  { key: "Basketball", label: "Basketball" },
  { key: "Baseball",   label: "Baseball"   },
  { key: "Soccer",     label: "Soccer"     },
  { key: "Track",      label: "Track"      },
  { key: "Wrestling",  label: "Wrestling"  },
  { key: "Swimming",   label: "Swimming"   },
  { key: "Volleyball", label: "Volleyball" },
  { key: "Softball",   label: "Softball"   },
  { key: "Other",      label: "Other"      },
];

const POSITIONS_BY_SPORT = {
  Football:   ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K/P", "ATH"],
  Basketball: ["PG", "SG", "SF", "PF", "C"],
  Baseball:   ["P", "C", "1B", "2B", "3B", "SS", "OF", "DH"],
  Soccer:     ["GK", "CB", "FB", "CM", "CAM", "CF", "WG"],
  Track:      ["Sprints", "Distance", "Jumps", "Throws", "Hurdles", "Multi"],
  Wrestling:  ["106", "113", "120", "126", "132", "138", "145", "152", "160", "170", "182", "195", "220", "285"],
  Swimming:   ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"],
  Volleyball: ["S", "OH", "MB", "RS", "L", "DS"],
  Softball:   ["P", "C", "1B", "2B", "3B", "SS", "OF"],
  Other:      [],
};

const LEVELS = [
  { key: "highschool", label: "High School" },
  { key: "college",    label: "College"     },
  { key: "pro",        label: "Pro"         },
];

// Years shown for both HS and college — same range works for both
const GRAD_YEARS = Array.from({ length: 8 }, (_, i) => String(2025 + i));

const ALL_BASELINE_FIELDS = [
  { key: "squat",         label: "Squat",        unit: "lb"  },
  { key: "bench",         label: "Bench Press",  unit: "lb"  },
  { key: "deadlift",      label: "Deadlift",     unit: "lb"  },
  { key: "powerClean",    label: "Power Clean",  unit: "lb"  },
  { key: "fortyYardDash", label: "40 Yard Dash", unit: "sec" },
  { key: "verticalJump",  label: "Vertical",     unit: "in"  },
  { key: "broadJump",     label: "Broad Jump",   unit: "in"  },
];

// Only show the fields that are relevant to each sport
const BASELINES_FOR_SPORT = {
  Football:   ["squat","bench","deadlift","powerClean","fortyYardDash","verticalJump"],
  Basketball: ["bench","fortyYardDash","verticalJump","broadJump"],
  Baseball:   ["squat","bench","deadlift","fortyYardDash"],
  Softball:   ["squat","bench","deadlift","fortyYardDash"],
  Soccer:     ["squat","bench","fortyYardDash","verticalJump"],
  Track:      ["fortyYardDash","verticalJump","broadJump","bench"],
  Wrestling:  ["squat","bench","deadlift","powerClean"],
  Swimming:   ["bench","deadlift","verticalJump"],
  Volleyball: ["bench","fortyYardDash","verticalJump","broadJump"],
  Other:      ["squat","bench","deadlift","powerClean","fortyYardDash"],
};

function getBaselineFields(sport) {
  const keys = BASELINES_FOR_SPORT[sport] || BASELINES_FOR_SPORT.Other;
  return keys.map(k => ALL_BASELINE_FIELDS.find(f => f.key === k)).filter(Boolean);
}

function isHighSchool(level) { return level === "highschool"; }

/* ── Small components ─────────────────────────────────────────────────────── */
function ProgressDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === step ? 24 : 8, height: 8, borderRadius: 4,
          background: i <= step ? C.accent : C.border,
          transition: "all 0.35s ease",
        }} />
      ))}
    </div>
  );
}

function SportTile({ sport, selected, onClick }) {
  const active = selected === sport.key;
  const Icon = SPORT_ICON_COMPONENTS[sport.key];
  const iconColor = active ? C.accent : C.dim;
  return (
    <button type="button" onClick={() => onClick(sport.key)}
      style={{
        padding: "12px 4px", borderRadius: 12, border: `1.5px solid ${active ? C.accent : C.border}`,
        background: active ? "rgba(79,171,255,0.1)" : C.faint,
        cursor: "pointer", textAlign: "center", transition: "all 0.18s",
        boxShadow: active ? `0 0 0 1px ${C.accent}30` : "none",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
        {Icon && <Icon size={20} color={iconColor} strokeWidth={1.5} />}
      </div>
      <div style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900,
        letterSpacing: "0.04em", color: active ? C.white : C.dim,
        textTransform: "uppercase", wordBreak: "break-word", lineHeight: 1.2 }}>{sport.label}</div>
    </button>
  );
}

function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 10,
        background: C.raised, border: `1px solid ${C.border}`,
        color: value ? C.white : C.muted,
        fontFamily: C.font, fontSize: 14,
        appearance: "none", cursor: "pointer",
      }}>
      <option value="" disabled>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BaselineInput({ field, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px", background: C.raised, borderRadius: 10,
      border: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: C.cond, fontSize: 11, fontWeight: 900,
          letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 2 }}>
          {field.label}
        </p>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          min={0}
          style={{
            background: "transparent", border: "none", outline: "none",
            fontFamily: C.cond, fontSize: 22, fontWeight: 900, fontStyle: "italic",
            color: value ? C.white : C.muted, width: "100%",
          }}
        />
      </div>
      <span style={{ fontFamily: C.font, fontSize: 13, color: C.muted, fontWeight: 600 }}>
        {field.unit}
      </span>
    </div>
  );
}

function ContinueBtn({ label = "Continue →", onClick, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: "15px", borderRadius: 12,
        background: disabled ? "rgba(79,171,255,0.25)" : C.accent,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: C.cond, fontSize: 16, fontWeight: 900, letterSpacing: "0.06em",
        color: "#000", transition: "background 0.2s",
        boxShadow: disabled ? "none" : "0 4px 20px rgba(79,171,255,0.35)",
      }}>
      {label}
    </button>
  );
}

function SkipBtn({ label = "Skip for now", onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        width: "100%", padding: "11px", borderRadius: 12,
        background: "transparent", border: `1px solid ${C.border}`,
        cursor: "pointer", fontFamily: C.font, fontSize: 13,
        color: C.dim, transition: "color 0.2s, border-color 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.white; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
      {label}
    </button>
  );
}

/* ── Step components ──────────────────────────────────────────────────────── */

function Step0Sport({ data, setData, onNext }) {
  return (
    <>
      <StepHeader
        step={1}
        title="What sport are you training for?"
        subtitle="We'll tailor your experience and benchmarks to your sport and level."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
        {SPORTS.map(s => (
          <SportTile key={s.key} sport={s} selected={data.sport} onClick={sport => setData(d => ({ ...d, sport, position: "" }))} />
        ))}
      </div>

      {data.sport && POSITIONS_BY_SPORT[data.sport]?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Label>Position</Label>
          <SelectInput
            value={data.position}
            onChange={v => setData(d => ({ ...d, position: v }))}
            options={POSITIONS_BY_SPORT[data.sport]}
            placeholder="Select your position"
          />
        </div>
      )}

      {/* Level selector */}
      <div style={{ marginBottom: data.level && data.level !== "pro" ? 16 : 24 }}>
        <Label>Level</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {LEVELS.map(l => {
            const active = data.level === l.key;
            return (
              <button key={l.key} type="button"
                onClick={() => setData(d => ({ ...d, level: l.key, gradYear: "" }))}
                style={{
                  flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                  fontFamily: C.cond, fontSize: 13, fontWeight: 900, letterSpacing: "0.04em",
                  border: `1.5px solid ${active ? C.accent : C.border}`,
                  background: active ? "rgba(79,171,255,0.12)" : C.faint,
                  color: active ? C.white : C.dim, transition: "all 0.15s",
                }}>
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grad year — shown for HS and College, not Pro */}
      {data.level && data.level !== "pro" && (
        <div style={{ marginBottom: 24 }}>
          <Label>
            {data.level === "college" ? "College Graduation Year" : "Class of"}
          </Label>
          <SelectInput
            value={data.gradYear}
            onChange={v => setData(d => ({ ...d, gradYear: v }))}
            options={GRAD_YEARS}
            placeholder="Select year…"
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ContinueBtn onClick={onNext} disabled={!data.sport || !data.level} />
      </div>
    </>
  );
}

function Step1Baselines({ data, setData, onNext, onSkip }) {
  const fields = getBaselineFields(data.sport);
  const anyFilled = Object.values(data.baselines).some(v => v && Number(v) > 0);

  return (
    <>
      <StepHeader
        step={2}
        title="Set your baselines"
        subtitle="We'll rank you nationally and track your progress. Leave blank anything you haven't tested yet."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {fields.map(f => (
          <BaselineInput
            key={f.key}
            field={f}
            value={data.baselines[f.key] || ""}
            onChange={v => setData(d => ({ ...d, baselines: { ...d.baselines, [f.key]: v } }))}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ContinueBtn
          label="Save Baselines →"
          onClick={onNext}
          disabled={!anyFilled}
        />
        <SkipBtn onClick={onSkip} />
      </div>
    </>
  );
}

function Step2Team({ data, setData, onNext, onSkip, joining, joinError }) {
  return (
    <>
      <StepHeader
        step={3}
        title="Join your team"
        subtitle="Got an org code from your coach? Enter it to connect to your organization and receive workouts."
      />

      <div style={{ marginBottom: 8 }}>
        <Label>Organization Code</Label>
        <input
          type="text"
          value={data.orgCode}
          onChange={e => setData(d => ({ ...d, orgCode: e.target.value.trim().toUpperCase() }))}
          placeholder="e.g. WILDCATS2025"
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 10,
            background: C.raised, border: `1px solid ${joinError ? "#D92B3A" : C.border}`,
            color: C.white, fontFamily: C.font, fontSize: 15,
            fontWeight: 700, letterSpacing: "0.06em", outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e  => { e.currentTarget.style.borderColor = C.accent; }}
          onBlur={e   => { e.currentTarget.style.borderColor = joinError ? "#D92B3A" : C.border; }}
          autoCapitalize="characters"
          spellCheck={false}
        />
        {joinError && (
          <p style={{ fontFamily: C.font, fontSize: 12, color: "#f87171", marginTop: 6 }}>{joinError}</p>
        )}
      </div>

      <p style={{ fontFamily: C.font, fontSize: 12, color: C.muted, marginBottom: 24 }}>
        Ask your coach or trainer for the code. You can also join later from your profile.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ContinueBtn label={joining ? "Joining…" : "Join Team →"} onClick={onNext} disabled={!data.orgCode || joining} />
        <SkipBtn label="Skip, I train solo" onClick={onSkip} />
      </div>
    </>
  );
}

function Step3Recruiting({ level, onFinish, onSkipToProfile }) {
  const isPro     = level === "pro";
  const isCollege = level === "college";
  const isHS      = level === "highschool" || !level;

  const title    = isPro || isCollege ? "Build your performance profile" : "Build your recruiting profile";
  const subtitle = isPro
    ? "Keep your stats organized and shareable. One link for scouts, teams, and your network."
    : isCollege
    ? "Share your achievements with coaches, scouts, and your network — always up to date."
    : "Share your stats and highlights with college coaches. One link — always up to date.";
  const cardTitle = isPro || isCollege ? "Performance Profile" : "Recruiting Profile";
  const cardBody  = isPro || isCollege
    ? "One public link showing your PRs, highlights, and career stats. See who's viewing."
    : "Share a public link with coaches. Track who's viewing your profile and from where. Your PRs, highlights, and achievements — all in one place.";

  return (
    <>
      <StepHeader step={4} title={title} subtitle={subtitle} />

      <div style={{ padding: "20px", background: C.raised, borderRadius: 14, border: `1px solid ${C.border}`,
        marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120,
          borderRadius: "50%", background: `radial-gradient(circle, ${C.green}15 0%, transparent 70%)`,
          pointerEvents: "none" }} />
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: `rgba(34,197,94,0.15)`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Target size={22} color="rgba(34,197,94,0.9)" strokeWidth={1.5} />
          </div>
          <div>
            <p style={{ fontFamily: C.cond, fontSize: 14, fontWeight: 900, color: C.white, marginBottom: 4 }}>
              {cardTitle}
            </p>
            <p style={{ fontFamily: C.font, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              {cardBody}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {["Live PR data", "Video highlights", isPro || isCollege ? "Network views" : "Coach views", "Share anywhere"].map(t => (
            <span key={t} style={{ fontFamily: C.font, fontSize: 11, color: C.green,
              padding: "3px 9px", borderRadius: 20,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              ✓ {t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ContinueBtn label="Set Up My Profile →" onClick={onSkipToProfile} />
        <SkipBtn label="Go to Dashboard" onClick={onFinish} />
      </div>
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function StepHeader({ step, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 900, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.accent, marginBottom: 8 }}>Step {step} of 4</p>
      <h2 style={{ fontFamily: C.cond, fontSize: 28, fontWeight: 900, fontStyle: "italic",
        color: C.white, lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 10 }}>
        {title}
      </h2>
      <p style={{ fontFamily: C.font, fontSize: 14, color: C.dim, lineHeight: 1.65 }}>{subtitle}</p>
    </div>
  );
}

function Label({ children }) {
  return (
    <p style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
      textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
      {children}
    </p>
  );
}

const SLIDE = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -30 },
  transition: { duration: 0.22, ease: "easeInOut" },
};

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [step,      setStep]      = useState(0);
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState("");

  const [data, setData] = useState({
    sport:     "",
    position:  "",
    level:     "",      // "highschool" | "college" | "pro"
    gradYear:  "",      // numeric year string for HS + college; empty for pro
    orgCode:   "",
    baselines: {},
  });

  const markDone = useCallback(async () => {
    try {
      await fetch("/api/athlete/onboarding-status", { method: "POST", credentials: "include" });
      localStorage.setItem("cp_onboarding_done", "1");
    } catch {}
  }, []);

  const finish = useCallback(async () => {
    await markDone();
    router.push("/dashboard");
  }, [markDone, router]);

  const goToProfile = useCallback(async () => {
    await markDone();
    router.push("/athlete/profile");
  }, [markDone, router]);

  // ── Step 0 → save sport/position/gradYear to profile ──────────────────────
  const handleStep0 = useCallback(async () => {
    try {
      await fetch("/api/athlete/profile", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action:          "update",
          sport:           data.sport,
          position:        data.position,
          level:           data.level || null,
          graduation_year: data.gradYear ? parseInt(data.gradYear) : null,
        }),
      });
    } catch {}
    setStep(1);
  }, [data]);

  // ── Step 1 → save baselines to Firestore (same path as journal) ─────────────
  const handleStep1 = useCallback(async () => {
    const entries = Object.entries(data.baselines).filter(([, v]) => v && Number(v) > 0);
    if (entries.length > 0) {
      const userId = user?.id || user?.athlete_id || user?.AthleteToken || "";
      if (userId) {
        try {
          await setDoc(
            doc(db, "baselines", String(userId)),
            { ...Object.fromEntries(entries.map(([k, v]) => [k, Number(v)])), updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } catch {}
      }
    }
    setStep(2);
  }, [data.baselines, user]);

  // ── Step 2 → join org via existing connectOrg API ─────────────────────────
  const handleStep2 = useCallback(async () => {
    if (!data.orgCode) return;
    setJoining(true); setJoinError("");
    try {
      const res  = await fetch("/api/athlete/connectOrg", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: data.orgCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJoinError(json.error || "Code not found. Ask your coach to double-check.");
        setJoining(false);
        return;
      }
    } catch {
      setJoinError("Something went wrong. You can join your team later.");
    } finally { setJoining(false); }
    setStep(3);
  }, [data.orgCode]);

  const steps = [
    <Step0Sport key={0} data={data} setData={setData} onNext={handleStep0} />,
    <Step1Baselines key={1} data={data} setData={setData} onNext={handleStep1} onSkip={() => setStep(2)} />,
    <Step2Team key={2} data={data} setData={setData} onNext={handleStep2} onSkip={() => setStep(3)}
      joining={joining} joinError={joinError} />,
    <Step3Recruiting key={3} level={data.level} onFinish={finish} onSkipToProfile={goToProfile} />,
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 20px 80px", fontFamily: C.font }}>

      {/* Ambient glow */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 45% at 50% 10%, rgba(79,171,255,0.06) 0%, transparent 70%)" }} />

      <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent,
              boxShadow: `0 0 10px ${C.accent}99`, display: "inline-block" }} />
            <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 900,
              letterSpacing: "0.14em", color: C.dim }}>CHECKPEAK</span>
          </div>
          {step === 0 && (
            <p style={{ fontFamily: C.font, fontSize: 14, color: C.muted, marginTop: 6 }}>
              {user?.name ? `Welcome, ${String(user.name).split(" ")[0]}` : "Welcome"}! Let's get you set up.
            </p>
          )}
        </div>

        <ProgressDots step={step} total={4} />

        {/* Card */}
        <div style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
          padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.45)", overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} {...SLIDE}>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.muted }}>
          You can change all of this later in your profile.
        </p>
      </div>
    </div>
  );
}
