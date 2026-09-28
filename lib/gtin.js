// lib/gtin.js
// Retail barcode (UPC / EAN / GTIN) validation and normalization. Shared by browser and server.

export const digitsOnly = (s) => String(s ?? "").replace(/\D/g, "");

// Mod-10 check digit for any GTIN body (weights 3,1,3,1... from the right).
export function gtinCheckDigit(body) {
  const d = digitsOnly(body);
  if (!d) return null;
  let sum = 0;
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w;
  return (10 - (sum % 10)) % 10;
}

const hasValidCheckDigit = (d) => gtinCheckDigit(d.slice(0, -1)) === Number(d.slice(-1));

// UPC-E (8 digits, zero-suppressed) -> UPC-A (12 digits). Returns null if not expandable.
export function upcEToUpcA(raw) {
  const s = digitsOnly(raw);
  if (!/^\d{6,8}$/.test(s)) return null;
  const numberSystem = s.length === 8 ? s[0] : "0";
  const p = s.length === 8 ? s.slice(1, 7) : s.slice(0, 6);
  const [d0, d1, d2, d3, d4, d5] = p;
  let base;
  if ("012".includes(d5)) base = `${numberSystem}${d0}${d1}${d5}0000${d2}${d3}${d4}`;
  else if (d5 === "3")    base = `${numberSystem}${d0}${d1}${d2}00000${d3}${d4}`;
  else if (d5 === "4")    base = `${numberSystem}${d0}${d1}${d2}${d3}00000${d4}`;
  else                    base = `${numberSystem}${d0}${d1}${d2}${d3}${d4}0000${d5}`;
  return base + gtinCheckDigit(base);
}

// Canonical digits for a valid retail barcode, or null if the digits aren't a valid barcode.
// UPC-A stays 12 digits (EAN-13 with a leading 0 is the same product); UPC-E expands to UPC-A.
export function canonicalGtin(raw) {
  let d = digitsOnly(raw);
  if (d.length === 14 && d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("0")) d = d.slice(1);

  if (d.length === 8) {
    if (hasValidCheckDigit(d)) return d;                 // EAN-8
    const upcA = upcEToUpcA(d);                          // UPC-E carries the UPC-A check digit
    if (upcA && upcA.slice(-1) === d.slice(-1)) return upcA;
    return null;
  }
  if ([12, 13, 14].includes(d.length) && hasValidCheckDigit(d)) return d;
  return null;
}
