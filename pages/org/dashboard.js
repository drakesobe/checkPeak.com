// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Copy,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Search,
  Link as LinkIcon,
  Mail,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;

  // If Airtable stores CreatedAt as "MM/DD/YYYY HH:mm" sometimes Date() can fail in some locales.
  // Try a basic fallback parse:
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = Number(m[4] || 0);
    const min = Number(m[5] || 0);
    const d2 = new Date(yyyy, mm - 1, dd, hh, min, 0);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* UI bits                                                                    */
/* -------------------------------------------------------------------------- */

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
          {sub ? <p className="text-[11px] text-gray-500 mt-2">{sub}</p> : null}
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#46769B]" />
        </div>
      </div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false, className = "" }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames(base, styles, disabled ? "opacity-70 cursor-not-allowed" : "", className)}
      type="button"
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button variant="secondary" onClick={onCopy} disabled={!text}>
      <Copy className="w-4 h-4" />
      {copied ? "Copied" : label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    if (r.includes("org")) return "organization";
    if (r.includes("ath")) return "athlete";
    return "";
  }, [user]);

  const orgName = useMemo(
    () => String(user?.Name || user?.name || user?.Organization || "Organization"),
    [user]
  );

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgAuthHeaders = useMemo(() => {
    // Works even if cookie auth is flaky; requireOrg supports this header fallback
    return orgToken ? { "x-org-token": orgToken } : {};
  }, [orgToken]);

  // URL helpers for invite links
  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const inviteLink = useMemo(() => {
    if (!origin || !orgToken) return "";
    // You can change this path to whatever your athlete signup route is.
    // Common patterns:
    // - /signup?role=athlete&token=...
    // - /athlete/signup?token=...
    return `${origin}/signup?role=athlete&token=${encodeURIComponent(orgToken)}`;
  }, [origin, orgToken]);

  // Data
  const [loading, setLoading] = useState(true);
  const [loadingDeep, setLoadingDeep] = useState(false);
  const [error, setError] = useState("");

  const [athletes, setAthletes] = useState([]);
  const [plansByEmail, setPlansByEmail] = useState({}); // { email: [prescriptions] }

  // UI controls
  const [search, setSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");

  // Auth guards
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && role !== "organization") {
      router.push("/dashboard");
      return;
    }
  }, [user, role, router]);

  /* ------------------------------------------------------------------------ */
  /* Fetchers                                                                 */
  /* ------------------------------------------------------------------------ */

  const fetchAthletes = useCallback(async () => {
    const res = await fetch("/api/org/getAthletes", {
      method: "GET",
      credentials: "include",
      headers: {
        ...orgAuthHeaders,
      },
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Failed to load athletes");

    const list = Array.isArray(data?.athletes) ? data.athletes : [];
    return list;
  }, [orgAuthHeaders]);

  const fetchPlansForAthlete = useCallback(
    async (email) => {
      const e = normalizeEmail(email);
      if (!e) return [];

      const res = await fetch(
        `/api/org/getPrescriptionsForAthlete?athleteEmail=${encodeURIComponent(e)}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            ...orgAuthHeaders,
          },
        }
      );

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load plan history");

      return Array.isArray(data?.prescriptions) ? data.prescriptions : [];
    },
    [orgAuthHeaders]
  );

  /**
   * Loads:
   * 1) athletes list
   * 2) plan history for each athlete (for stats + activity feed)
   *
   * Note: For very large orgs, you’ll want an aggregated API endpoint
   * to avoid N+1 requests. For now, this is perfect for early usage.
   */
  const refreshAll = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const list = await fetchAthletes();
      setAthletes(list);

      // Auto-select first athlete
      if (!selectedEmail) {
        const first = list.find((a) => a?.email);
        if (first?.email) setSelectedEmail(normalizeEmail(first.email));
      }

      // Deep load plans for activity + stats
      setLoadingDeep(true);

      // Concurrency-limited fetch (prevents a request storm)
      const emails = list.map((a) => normalizeEmail(a?.email)).filter(Boolean);
      const nextMap = {};

      const limit = 5;
      for (let i = 0; i < emails.length; i += limit) {
        const batch = emails.slice(i, i + limit);
        const results = await Promise.all(
          batch.map(async (e) => {
            try {
              const plans = await fetchPlansForAthlete(e);
              return [e, plans];
            } catch {
              return [e, []];
            }
          })
        );
        results.forEach(([e, plans]) => {
          nextMap[e] = plans;
        });
      }

      setPlansByEmail(nextMap);
    } catch (err) {
      console.error("[org/dashboard] refreshAll error:", err);
      setError(err?.message || "Failed to load organization overview.");
    } finally {
      setLoadingDeep(false);
      setLoading(false);
    }
  }, [fetchAthletes, fetchPlansForAthlete, selectedEmail]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  /* ------------------------------------------------------------------------ */
  /* Derived data                                                             */
  /* ------------------------------------------------------------------------ */

  const normalizedAthletes = useMemo(() => {
    return (athletes || []).map((a) => {
      const email = normalizeEmail(a?.email);
      const plans = plansByEmail[email] || [];

      const lastPlan = plans[0] || null; // API returns desc sort by CreatedAt
      const lastPlanAt = lastPlan?.createdAt ? safeDate(lastPlan.createdAt) : null;

      return {
        ...a,
        email,
        plansCount: plans.length,
        lastPlanAt,
        lastPlanTitle: lastPlan?.title || "",
      };
    });
  }, [athletes, plansByEmail]);

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = normalizedAthletes;

    const out = q
      ? list.filter((a) => {
          const name = String(a?.name || "").toLowerCase();
          const email = String(a?.email || "").toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : list;

    // Sort by last plan date desc, then createdAt desc
    return out.sort((a, b) => {
      const ad = a.lastPlanAt ? a.lastPlanAt.getTime() : 0;
      const bd = b.lastPlanAt ? b.lastPlanAt.getTime() : 0;
      if (bd !== ad) return bd - ad;

      const ac = safeDate(a.createdAt)?.getTime?.() || 0;
      const bc = safeDate(b.createdAt)?.getTime?.() || 0;
      return bc - ac;
    });
  }, [normalizedAthletes, search]);

  const totalAthletes = normalizedAthletes.length;

  const totalPlans = useMemo(() => {
    return Object.values(plansByEmail || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }, [plansByEmail]);

  const athletesWithPlans = useMemo(() => {
    return normalizedAthletes.filter((a) => (a.plansCount || 0) > 0).length;
  }, [normalizedAthletes]);

  const lastActivity = useMemo(() => {
    // Merge latest plans across athletes into one feed
    const items = [];
    for (const a of normalizedAthletes) {
      const email = normalizeEmail(a.email);
      const plans = plansByEmail[email] || [];
      plans.forEach((p) => {
        items.push({
          type: "plan",
          athleteName: a?.name || "Athlete",
          athleteEmail: email,
          title: p?.title || "Plan",
          createdAt: p?.createdAt || "",
          createdBy: p?.createdBy || "",
          createdAtDate: safeDate(p?.createdAt),
        });
      });
    }

    items.sort((x, y) => {
      const xd = x.createdAtDate ? x.createdAtDate.getTime() : 0;
      const yd = y.createdAtDate ? y.createdAtDate.getTime() : 0;
      return yd - xd;
    });

    return items.slice(0, 10);
  }, [normalizedAthletes, plansByEmail]);

  const newestAthlete = useMemo(() => {
    const list = [...normalizedAthletes].sort((a, b) => {
      const ad = safeDate(a.createdAt)?.getTime?.() || 0;
      const bd = safeDate(b.createdAt)?.getTime?.() || 0;
      return bd - ad;
    });
    return list[0] || null;
  }, [normalizedAthletes]);

  const mostRecentPlan = useMemo(() => {
    return lastActivity.find((x) => x.type === "plan") || null;
  }, [lastActivity]);

  const activeLast30 = useMemo(() => {
    const now = new Date();
    return normalizedAthletes.filter((a) => {
      const d = a.lastPlanAt;
      if (!d) return false;
      return daysBetween(d, now) <= 30;
    }).length;
  }, [normalizedAthletes]);

  const selectedAthlete = useMemo(() => {
    const e = normalizeEmail(selectedEmail);
    if (!e) return null;
    return normalizedAthletes.find((a) => normalizeEmail(a.email) === e) || null;
  }, [normalizedAthletes, selectedEmail]);

  /* ------------------------------------------------------------------------ */
  /* UI Actions                                                               */
  /* ------------------------------------------------------------------------ */

  const goBuildPlan = (athleteEmail) => {
    const e = normalizeEmail(athleteEmail);
    if (!e) {
      router.push("/org/prescriptions");
      return;
    }
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
  };

  const goHistory = (athleteEmail) => {
    const e = normalizeEmail(athleteEmail);
    if (!e) return;
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
  };

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Styles                                                                   */
  /* ------------------------------------------------------------------------ */

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">{orgName} Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Org Session Active
                </Pill>
                {orgToken ? (
                  <Pill>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Token Loaded
                  </Pill>
                ) : (
                  <Pill>Missing token</Pill>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={refreshAll} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="dark" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
          </div>
        </div>

        {/* Status */}
        {(loading || loadingDeep) && (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-4">
            <p className="text-sm text-gray-700">
              Loading organization overview{loadingDeep ? " (plans & activity)..." : "..."}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-4">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Athletes"
            value={totalAthletes}
            sub={newestAthlete?.email ? `Newest: ${newestAthlete.email}` : "—"}
          />
          <StatCard
            icon={FileText}
            label="Total Plans"
            value={totalPlans}
            sub={mostRecentPlan?.createdAt ? `Latest: ${fmtDate(mostRecentPlan.createdAt)}` : "—"}
          />
          <StatCard
            icon={Activity}
            label="Athletes w/ Plans"
            value={athletesWithPlans}
            sub={totalAthletes ? `${Math.round((athletesWithPlans / totalAthletes) * 100)}% coverage` : "—"}
          />
          <StatCard
            icon={Sparkles}
            label="Active (30d)"
            value={activeLast30}
            sub="Athletes with a plan created in the last 30 days"
          />
        </div>

        {/* Invite / Token */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold">Invite Athletes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Athletes use your token during signup to join your organization.
              </p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={orgToken} label="Copy token" />
              <CopyButton text={inviteLink} label="Copy signup link" />
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Organization Token</p>
              <p className="font-mono text-sm font-semibold break-all mt-1">
                {orgToken || "— missing Token on session user —"}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                This token links an athlete account to your org automatically.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">Signup Link</p>
                <LinkIcon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="font-mono text-[12px] font-semibold break-all mt-1">
                {inviteLink || "—"}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Share this with recruits. It pre-fills the token so they don’t mistype it.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <h3 className="font-extrabold">Build a Plan</h3>
            <p className="text-sm text-gray-600 mt-1">
              Jump straight into the plan builder for any athlete.
            </p>

            <div className="mt-4 flex gap-2">
              <Button onClick={() => router.push("/org/prescriptions")}>
                <FileText className="w-4 h-4" />
                Open Builder
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {selectedAthlete?.email && (
              <div className="mt-4 text-[11px] text-gray-500">
                Tip: Choose an athlete below and click <span className="font-semibold">Build</span> to preselect them.
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <h3 className="font-extrabold">Manage Athletes</h3>
            <p className="text-sm text-gray-600 mt-1">
              View your roster, who’s active, and who needs a plan.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/org/prescriptions")}>
                <Users className="w-4 h-4" />
                Roster + Plans
              </Button>
            </div>
            <div className="mt-4 text-[11px] text-gray-500">
              Next upgrade: dedicated athletes page with tags, positions, injuries, and notes.
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <h3 className="font-extrabold">Recent Activity</h3>
            <p className="text-sm text-gray-600 mt-1">
              Track new plans and keep your org consistent.
            </p>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => document.getElementById("activity-feed")?.scrollIntoView({ behavior: "smooth" })}>
                <Activity className="w-4 h-4" />
                View Feed
              </Button>
            </div>
            <div className="mt-4 text-[11px] text-gray-500">
              Next upgrade: notifications + “needs update” reminders.
            </div>
          </div>
        </div>

        {/* Roster + Activity */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Roster */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Athlete Roster</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Search, see plan coverage, and take action fast.
                </p>
              </div>

              <div className="w-full sm:w-[320px] relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className={classNames(inputBase, "pl-10")}
                  placeholder="Search athletes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-3 pr-4">Athlete</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Plans</th>
                    <th className="py-3 pr-4">Last Plan</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No athletes found.
                      </td>
                    </tr>
                  )}

                  {filteredAthletes.map((a) => {
                    const isSelected = normalizeEmail(selectedEmail) === normalizeEmail(a.email);
                    const last = a.lastPlanAt ? a.lastPlanAt.toLocaleString() : "—";

                    return (
                      <tr
                        key={a.id}
                        className={classNames(
                          "border-b last:border-b-0",
                          isSelected ? "bg-blue-50/60" : ""
                        )}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">
                              {a?.name || "Athlete"}
                            </span>
                            {a?.createdAt ? (
                              <span className="text-[11px] text-gray-500">
                                Joined: {fmtDate(a.createdAt)}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => setSelectedEmail(a.email)}
                            className="text-left"
                          >
                            <span className="text-gray-700 font-medium">{a.email}</span>
                          </button>
                          <div className="mt-1">
                            <a
                              href={`mailto:${a.email}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Email
                            </a>
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <Pill>{a.plansCount || 0}</Pill>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium">{last}</div>
                          {a.lastPlanTitle ? (
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[220px]">
                              {a.lastPlanTitle}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400 mt-0.5">No plans yet</div>
                          )}
                        </td>

                        <td className="py-3 pr-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => goHistory(a.email)}
                              disabled={!a.email}
                              className="px-3 py-2 text-xs"
                            >
                              History
                            </Button>
                            <Button
                              onClick={() => goBuildPlan(a.email)}
                              disabled={!a.email}
                              className="px-3 py-2 text-xs"
                            >
                              Build
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[11px] text-gray-500">
              Performance note: this dashboard currently loads plan history per athlete.
              For a large org, we’ll create an aggregated endpoint to return “latest plan per athlete”
              + “recent activity” in one request.
            </div>
          </section>

          {/* Activity Feed */}
          <section
            id="activity-feed"
            className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Activity Feed</h2>
                <p className="text-sm text-gray-600 mt-1">Latest plans across your org.</p>
              </div>
              <Button variant="secondary" onClick={refreshAll} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {lastActivity.length === 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800">No activity yet</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Create your first plan to start building history and insights.
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => router.push("/org/prescriptions")}>
                      <FileText className="w-4 h-4" />
                      Create Plan
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {lastActivity.map((it, idx) => (
                <div key={`${it.athleteEmail}-${idx}`} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">{it.title}</p>
                      <p className="text-[12px] text-gray-700 mt-1">
                        <span className="font-semibold">{it.athleteName}</span>{" "}
                        <span className="text-gray-500">({it.athleteEmail})</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-2">
                        {it.createdAt ? `Created: ${fmtDate(it.createdAt)}` : "—"}
                        {it.createdBy ? ` • By: ${it.createdBy}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => goHistory(it.athleteEmail)}
                      className="text-[#46769B] text-xs font-extrabold hover:underline"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[11px] text-gray-500">
              Next upgrade: “Needs update” flags, reminders, and athlete compliance check-ins.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
