// components/scanResultsTokens.js
/**
 * Shared design tokens and font injection for OCRScanResults components.
 * Import from both ScanSummaryCard and SubstanceCard to keep them in sync.
 */

// components/scanResultsTokens.js

export const DS = {
  brand:        "#4FABFF",
  brandLight:   "#4FABFF",
  brandBg:      "rgba(79,171,255,0.07)",
  brandBorder:  "rgba(79,171,255,0.18)",
  safe:         "#059669",
  safeBg:       "#ECFDF5",
  safeBorder:   "#A7F3D0",
  caution:      "#B45309",
  cautionBg:    "#FFFBEB",
  cautionBorder:"#FDE68A",
  cautionText:  "#92400E",
  banned:       "#DC2626",
  bannedBg:     "#FEF2F2",
  bannedBorder: "#FECACA",
  ingredient:   "#4FABFF",   // matches accent — distinct enough from banned/safe
  ingredientBg: "rgba(79,171,255,0.07)",
  ingredientBorder: "rgba(79,171,255,0.18)",
  cardBg:       "#FFFFFF",
  pageBg:       "#F4F7FB",
  border:       "#E2E8F0",
  labelText:    "#64748B",
  bodyText:     "#0D1B2A",
  dimText:      "#94A3B8",
  hoverBg:      "#F1F5F9",
};

export const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600;700&display=swap');
  .sr-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.03em; }
  .sr-body    { font-family: 'Barlow', sans-serif; }
`;

// ---------------------------------------------------------------------------
// Ban type config — module-level constant, never recreated
// ---------------------------------------------------------------------------

export const BAN_TYPE_CONFIG = [
  {
    label:    "Prohibited",
    color:    DS.banned,
    bg:       DS.bannedBg,
    border:   DS.bannedBorder,
    priority: 3,
  },
  {
    label:    "Limited to Out of Competition",
    color:    DS.caution,
    bg:       DS.cautionBg,
    border:   DS.cautionBorder,
    priority: 2,
  },
  {
    label:    "Particular Sports",
    color:    DS.brand,
    bg:       DS.brandBg,
    border:   DS.brandBorder,
    priority: 1,
  },
];

export const BAN_COLOR_MAP = Object.fromEntries(
  BAN_TYPE_CONFIG.map((b) => [b.label, b.color])
);

export const INGREDIENT_COLOR = DS.ingredient;