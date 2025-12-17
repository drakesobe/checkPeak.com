// pages/api/org/getOrgOverview.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sortByDateDesc(a, b) {
  const ad = safeDate(a?.createdAt)?.getTime?.() || 0;
  const bd = safeDate(b?.createdAt)?.getTime?.() || 0;
  return bd - ad;
}

const athletesBase =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
        process.env.ATHLETE_BASE_ID
      )
    : null;

const prescriptionsBase =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(
        process.env.PRESCRIPTIONS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "getOrgOverview");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ATHLETES_TABLE = process.env.ATHLETE_TABLE_NAME;
  const PRESCRIPTIONS_TABLE = process.env.PRESCRIPTIONS_TABLE_NAME;

  if (!athletesBase || !ATHLETES_TABLE) {
    return res.status(500).json({
      error:
        "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
    });
  }

  if (!prescriptionsBase || !PRESCRIPTIONS_TABLE) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
    });
  }

  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error || "Unauthorized" });
  }

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) {
    return res.status(401).json({ error: "Organization token missing" });
  }

  // Optional controls:
  // ?daysStale=30 → athlete is "stale" if last plan older than 30 days
  // ?activityLimit=10 → activity feed size
  const daysStale = Math.max(7, Math.min(180, Number(req.query?.daysStale || 30)));
  const activityLimit = Math.max(5, Math.min(50, Number(req.query?.activityLimit || 10)));

  try {
    const safeToken = escapeAirtableString(orgToken);

    // 1) Load athletes for org token
    const athleteRecords = await athletesBase(ATHLETES_TABLE)
      .select({
        filterByFormula: `{Token}='${safeToken}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const athletes = athleteRecords.map((r) => ({
      id: r.id,
      name: r.fields?.Name || "",
      email: String(r.fields?.Email || "").trim().toLowerCase(),
      createdAt: r.fields?.CreatedAt || "",
      // (Optional future fields if you add them in Airtable)
      status: r.fields?.Status || "Active", // if your athletes table has Status
      tags: Array.isArray(r.fields?.Tags) ? r.fields.Tags : [], // if Tags is multi-select
    }));

    const emails = athletes.map((a) => a.email).filter(Boolean);

    // Early return
    if (emails.length === 0) {
      return res.status(200).json({
        stats: {
          totalAthletes: 0,
          totalPlans: 0,
          athletesWithPlans: 0,
          coveragePct: 0,
          activeLast30: 0,
          staleCount: 0,
        },
        athletes: [],
        recentActivity: [],
      });
    }

    // 2) Load all prescriptions for this org token
    // NOTE: This avoids calling getPrescriptionsForAthlete N times.
    const rxRecords = await prescriptionsBase(PRESCRIPTIONS_TABLE)
      .select({
        filterByFormula: `{Organization Token}='${safeToken}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    // Group by athlete email
    const byEmail = {};
    const activity = [];

    for (const r of rxRecords) {
      const f = r.fields || {};
      const email = String(f["Athlete Email"] || f.AthleteEmail || "").trim().toLowerCase();
      if (!email) continue;

      const item = {
        id: r.id,
        athleteEmail: email,
        title: f.Title || "",
        createdAt: f.CreatedAt || "",
        createdBy: f.CreatedBy || "",
        organization: f.Organization || "",
        prescription: f.Prescription || "",
      };

      byEmail[email] = byEmail[email] || [];
      byEmail[email].push(item);

      // recent activity feed (we’ll slice later)
      activity.push({
        type: "plan",
        athleteEmail: email,
        title: item.title || "Plan",
        createdAt: item.createdAt,
        createdBy: item.createdBy,
      });
    }

    // Sort each athlete's plans (desc)
    for (const email of Object.keys(byEmail)) {
      byEmail[email].sort(sortByDateDesc);
    }

    // Build athlete metrics
    const now = new Date();
    const staleMs = daysStale * 24 * 60 * 60 * 1000;

    let totalPlans = 0;
    let athletesWithPlans = 0;
    let activeLast30 = 0;
    let staleCount = 0;

    const enrichedAthletes = athletes.map((a) => {
      const plans = byEmail[a.email] || [];
      totalPlans += plans.length;
      if (plans.length > 0) athletesWithPlans += 1;

      const last = plans[0] || null;
      const lastDate = safeDate(last?.createdAt);

      const isActive30 =
        lastDate && Math.abs(now.getTime() - lastDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;

      if (isActive30) activeLast30 += 1;

      const isStale = lastDate ? now.getTime() - lastDate.getTime() > staleMs : true;
      if (isStale) staleCount += 1;

      return {
        ...a,
        plansCount: plans.length,
        lastPlanAt: last?.createdAt || "",
        lastPlanTitle: last?.title || "",
        needsPlan: plans.length === 0,
        stale: isStale,
      };
    });

    // Coverage
    const totalAthletes = enrichedAthletes.length;
    const coveragePct = totalAthletes ? Math.round((athletesWithPlans / totalAthletes) * 100) : 0;

    // Activity feed
    activity.sort(sortByDateDesc);
    const recentActivity = activity.slice(0, activityLimit);

    return res.status(200).json({
      stats: {
        totalAthletes,
        totalPlans,
        athletesWithPlans,
        coveragePct,
        activeLast30,
        staleCount,
      },
      athletes: enrichedAthletes,
      recentActivity,
    });
  } catch (err) {
    console.error("[getOrgOverview] error:", err);
    return res.status(500).json({
      error: "Failed to build org overview",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
