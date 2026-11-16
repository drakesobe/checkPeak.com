// tests/setup.js
// Deterministic environment for every test file. Real keys are never needed or loaded.
process.env.SESSION_SECRET = "test-session-secret-not-for-production";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
delete process.env.RESEND_API_KEY; // email tests opt in explicitly
