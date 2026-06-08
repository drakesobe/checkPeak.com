// components/commercial/AnalyticsTab.jsx
"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Users, DollarSign, Video, RefreshCcw } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

const TIER_COLOR = {
  Basic:   { color: DS.safe,    bg: DS.safeBg    },
  Premium: { color: DS.caution, bg: DS.cautionBg },
  Ultra:   { color: DS.brand,   bg: DS.brandBg   },
};

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="rounded-sm p-4" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
      <div className="w-8 h-8 rounded-sm flex items-center justify-center mb-3"
        style={{ backgroundColor: accent + "15", border: `1px solid ${accent}30` }}>
        {icon}
      </div>
      <p className="text-2xl font-black tabular-nums leading-none mb-1" style={{ color: DS.bodyText }}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: DS.dimText }}>{label}</p>
      {sub && <p className="text-[11px] leading-snug" style={{ color: DS.labelText }}>{sub}</p>}
    </div>
  );
}

function TierBar({ label, count, total, color, bg }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="px-2 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: bg, color }}>
          {label}
        </span>
        <span className="text-xs font-black tabular-nums" style={{ color: DS.bodyText }}>
          {count}
          <span className="font-normal ml-1 text-[10px]" style={{ color: DS.dimText }}>
            {total > 0 ? `(${pct}%)` : ""}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: DS.pageBg }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ytId(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function getThumb(v) {
  if (v.thumbnailUrl)  return v.thumbnailUrl;
  if (v.muxPlaybackId) return `https://image.mux.com/${v.muxPlaybackId}/thumbnail.jpg?width=80&height=45&fit_mode=smartcrop`;
  const yt = ytId(v.embedUrl);
  if (yt) return `https://img.youtube.com/vi/${yt}/default.jpg`;
  return null;
}

export default function AnalyticsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/commercial/analytics", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load analytics."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20">
        <RefreshCcw className="w-4 h-4 animate-spin" style={{ color: DS.dimText }} />
        <span className="text-sm" style={{ color: DS.dimText }}>Loading analytics…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm" style={{ color: DS.banned }}>{error || "No data."}</p>
      </div>
    );
  }

  const { subscribers, content, topVideos, prices } = data;
  const totalTier     = Object.values(subscribers.byTier).reduce((a, b) => a + b, 0);
  const muxAvailable  = topVideos.some(v => v.views > 0);
  const maxViews      = topVideos[0]?.views || 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <p className="text-sm font-black" style={{ color: DS.bodyText }}>Analytics</p>
        <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
          Subscriber breakdown · Est. monthly revenue · {muxAvailable ? "Video views — last 28 days" : "Video views update as plays come in"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))" }}>
        <StatCard
          icon={<Users    className="w-4 h-4" style={{ color: DS.brand   }} />}
          label="Active Members"
          value={subscribers.total}
          sub={subscribers.newThisMonth > 0 ? `+${subscribers.newThisMonth} joined this month` : "No new joins this month"}
          accent={DS.brand}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" style={{ color: DS.safe }} />}
          label="New This Month"
          value={subscribers.newThisMonth}
          accent={DS.safe}
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4" style={{ color: "#7C3AED" }} />}
          label="Est. MRR"
          value={`$${subscribers.mrr.toLocaleString()}`}
          sub="Based on active subscribers × tier price"
          accent="#7C3AED"
        />
        <StatCard
          icon={<Video className="w-4 h-4" style={{ color: DS.caution }} />}
          label="Content"
          value={`${content.publishedVideos}v  ${content.publishedWorkouts}w`}
          sub={`${content.totalVideos} videos · ${content.totalWorkouts} workouts total`}
          accent={DS.caution}
        />
      </div>

      {/* Middle: tier breakdown + recent joins */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>

        {/* Tier breakdown */}
        <div className="rounded-sm p-4" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-4" style={{ color: DS.brand }}>
            Members by Tier
          </p>
          {subscribers.total === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: DS.dimText }}>No active members yet.</p>
          ) : (
            <>
              <TierBar label="Basic"   count={subscribers.byTier.Basic}   total={totalTier} color={DS.safe}    bg={DS.safeBg}    />
              <TierBar label="Premium" count={subscribers.byTier.Premium} total={totalTier} color={DS.caution} bg={DS.cautionBg} />
              <TierBar label="Ultra"   count={subscribers.byTier.Ultra}   total={totalTier} color={DS.brand}   bg={DS.brandBg}   />

              {(prices.basic > 0 || prices.premium > 0 || prices.ultra > 0) && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: DS.border }}>
                  <p className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: DS.dimText }}>
                    Revenue by tier
                  </p>
                  {[
                    ["Basic",   subscribers.byTier.Basic,   prices.basic],
                    ["Premium", subscribers.byTier.Premium, prices.premium],
                    ["Ultra",   subscribers.byTier.Ultra,   prices.ultra],
                  ].filter(([, , p]) => p > 0).map(([t, count, price]) => (
                    <div key={t} className="flex justify-between items-center text-xs mb-1.5">
                      <span style={{ color: DS.labelText }}>{t}</span>
                      <span className="font-black tabular-nums" style={{ color: DS.bodyText }}>
                        ${(count * price).toLocaleString()}
                        <span className="font-normal text-[10px] ml-0.5" style={{ color: DS.dimText }}>/mo</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent joins */}
        <div className="rounded-sm overflow-hidden" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: DS.border }}>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.brand }}>
              Recent Joins
            </p>
          </div>
          {subscribers.recentJoins.length === 0 ? (
            <p className="text-xs px-4 py-8 text-center" style={{ color: DS.dimText }}>No members yet.</p>
          ) : subscribers.recentJoins.map((s, i) => {
            const tc       = TIER_COLOR[s.tier] ?? TIER_COLOR.Basic;
            const initial  = (s.name || s.email || "?")[0].toUpperCase();
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0"
                style={{ borderColor: DS.border }}>
                <div className="w-7 h-7 rounded-sm flex items-center justify-center text-[11px] font-black shrink-0"
                  style={{ backgroundColor: DS.brandBg, color: DS.brand }}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: DS.bodyText }}>
                    {s.name || s.email}
                  </p>
                  {s.name && (
                    <p className="text-[10px] truncate" style={{ color: DS.dimText }}>{s.email}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black"
                    style={{ backgroundColor: tc.bg, color: tc.color }}>{s.tier}</span>
                  <span className="text-[10px]" style={{ color: DS.dimText }}>{s.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top videos */}
      <div className="rounded-sm overflow-hidden" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: DS.border }}>
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Top Videos{muxAvailable ? " · Last 28 Days" : ""}
          </p>
          {!muxAvailable && topVideos.length > 0 && (
            <span className="text-[10px]" style={{ color: DS.dimText }}>
              Play counts populate as your videos get views
            </span>
          )}
        </div>

        {topVideos.length === 0 ? (
          <p className="text-xs px-4 py-8 text-center" style={{ color: DS.dimText }}>No videos yet.</p>
        ) : topVideos.map((v, i) => {
          const thumb  = getThumb(v);
          const tc     = TIER_COLOR[v.tier] ?? TIER_COLOR.Basic;
          const barPct = maxViews > 0 ? Math.round((v.views / maxViews) * 100) : 0;
          return (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
              style={{ borderColor: DS.border }}>
              <span className="text-[11px] font-black w-5 tabular-nums text-right shrink-0"
                style={{ color: DS.dimText }}>{i + 1}</span>

              {thumb ? (
                <img src={thumb} alt="" className="w-14 h-8 rounded-sm object-cover shrink-0"
                  style={{ border: `1px solid ${DS.border}` }} />
              ) : (
                <div className="w-14 h-8 rounded-sm shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
                  <Video className="w-3 h-3" style={{ color: DS.dimText }} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <p className="text-xs font-bold truncate" style={{ color: DS.bodyText }}>{v.title}</p>
                  <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-black shrink-0"
                    style={{ backgroundColor: tc.bg, color: tc.color }}>{v.tier}</span>
                  {!v.published && (
                    <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded-sm"
                      style={{ backgroundColor: DS.pageBg, color: DS.dimText }}>Draft</span>
                  )}
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: DS.pageBg }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${barPct}%`, backgroundColor: DS.brand + "55" }} />
                </div>
              </div>

              <span className="text-sm font-black tabular-nums shrink-0" style={{ color: DS.bodyText }}>
                {v.views.toLocaleString()}
                <span className="font-normal text-[10px] ml-0.5" style={{ color: DS.dimText }}>plays</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
