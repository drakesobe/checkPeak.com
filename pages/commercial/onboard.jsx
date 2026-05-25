// pages/commercial/onboard.jsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";

const SPECIALTIES = [
  "Personal Trainer",
  "Strength & Conditioning Coach",
  "Physical Therapist",
  "Massage Therapist",
  "Sports Nutritionist",
  "Online Coach",
  "Other",
];

const DS = {
  brand: "#0066FF", brandBg: "#EBF2FF", brandBorder: "#B3CFFF",
  border: "#E2E2E2", surface: "#F7F7F5", pageBg: "#F2F2EF",
  text: "#1A1A1A", dim: "#6B6B6B", error: "#C0392B",
};

export default function CommercialOnboard() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const [step, setStep]           = useState(1);
  const [name, setName]           = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio]             = useState("");
  const [basicPrice, setBasicPrice]     = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [ultraPrice, setUltraPrice]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  // Redirect if not logged in, or if already has a trainer profile
  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push("/login"); return; }

    fetch("/api/commercial/trainer", { credentials: "include" })
      .then(r => { if (r.ok) router.push("/commercial/dashboard"); })
      .catch(() => {});
  }, [user, authReady, router]);

  async function handleFinish() {
    if (!basicPrice || !premiumPrice || !ultraPrice)
      return setError("Set a price for each tier.");

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/commercial/trainer", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({ name, specialty, bio, basicPrice, premiumPrice, ultraPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/commercial/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSaving(false);
    }
  }

  if (!authReady || !user) return null;

  return (
    <>
      <Head><title>Set up your trainer profile — CheckPeak</title></Head>
      <div style={{ minHeight: "100vh", backgroundColor: DS.pageBg, fontFamily: "'DM Sans', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
        <div style={{ width: "100%", maxWidth: 520 }}>

          <p style={{ textAlign: "center", fontWeight: 800, fontSize: 20,
            letterSpacing: "-0.02em", color: DS.brand, marginBottom: 32 }}>
            CheckPeak Commercial
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
            {[1, 2].map(s => (
              <div key={s} style={{ height: 4, width: 48, borderRadius: 99,
                background: s <= step ? DS.brand : DS.border, transition: "background 0.2s" }} />
            ))}
          </div>

          <div style={{ background: "#fff", border: `1px solid ${DS.border}`, borderRadius: 16, padding: "32px 28px" }}>

            {step === 1 && (
              <>
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create your profile</h1>
                <p style={{ fontSize: 14, color: DS.dim, marginBottom: 28 }}>
                  This is what clients see when they find you.
                </p>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Your name</label>
                  <input style={S.input} value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Marcus Johnson" />
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Specialty</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {SPECIALTIES.map(sp => (
                      <button key={sp} type="button"
                        onClick={() => setSpecialty(sp)}
                        style={{ ...S.pill, ...(specialty === sp ? S.pillActive : {}) }}>
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Bio <span style={{ fontWeight: 400, color: DS.dim }}>(optional)</span></label>
                  <textarea style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                    value={bio} onChange={e => setBio(e.target.value)}
                    placeholder="Tell clients about your background and approach." />
                </div>

                <button style={{ ...S.btn, opacity: (!name || !specialty) ? 0.5 : 1 }}
                  disabled={!name || !specialty}
                  onClick={() => setStep(2)}>
                  Continue →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Set your pricing</h1>
                <p style={{ fontSize: 14, color: DS.dim, marginBottom: 28 }}>
                  You keep 100% of what clients pay. CheckPeak charges you a flat platform fee.
                </p>

                {[
                  { label: "Basic",   desc: "Video library access",                     val: basicPrice,   set: setBasicPrice   },
                  { label: "Premium", desc: "Library + custom workouts from you",        val: premiumPrice, set: setPremiumPrice },
                  { label: "Ultra",   desc: "Library + workouts + in-person sessions",   val: ultraPrice,   set: setUltraPrice   },
                ].map(({ label, desc, val, set }) => (
                  <div key={label} style={{ ...S.fieldGroup, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <label style={S.label}>{label}</label>
                      <span style={{ fontSize: 12, color: DS.dim }}>{desc}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: DS.dim }}>$</span>
                      <input style={{ ...S.input, flex: 1 }} type="number" min="0"
                        value={val} onChange={e => set(e.target.value)} placeholder="e.g. 29" />
                      <span style={{ fontSize: 13, color: DS.dim }}>/mo</span>
                    </div>
                  </div>
                ))}

                <div style={{ padding: "12px 16px", background: DS.brandBg,
                  border: `1px solid ${DS.brandBorder}`, borderRadius: 8,
                  fontSize: 13, color: "#0044AA", marginBottom: 24 }}>
                  💡 Typical pricing: Basic $19–29, Premium $39–59, Ultra $79–149/mo.
                </div>

                {error && <div style={S.errorBox}>{error}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btn, background: DS.surface, color: DS.text,
                    border: `1px solid ${DS.border}`, flex: "0 0 auto", padding: "12px 20px" }}
                    onClick={() => setStep(1)}>← Back</button>
                  <button style={{ ...S.btn, flex: 1, opacity: saving ? 0.6 : 1 }}
                    disabled={saving} onClick={handleFinish}>
                    {saving ? "Creating profile…" : "Launch my profile →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const S = {
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 },
  label:  { fontSize: 13, fontWeight: 700, color: DS.text },
  input:  { padding: "10px 12px", border: `1px solid ${DS.border}`, borderRadius: 8,
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: DS.text,
    outline: "none", width: "100%", boxSizing: "border-box" },
  pill:   { padding: "9px 12px", border: `1px solid ${DS.border}`, borderRadius: 8,
    background: DS.surface, fontSize: 13, fontWeight: 500, color: DS.dim,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "left" },
  pillActive: { background: DS.brandBg, border: `1px solid ${DS.brand}`, color: DS.brand, fontWeight: 700 },
  btn:    { width: "100%", padding: "13px", background: DS.brand, color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  errorBox: { padding: "10px 14px", background: "#FDECEA", border: "1px solid #C0392B",
    borderRadius: 8, fontSize: 13, color: "#C0392B", marginBottom: 16 },
};