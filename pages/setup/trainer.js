// pages/setup/trainer.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Lock, Sparkles } from "lucide-react";

/**
 * ✅ IMPORTANT:
 * This page must NOT be statically prerendered.
 * getServerSideProps forces SSR and avoids Vercel prerender failures.
 */
export async function getServerSideProps(ctx) {
  const { query, res } = ctx || {};
  const tokenRaw = query?.token;

  // Prevent caching
  try {
    res?.setHeader?.(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res?.setHeader?.("Pragma", "no-cache");
    res?.setHeader?.("Expires", "0");
  } catch {
    // ignore
  }

  const token = Array.isArray(tokenRaw)
    ? String(tokenRaw[0] || "").trim()
    : String(tokenRaw || "").trim();

  // Optional UX context (safe if absent)
  const emailRaw = query?.email;
  const orgRaw = query?.org;
  const roleRaw = query?.role;
  const inviterRaw = query?.inviter;
  const expiresRaw = query?.expiresAt;

  const email = Array.isArray(emailRaw) ? String(emailRaw[0] || "") : String(emailRaw || "");
  const orgName = Array.isArray(orgRaw) ? String(orgRaw[0] || "") : String(orgRaw || "");
  const role = Array.isArray(roleRaw) ? String(roleRaw[0] || "") : String(roleRaw || "");
  const inviterName = Array.isArray(inviterRaw) ? String(inviterRaw[0] || "") : String(inviterRaw || "");
  const expiresAt = Array.isArray(expiresRaw) ? String(expiresRaw[0] || "") : String(expiresRaw || "");

  return {
    props: {
      token: token || "",
      email: email || "",
      orgName: orgName || "",
      role: role || "",
      inviterName: inviterName || "",
      expiresAt: expiresAt || "",
    },
  };
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function roleLabel(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "Head Trainer (Admin)";
  if (r === "trainer") return "Trainer";
  return r ? r : "Staff";
}

export default function TrainerSetupPage({
  token = "",
  email = "",
  orgName = "",
  role = "",
  inviterName = "",
  expiresAt = "",
}) {
  const router = useRouter();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [busy, setBusy] = useState(false);

  // Top-level banners
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Inline field errors (better UX)
  const [pw1Err, setPw1Err] = useState("");
  const [pw2Err, setPw2Err] = useState("");

  // Success redirect UX
  const [redirectIn, setRedirectIn] = useState(0);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const tokenPresent = useMemo(() => Boolean(String(token || "").trim()), [token]);

  const isMinLenOk = useMemo(() => (pw1?.length || 0) >= 8, [pw1]);
  const isMatchOk = useMemo(() => pw1 && pw2 && pw1 === pw2, [pw1, pw2]);

  const canSubmit = useMemo(() => {
    if (!tokenPresent) return false;
    if (busy) return false;
    if (!isMinLenOk) return false;
    if (!isMatchOk) return false;
    return true;
  }, [tokenPresent, busy, isMinLenOk, isMatchOk]);

  // ✅ If email is provided (optional), prefill login modal email later
  useEffect(() => {
    if (!email) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cp_prefill_login_email", String(email || ""));
      }
    } catch {}
  }, [email]);

  // Success redirect countdown
  useEffect(() => {
    if (!redirectIn) return;
    const t = setInterval(() => {
      setRedirectIn((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [redirectIn]);

  useEffect(() => {
    if (redirectIn === 0) return;
    // When it hits 0 (from interval), redirect
    // We handle redirect after setting redirectIn, see onSubmit success.
  }, [redirectIn]);

  const validateInline = () => {
    let ok = true;

    setPw1Err("");
    setPw2Err("");

    if (!pw1 || pw1.length < 8) {
      setPw1Err("Password must be at least 8 characters.");
      ok = false;
    }

    if (!pw2) {
      setPw2Err("Please confirm your password.");
      ok = false;
    } else if (pw1 !== pw2) {
      setPw2Err("Passwords do not match.");
      ok = false;
    }

    return ok;
  };

  const goToLogin = () => {
    // Your site uses NavBarLoginModal on "/" (from your current flow)
    router.push("/");
  };

  const onSubmit = async () => {
    setErr("");
    setOk("");
    setPw1Err("");
    setPw2Err("");

    if (!tokenPresent) {
      setErr("Missing token. Please open this page from your invite link.");
      return;
    }

    if (!validateInline()) return;

    setBusy(true);
    try {
      const res = await fetch("/api/org/members/finishSetup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inviteToken: token,
          password: pw1,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to set password.");

      const msg =
        data?.message ||
        "Password set! Your account is now active. Redirecting to login…";

      setOk(msg);

      // UX: countdown + button
      setRedirectIn(3);

      setTimeout(() => {
        goToLogin();
      }, 1200);
    } catch (e) {
      setErr(e?.message || "Failed to set password.");
    } finally {
      setBusy(false);
    }
  };

  const contextTitle = useMemo(() => {
    const org = String(orgName || "").trim();
    const inv = String(inviterName || "").trim();
    const r = roleLabel(role);

    if (!org && !inv && !role) return "Finish trainer setup";
    return "Finish setup";
  }, [orgName, inviterName, role]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <h1 className="text-2xl font-extrabold">{contextTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Set your password to activate your access.
          </p>

          {/* Context (optional) */}
          {(orgName || inviterName || role || email || expiresAt) ? (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-1">
              {orgName ? (
                <p className="text-sm text-gray-900">
                  <span className="text-gray-500 text-xs">Organization</span>
                  <br />
                  <span className="font-extrabold">{orgName}</span>
                </p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {role ? (
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm font-semibold text-gray-900">{roleLabel(role)}</p>
                  </div>
                ) : null}

                {inviterName ? (
                  <div>
                    <p className="text-xs text-gray-500">Invited by</p>
                    <p className="text-sm font-semibold text-gray-900">{inviterName}</p>
                  </div>
                ) : null}

                {email ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Account email</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{email}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      We’ll prefill this on the login screen.
                    </p>
                  </div>
                ) : null}

                {expiresAt ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Link expiration</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{expiresAt}</p>
                  </div>
                ) : null}
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-gray-600">
                  <Lock size={11} style={{ display:"inline", verticalAlign:"middle", marginRight:4 }} /> This is a secure, one-time setup link.
                </p>
              </div>
            </div>
          ) : null}

          {!tokenPresent ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Missing setup token</p>
              <p className="text-[11px] text-amber-800 mt-1">
                Open this page using the invite link (it should include{" "}
                <span className="font-mono">?token=...</span>).
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Setup link verified</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Create a password to activate your staff access.
              </p>
            </div>
          )}

          {/* Top banners */}
          {err ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{err}</p>
            </div>
          ) : null}

          {ok ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><Sparkles size={15} /> You’re all set!</p>
              <p className="text-sm text-emerald-800">{ok}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-emerald-800">
                  {redirectIn ? `Redirecting to login in ${redirectIn}s…` : "Redirecting…"}
                </p>

                <button
                  type="button"
                  onClick={goToLogin}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-200 bg-white hover:bg-emerald-50"
                >
                  Go to login now
                </button>
              </div>
            </div>
          ) : null}

          {/* Form */}
          <div className="mt-6 space-y-4">
            {/* Requirements */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-extrabold text-gray-900">Password requirements</p>
              <div className="mt-2 space-y-1 text-[12px]">
                <div className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold border",
                      isMinLenOk
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    )}
                  >
                    ✓
                  </span>
                  <span className={isMinLenOk ? "text-gray-900" : "text-gray-600"}>
                    At least 8 characters
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold border",
                      isMatchOk
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    )}
                  >
                    ✓
                  </span>
                  <span className={isMatchOk ? "text-gray-900" : "text-gray-600"}>
                    Passwords match
                  </span>
                </div>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="text-xs text-gray-600 font-semibold">New password</label>
              <div className="relative mt-2">
                <input
                  className={classNames(
                    inputBase,
                    pw1Err ? "border-red-300 focus:ring-red-200" : ""
                  )}
                  type={show1 ? "text" : "password"}
                  value={pw1}
                  onChange={(e) => {
                    setPw1(e.target.value);
                    if (pw1Err) setPw1Err("");
                  }}
                  placeholder="At least 8 characters"
                  disabled={busy || !tokenPresent}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow1((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                  disabled={busy || !tokenPresent}
                >
                  {show1 ? "Hide" : "Show"}
                </button>
              </div>
              {pw1Err ? <p className="mt-2 text-[11px] text-red-600 font-semibold">{pw1Err}</p> : null}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-xs text-gray-600 font-semibold">Confirm password</label>
              <div className="relative mt-2">
                <input
                  className={classNames(
                    inputBase,
                    pw2Err ? "border-red-300 focus:ring-red-200" : ""
                  )}
                  type={show2 ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    if (pw2Err) setPw2Err("");
                  }}
                  placeholder="Re-enter password"
                  disabled={busy || !tokenPresent}
                  autoComplete="new-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) onSubmit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                  disabled={busy || !tokenPresent}
                >
                  {show2 ? "Hide" : "Show"}
                </button>
              </div>
              {pw2Err ? <p className="mt-2 text-[11px] text-red-600 font-semibold">{pw2Err}</p> : null}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goToLogin}
                className={classNames(
                  "inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50",
                  busy ? "opacity-60 cursor-not-allowed" : ""
                )}
                disabled={busy}
              >
                Back to login
              </button>

              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className={classNames(
                  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition",
                  "bg-[#46769B] text-white hover:brightness-110",
                  !canSubmit ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                {busy ? "Saving…" : "Finish setup"}
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              After setup, you’ll be redirected to login. If you run into issues, contact your organization admin.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
