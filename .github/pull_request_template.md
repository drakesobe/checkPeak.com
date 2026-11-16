## What changed and why

## How it was tested
- [ ] `npm run check` passes (lint + tests with coverage)
- [ ] Tried it in the browser / app (screens or steps below)

## Safety checklist
- [ ] Identity comes from the signed session only, never from emails, ids or team codes in the request
- [ ] Coach routes check the record belongs to the coach's own program
- [ ] New data is stored in Supabase (Firebase is for messaging only)
- [ ] Database changes include a SQL file in `supabase/` and are safe to run twice
- [ ] Tests added for new access rules, billing or anything that sends email
