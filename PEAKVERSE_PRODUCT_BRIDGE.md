# CheckPeak → PEAKVERSE business events

Disabled by default. Configure the same fresh 32+ character random `PEAKVERSE_PRODUCT_SECRET` in the CheckPeak server-only host environment and the Render `peakverse-founder` web service (not the cron), never in source, browser code, or chat. No change to Stripe API keys, pricing, subscription settings, or customer data collection.

The authenticated receiver accepts timestamped, HMAC-signed minimal business receipts. Organization references use a keyed hash, never the real organization token. Public forms do not make paid claims. Only verified live Stripe webhook events can report subscription state or positive invoice receipts; invoice IDs deduplicate the `invoice.paid` and `invoice.payment_succeeded` cases.

Test first with synthetic signed events against a separately configured staging receiver; then configure production secrets and verify an actual walkthrough or signup is visible in Founder Desk. Do not create a real charge for testing. Stripe receipts retry through the existing webhook if the configured receiver is unavailable; signup/walkthrough forwarding is bounded and best-effort, so an audited durable outbox and historical reconciliation are required before claiming complete coverage. Receipts are not MRR, net revenue, retained customers or campaign attribution. School names from forms are hints, not verified sales causation. Do not rotate the shared key without planning a reference migration.

The workout-create endpoint also reports one first *observed* assignment receipt per organization, after a successful nonempty workout creation. A warm-instance cache and receiver deduplication avoid repeat receipts; no athlete identifiers, workout contents, or private training completion data leave CheckPeak. No outbound sales message is triggered by a product event.

## Connection verification and lifecycle

From a trusted server environment with the configured secret, call `publishPeakverseEvent({kind:"bridge_check"})`. The authenticated receiver responds successfully without inserting an event or unlocking a milestone. Do not use fake customer registrations, invoices, or Stripe test events against the production ledger. Lifecycle dashboard distinguishes observed latest active subscription plus payment evidence from historical ever-paid organizations. Past-due, unpaid, paused, and incomplete states are risk observations, not cancellations. Historical coverage and completeness must be reconciled separately. No paid customer outreach is automated.
