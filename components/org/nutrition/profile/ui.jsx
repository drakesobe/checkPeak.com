// components/org/nutrition/profile/ui.jsx
"use client";

const DS = {
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

export { DS };

/* ---------------- SummaryCard ---------------- */

export function SummaryCard({ title, value, sub, tone = "neutral", right }) {
  const accentColor =
    tone === "good" ? DS.safe
    : tone === "bad"  ? DS.banned
    : tone === "warn" ? DS.caution
    : DS.brand;

  const borderColor =
    tone === "good" ? DS.safeBorder
    : tone === "bad"  ? DS.bannedBorder
    : tone === "warn" ? DS.cautionBorder
    : DS.brandBorder;

  return (
    <div
      style={{
        backgroundColor: DS.cardBg,
        border: `1px solid ${borderColor}`,
        borderTop: `3px solid ${accentColor}`,
        position: "relative",
      }}
      className="p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>
            {title}
          </p>
          <p
            className="mt-2 text-2xl font-black tracking-tight leading-tight break-words tabular-nums"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: DS.bodyText }}
          >
            {value}
          </p>
          {sub ? (
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: DS.labelText }}>
              {sub}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0 flex items-start pt-0.5">{right}</div> : null}
      </div>
    </div>
  );
}

/* ---------------- StatusPill ---------------- */

export function StatusPill({ tone = "neutral", text }) {
  const style =
    tone === "good"
      ? { backgroundColor: DS.safeBg,    color: DS.safe,    border: `1px solid ${DS.safeBorder}`    }
    : tone === "warn"
      ? { backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }
    : tone === "bad"
      ? { backgroundColor: DS.bannedBg,  color: DS.banned,  border: `1px solid ${DS.bannedBorder}`  }
    : { backgroundColor: DS.brandBg,   color: DS.labelText, border: `1px solid ${DS.brandBorder}`  };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-bold whitespace-nowrap rounded-sm"
      style={style}
    >
      {text}
    </span>
  );
}

/* ---------------- Metric (progress bar) ---------------- */

export function Metric({ label, value }) {
  const v = (() => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  })();

  const barColor  = v >= 80 ? DS.safe    : v >= 60 ? DS.caution  : DS.banned;
  const trackBg   = v >= 80 ? DS.safeBg  : v >= 60 ? DS.cautionBg : DS.bannedBg;
  const borderCol = v >= 80 ? DS.safeBorder : v >= 60 ? DS.cautionBorder : DS.bannedBorder;

  return (
    <div
      className="p-3"
      style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold truncate" style={{ color: DS.labelText }}>{label}</p>
        <p className="text-xs font-black tabular-nums" style={{ color: DS.bodyText }}>{v}%</p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: trackBg, border: `1px solid ${borderCol}` }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${v}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

/* ---------------- EmptyState ---------------- */

export function EmptyState({ title, body, cta, onCta }) {
  return (
    <div
      className="p-5 mt-4"
      style={{ border: `1px solid ${DS.border}`, borderLeft: `4px solid ${DS.brand}`, backgroundColor: DS.brandBg }}
    >
      <p className="text-sm font-black" style={{ color: DS.bodyText }}>{title}</p>
      <p className="text-sm mt-1 leading-relaxed" style={{ color: DS.labelText }}>{body}</p>
      {cta && onCta ? (
        <button
          onClick={onCta}
          type="button"
          className="mt-3 inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-wide transition-all rounded-sm"
          style={{ backgroundColor: DS.brand, color: "#fff" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brand; }}
        >
          {cta}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- SkeletonProfile ---------------- */

export function SkeletonProfile() {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="p-5 animate-pulse" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
        <div className="h-4 w-40 rounded-sm" style={{ backgroundColor: DS.border }} />
        <div className="mt-3 h-3 w-72 rounded-sm" style={{ backgroundColor: DS.border }} />
        <div className="mt-4 h-24 w-full rounded-sm" style={{ backgroundColor: DS.border }} />
      </div>
      <div className="p-5 animate-pulse" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
        <div className="h-4 w-44 rounded-sm" style={{ backgroundColor: DS.border }} />
        <div className="mt-4 space-y-3">
          <div className="h-16 w-full rounded-sm" style={{ backgroundColor: DS.border }} />
          <div className="h-16 w-full rounded-sm" style={{ backgroundColor: DS.border }} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 animate-pulse" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
      <div className="h-3 w-28 rounded-sm" style={{ backgroundColor: DS.border }} />
      <div className="mt-2 h-8 w-24 rounded-sm" style={{ backgroundColor: DS.border }} />
      <div className="mt-3 h-3 w-44 rounded-sm" style={{ backgroundColor: DS.border }} />
    </div>
  );
}