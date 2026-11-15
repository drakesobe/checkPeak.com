# CheckPeak → PEAKVERSE business events

Disabled by default. Configure the same fresh 32+ character random `PEAKVERSE_PRODUCT_SECRET` in the CheckPeak server-only host environment and the Render `peakverse-founder` web service (not the cron), never in source, browser code, or chat. No change to Stripe API keys, pricing, subscription settings, or customer data collection.

The authenticated receiver accepts timestamped, HMAC-signed minimal business receipts. Organization references use a keyed hash, never the real organization token. Public forms do not make paid claims. Only verified live Stripe webhook events can report subscription state or positive invoice receipts; invoice IDs deduplicate the `invoice.paid` and `invoice.payment_succeeded` cases.

Test first with synthetic signed events against a separately configured staging receiver; then configure production secrets and verify an actual walkthrough or signup is visible in Founder Desk. Do not create a real charge for testing. Stripe receipts retry through the existing webhook if the configured receiver is unavailable; signup/walkthrough forwarding is bounded and best-effort, so an audited durable outbox and historical reconciliation are required before claiming complete coverage. Receipts are not MRR, net revenue, retained customers or campaign attribution. School names from forms are hints, not verified sales causation. Do not rotate the shared key without planning a reference migration.

No athlete records or personal contact details are sent. No outbound sales message is triggered by a product event.
