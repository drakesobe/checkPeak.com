// components/org/prescriptions/SupplementPicker.jsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

/* ── Shared supplement category definitions ──────────────────────────────────── */
export const SUPP_CATEGORIES = [
  { label: "Pre-Workout",    strKey: "preWorkoutRecommendation",  productKey: "preWorkoutProduct",  match: (c) => /pre.?workout/i.test(c)    },
  { label: "Protein Powder", strKey: "proteinRecommendation",    productKey: "proteinProduct",     match: (c) => /protein.?powder/i.test(c) },
  { label: "Creatine",       strKey: "creatineRecommendation",   productKey: "creatineProduct",    match: (c) => /creatine/i.test(c)        },
  { label: "Protein Bars",   strKey: "proteinBarRecommendation", productKey: "proteinBarProduct",  match: (c) => /protein.?bar/i.test(c)    },
  { label: "BCAAs / EAAs",   strKey: "bcaaRecommendation",       productKey: "bcaaProduct",        match: (c) => /bcaa|eaa/i.test(c)        },
];

/* ── Spinner ─────────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: DS.brand }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SupplementPicker
   Props:
     catDef     — one entry from SUPP_CATEGORIES
     products   — SmartStack records filtered to this category
     structured — current plan state object
     onChange   — (key, value) => void
══════════════════════════════════════════════════════════════════════════════ */
export default function SupplementPicker({ catDef, products, structured, onChange, onScanResult }) {
  const [open,      setOpen]      = useState(false);
  const [scanState, setScanState] = useState(null); // null | "loading" | { status, summary, flags }
  const ref                       = useRef(null);
  const selectedProduct           = structured[catDef.productKey] ?? null;

  // Reset scan badge when a different product is chosen
  useEffect(() => {
    setScanState(null);
    onScanResult?.(catDef.productKey, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback((product) => {
    if (product === null) {
      onChange(catDef.productKey, null);
      onChange(catDef.strKey, "");
    } else {
      onChange(catDef.productKey, {
        id:              product.id,
        name:            product.name,
        affiliateLink:   product.affiliateLink   || "",
        imageUrl:        product.imageUrl        || "",
        category:        product.category        || "",
        pricePerServing: product.pricePerServing ?? null,
        Price:           product.Price           ?? null,
        nutritionLabel:  product.nutritionLabel  || "",
      });
      onChange(catDef.strKey, product.name);
    }
    setOpen(false);
  }, [catDef, onChange]);

  async function runScan() {
    if (!selectedProduct) return;
    setScanState("loading");
    try {
      const resp = await fetch("/api/org/nutrition/supplement-scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          productName:       selectedProduct.name,
          category:          selectedProduct.category || catDef.label,
          nutritionLabelUrl: selectedProduct.nutritionLabel || "",
        }),
      });
      const data = await resp.json().catch(() => ({}));
      const result = data?.status ? data : { status: "caution", summary: "Could not complete scan — review label manually.", flags: [] };
      setScanState(result);
      onScanResult?.(catDef.productKey, result);
    } catch {
      const result = { status: "caution", summary: "Scan unavailable — review label manually.", flags: [] };
      setScanState(result);
      onScanResult?.(catDef.productKey, result);
    }
  }

  const pps = selectedProduct?.pricePerServing;
  const priceLabel = pps != null
    ? `$${Number(pps).toFixed(2)} / serving`
    : selectedProduct?.Price != null
      ? `$${Number(selectedProduct.Price).toFixed(2)}`
      : null;

  /* scan result colours */
  const scanBadge = scanState && scanState !== "loading" ? (() => {
    const s = scanState.status;
    if (s === "flagged") return { color: DS.banned,  bg: DS.bannedBg,  border: DS.bannedBorder,  icon: "⛔" };
    if (s === "clear")   return { color: DS.safe,    bg: DS.safeBg,    border: DS.safeBorder,    icon: "✓"  };
    return                      { color: DS.caution, bg: DS.cautionBg, border: DS.cautionBorder, icon: "⚠"  };
  })() : null;

  if (products.length === 0) {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: DS.labelText }}>{catDef.label}</p>
        <p className="text-xs py-2" style={{ color: DS.dimText }}>No {catDef.label} products in SmartStack yet.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: DS.labelText }}>{catDef.label}</p>

      {/* ── Dropdown trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-sm transition-all"
        style={{
          border:          `1px solid ${open ? DS.brand : selectedProduct ? DS.brand : DS.brandBorder}`,
          backgroundColor: selectedProduct ? DS.brandBg : DS.cardBg,
          boxShadow:       open ? `0 0 0 2px ${DS.brand}18` : "none",
        }}
      >
        <div className="shrink-0 overflow-hidden rounded-sm" style={{ width: 36, height: 36, backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          {selectedProduct?.imageUrl
            ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center text-sm">💊</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          {selectedProduct ? (
            <>
              <p className="text-sm font-bold truncate" style={{ color: DS.brand }}>{selectedProduct.name}</p>
              {selectedProduct.nutritionLabel
                ? priceLabel && <p className="text-xs tabular-nums" style={{ color: DS.labelText }}>{priceLabel}</p>
                : <p className="text-xs" style={{ color: DS.caution }}>⚠ No nutrition label — add in SmartStack to enable scan</p>
              }
            </>
          ) : (
            <p className="text-sm" style={{ color: DS.dimText }}>- No recommendation -</p>
          )}
        </div>
        <svg viewBox="0 0 24 24" className="shrink-0 w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ color: DS.dimText, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown list ── */}
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-y-auto rounded-sm"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.brand}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 280 }}>

          {/* Clear selection */}
          <button type="button" onClick={() => handleSelect(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
            style={{ borderBottom: `1px solid ${DS.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <div className="shrink-0 rounded-sm flex items-center justify-center"
              style={{ width: 36, height: 36, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: DS.dimText }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: DS.dimText }}>- No recommendation -</p>
          </button>

          {products.map((p) => {
            const isSelected = selectedProduct?.id === p.id;
            const pLabel = p.pricePerServing != null
              ? `$${Number(p.pricePerServing).toFixed(2)} / serving`
              : p.Price != null ? `$${Number(p.Price).toFixed(2)}` : null;
            return (
              <button key={p.id} type="button" onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{ backgroundColor: isSelected ? DS.brandBg : "transparent", borderBottom: `1px solid ${DS.border}` }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = DS.pageBg; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div className="shrink-0 overflow-hidden rounded-sm"
                  style={{ width: 36, height: 36, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center text-sm">💊</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isSelected ? DS.brand : DS.bodyText }}>{p.name}</p>
                  {pLabel && <p className="text-xs tabular-nums" style={{ color: DS.dimText }}>{pLabel}</p>}
                </div>
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="shrink-0 w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: DS.brand }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Scan bar (replaces "View on Amazon") ── */}
      {selectedProduct && (
        <div className="mt-2">
          {!scanState ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-sm"
              style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
              <p className="text-xs" style={{ color: DS.labelText }}>Athlete will see this product with your link.</p>
              <button type="button" onClick={runScan}
                className="shrink-0 text-xs font-black uppercase tracking-wide ml-3 transition-opacity hover:opacity-70"
                style={{ color: DS.brand }}>
                Scan Banned Substances
              </button>
            </div>
          ) : scanState === "loading" ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
              style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
              <Spinner />
              <p className="text-xs" style={{ color: DS.labelText }}>
                {selectedProduct.nutritionLabel
                  ? "Reading nutrition label and scanning…"
                  : "Scanning against banned substance database…"}
              </p>
            </div>
          ) : scanBadge ? (
            <div className="px-3 py-2 rounded-sm" style={{ backgroundColor: scanBadge.bg, border: `1px solid ${scanBadge.border}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: scanBadge.color }}>
                    {scanBadge.icon} {scanState.summary}
                  </p>
                  {Array.isArray(scanState.flags) && scanState.flags.length > 0 && (
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {scanState.flags.map((f, i) => (
                        <li key={i} className="text-xs" style={{ color: scanBadge.color }}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {selectedProduct.nutritionLabel && (
                      <a href={selectedProduct.nutritionLabel} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold" style={{ color: DS.brand }}>
                        View Nutrition Label ↗
                      </a>
                    )}
                    <button type="button" onClick={runScan}
                      className="text-xs" style={{ color: DS.dimText }}>
                      Re-scan
                    </button>
                  </div>
                  {(scanState.source === "no-label" || scanState.source === "name") && (
                    <p className="text-xs mt-1" style={{ color: DS.dimText }}>
                      Add a Nutrition Label URL to this product in SmartStack to enable full ingredient scanning.
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => { setScanState(null); onScanResult?.(catDef.productKey, null); }}
                  className="shrink-0 text-xs" style={{ color: DS.dimText }}>✕</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
