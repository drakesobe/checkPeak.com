# Engineering guide

How CheckPeak is built, tested and shipped. Read this before changing auth, billing or data access.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local server at http://localhost:3000 |
| `npm test` | Run all tests once (about 2 seconds, no network) |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run test:coverage` | Tests plus the coverage floor on security and billing code |
| `npm run lint` | ESLint (errors fail CI, warnings don't) |
| `npm run check` | Lint + tests with coverage: what CI runs before the build |

CI (`.github/workflows/ci.yml`) runs lint, tests and a production build on every push and pull request.

## Where data lives

- **Supabase** holds all data: programs, athletes, workouts, billing, product catalog.
- **Firebase** is for messaging only (Firestore `conversations`).
- Airtable is retired. `scripts/sync-*-from-airtable.mjs` were one-time copy tools.
- Database changes go in `supabase/*.sql`, written so they are safe to run twice.

## Rules for API routes

1. **Identity comes from the signed session only.** Sessions are HMAC-signed (`lib/session.js`) and checked
   for every `/api/*` request in `middleware.js`. Use `requireUser`, `requireOrgSideUser`, `requireOrg` or
   `requireOwnOrgToken` from `lib/`. Never trust an email, id or team code sent in the request body or query.
2. **Team codes are not passwords.** Every athlete knows their team code. A requested team code must match the
   signed-in coach's own team (`requireOwnOrgToken`).
3. **An athlete's team code is not signed** (athletes switch teams in the app). For athletes, read their team
   from the `athletes` table using the signed `athlete_token`.
4. **Check ownership on every write.** Coaches may only change records that belong to their own program.

## Tests

- `tests/security`: session signing, middleware, who can see and change what
- `tests/billing`: billing store and the access gate
- `tests/roster`: CSV import, invite emails, claiming a pre-added account
- `tests/features`: ingredient search, nutrition plans, Today page, product catalog

Tests use an in-memory database (`tests/helpers/fakeSupabase.js`) and signed test sessions
(`tests/helpers/http.js`). Supabase, Resend and Firebase are never called. When you fix a security bug,
add a test that would have caught it.
