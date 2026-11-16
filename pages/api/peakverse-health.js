// Read-only connectivity check. No business event is persisted, no customer
// data is read, and no credential or signature ever appears in the response.
import { publishPeakverseEvent } from "../../lib/peakverseEvents.js";

let cachedUntil = 0;
let cachedOk = false;
let inFlight;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();
  if (Date.now() >= cachedUntil) {
    if (!inFlight) {
      inFlight = publishPeakverseEvent({kind:"bridge_check"}).then(result => {
        cachedOk = result.ok;
        cachedUntil = Date.now() + 60_000;
      }).finally(() => { inFlight = undefined; });
    }
    await inFlight;
  }
  return res.status(cachedOk ? 200 : 503).json({connected: cachedOk});
}
