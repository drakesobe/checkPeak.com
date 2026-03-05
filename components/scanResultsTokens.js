// components/scanResultsTokens.js
/**
 * Shared design tokens and font injection for OCRScanResults components.
 * Import from both ScanSummaryCard and SubstanceCard to keep them in sync.
 */

export const DS = {
  brand:        "#1E3A5F",
  brandLight:   "#5B9EC9",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
  safeBorder:   "#A8E6BC",
  caution:      "#E87722",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFE0A8",
  cautionText:  "#7A4A0A",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  ingredient:   "#6D3FBB",  // purple — distinct from banned/safe/caution
  ingredientBg: "#F5F0FD",
  ingredientBorder: "#D9C8F5",
  cardBg:       "#FFFFFF",
  pageBg:       "#F7F9FC",
  border:       "#E8ECF0",
  labelText:    "#6B7A8D",
  bodyText:     "#2D3748",
  dimText:      "#9BA8B4",
  hoverBg:      "#EDF1F7",
};

export const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
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