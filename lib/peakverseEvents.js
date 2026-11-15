// Server-side only. Separate secret from Stripe, auth, and database credentials.
import { createHmac } from "node:crypto";

const ENDPOINT = "https://peakverse-founder.onrender.com/api/product/events";

export function organizationReference(token) {
  const secret = process.env.PEAKVERSE_PRODUCT_SECRET;
  if (!secret || secret.length < 32 || !token) return "";
  return createHmac("sha256", secret).update("org:" + String(token).trim().toUpperCase()).digest("hex");
}

export async function publishPeakverseEvent(event) {
  const secret = process.env.PEAKVERSE_PRODUCT_SECRET;
  if (!secret || secret.length < 32) return { configured: false, ok: false };
  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(2500),
      headers: { "Content-Type": "application/json", "X-Peakverse-Product-Timestamp": timestamp,
        "X-Peakverse-Product-Signature": signature }, body,
    });
    if (!response.ok) console.warn("[peakverse-events] delivery failed", response.status);
    return { configured: true, ok: response.ok };
  } catch {
    console.warn("[peakverse-events] delivery unavailable");
    return { configured: true, ok: false };
  }
}
