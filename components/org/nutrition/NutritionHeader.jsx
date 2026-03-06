// components/org/nutrition/NutritionHeader.jsx
"use client";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  banned:      "#C8102E",
  bannedBg:    "#FFF0F0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  border:      "#E8ECF0",
  cardBg:      "#FFFFFF",
  bodyText:    "#2D3748",
  labelText:   "#6B7A8D",
  dimText:     "#9BA8B4",
};

function fmtWeekRange(weekStartISO) {
  if (!weekStartISO) return "This week";
  try {
    const start = new Date(String(weekStartISO).slice(0, 10) + "T12:00:00Z");
    if (Number.isNaN(start.getTime())) return "This week";
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `Week of ${fmt(start)} – ${fmt(end)}`;
  } catch { return "This week"; }
}

function StatusPill({ loading, error, lastUpdatedLabel }) {
  if (error) return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-sm"
      style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFC8C8", color: DS.banned }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DS.banned }} />
      Error
    </span>
  );

  if (loading) return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-sm"
      style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: DS.brand }} />
      Loading
    </span>
  );

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-sm"
      style={{ backgroundColor: DS.safeBg, border: "1px solid #A8DFB8", color: DS.safe }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DS.safe }} />
      Live
      {lastUpdatedLabel && (
        <span style={{ color: "#1A5C33", opacity: 0.7 }}>· {lastUpdatedLabel}</span>
      )}
    </span>
  );
}

function NavButton({ children, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
      style={primary
        ? { backgroundColor: DS.brand, color: "#fff" }
        : { backgroundColor: DS.cardBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }
      }
      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
    >
      {children}
    </button>
  );
}

export default function NutritionHeader({
  weekStartISO, lastUpdatedLabel, loading, error,
  onGoDashboard, onGoPlans, onRefresh,
}) {
  return (
    <section style={{ backgroundColor: DS.brand }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          {/* Left */}
          <div className="min-w-0">
            <span
              className="text-xs font-black uppercase tracking-wider mb-2 inline-block"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              CheckPeak · Org
            </span>

            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1
                className="font-black uppercase leading-none"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "clamp(1.5rem, 4vw, 2rem)",
                  color: "#fff",
                  letterSpacing: "0.02em",
                }}
              >
                Nutrition Accountability
              </h1>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-sm"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)" }}
              >
                {fmtWeekRange(weekStartISO)}
              </span>
              <StatusPill loading={loading} error={error} lastUpdatedLabel={lastUpdatedLabel} />
            </div>

            <p className="text-sm max-w-2xl" style={{ color: "rgba(255,255,255,0.6)" }}>
              Monitor athlete nutrition check-ins, plan adherence, and SmartStack recommendations.
            </p>

            {error && (
              <div
                className="mt-3 px-3 py-2 text-xs"
                style={{ backgroundColor: "rgba(200,16,46,0.15)", borderLeft: `3px solid ${DS.banned}`, color: "#FFAAAA" }}
              >
                <span className="font-bold">Queue error:</span> {error}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-4">
              {[
                "Token-first navigation (AthleteToken)",
                "Plans require Status = Active",
                "Check-ins matched by WeekStartISO",
              ].map((note) => (
                <span key={note} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.3)" }} />
                  {note}
                </span>
              ))}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
            <NavButton onClick={onGoDashboard}>Dashboard</NavButton>
            <NavButton onClick={onGoPlans}>Plans</NavButton>
            <NavButton onClick={onRefresh} primary>
              {loading ? "Refreshing…" : "Refresh"}
            </NavButton>
          </div>
        </div>
      </div>
    </section>
  );
}