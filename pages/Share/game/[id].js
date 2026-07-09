// pages/share/game/[id].js
// Public shareable game stat card — SSR, no auth required.
// Athlete must have a public profile; otherwise 404.

import Head from "next/head";
import { createClient } from "@supabase/supabase-js";
import { SPORT_STATS, getFields, getComputed, getFootballGroup, aggregateStats } from "@/lib/sportStats";

const C = {
  bg:      "#08090B",
  surface: "#0D0F16",
  card:    "#131620",
  card2:   "#191D28",
  line:    "#1C2030",
  line2:   "#242A3E",
  white:   "#F0F3FA",
  dim:     "rgba(240,243,250,0.80)",
  muted:   "rgba(240,243,250,0.54)",
  faint:   "rgba(240,243,250,0.07)",
  accent:  "#4FABFF",
  green:   "#00C851",
  red:     "#EF4444",
  gold:    "#FFD700",
};

const SPORT_LABELS = {
  football: "Football", basketball: "Basketball", baseball: "Baseball",
  softball: "Softball", soccer: "Soccer", track: "Track & Field",
  swimming: "Swimming", volleyball: "Volleyball", wrestling: "Wrestling",
  lacrosse: "Lacrosse", hockey: "Hockey", tennis: "Tennis",
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Avatar({ url, name, size }) {
  const initials = (name || "A").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: `2px solid ${C.line2}`, background: url ? "transparent" : "linear-gradient(135deg,#1A2540,#0D1530)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {url
        ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.34, fontWeight: 900, color: C.accent }}>{initials}</span>
      }
    </div>
  );
}

export default function ShareGamePage({ gameData, notFound }) {
  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}`}</style>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.dim, marginBottom: 8 }}>Game not found</div>
          <div style={{ fontSize: 13, color: C.muted }}>This link may have expired or the profile is private.</div>
        </div>
      </div>
    );
  }

  const {
    athleteName, avatarUrl, school, position, sport,
    gameDate, opponent, location, result, teamScore, oppScore,
    statTiles, eventList, recruitToken, notes,
  } = gameData;

  const sportLabel = SPORT_LABELS[sport] || sport;
  const resultColor = result === "W" ? C.green : result === "L" ? C.red : result === "D" ? C.gold : null;
  const resultBg    = result === "W" ? "rgba(0,200,81,0.12)" : result === "L" ? "rgba(239,68,68,0.1)" : "rgba(255,215,0,0.1)";
  const hasScore    = teamScore != null && oppScore != null;

  return (
    <>
      <Head>
        <title>{athleteName}{opponent ? ` vs ${opponent}` : ""}{result ? ` — ${result}` : ""} · CheckPeak</title>
        <meta name="description" content={`${athleteName}'s game on ${fmtDate(gameDate)}${opponent ? ` vs ${opponent}` : ""}. Powered by CheckPeak.`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${athleteName}${result ? ` — ${result}` : ""}${opponent ? ` vs ${opponent}` : ""}`} />
        <meta property="og:description" content={statTiles.slice(0, 3).map(s => `${s.val} ${s.label}`).join("  ·  ")} />
        {gameData.ogImageUrl && <meta property="og:image" content={gameData.ogImageUrl} />}
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${athleteName}${result ? ` — ${result}` : ""}${opponent ? ` vs ${opponent}` : ""}`} />
        <meta name="twitter:description" content={statTiles.slice(0, 3).map(s => `${s.val} ${s.label}`).join("  ·  ")} />
        {gameData.ogImageUrl && <meta name="twitter:image" content={gameData.ogImageUrl} />}
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 540 }}>

          {/* Sticky brand bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, borderBottom: `1px solid ${C.line}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", color: C.accent }}>CHECKPEAK</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Game Card</span>
          </div>

          {/* Athlete header */}
          <div style={{ padding: "28px 22px 24px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.3s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar url={avatarUrl} name={athleteName} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{athleteName}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  {position && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, padding: "2px 9px", background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)", borderRadius: 4 }}>
                      {position}
                    </span>
                  )}
                  {sportLabel && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, padding: "2px 9px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 4 }}>
                      {sportLabel}
                    </span>
                  )}
                  {school && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>📍 {school}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Game info strip */}
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.3s ease 0.07s both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                {opponent && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 3 }}>vs {opponent}</div>
                )}
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
                  {[fmtDate(gameDate), location].filter(Boolean).join("  ·  ")}
                </div>
              </div>

              {/* Result badge */}
              {result && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: resultBg, border: `1px solid ${resultColor}40`, borderRadius: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: resultColor, letterSpacing: "-0.01em" }}>{result}</span>
                    {hasScore && (
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.dim }}>
                        {teamScore}–{oppScore}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── STATS ── */}
          {statTiles.length > 0 && (
            <div style={{ padding: "22px 22px 18px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.3s ease 0.12s both" }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: C.muted, marginBottom: 16 }}>PERFORMANCE</div>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(statTiles.length, 4)}, 1fr)`,
                gap: 1,
                background: C.line,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                overflow: "hidden",
              }}>
                {statTiles.map((s, i) => (
                  <div key={s.key} style={{ padding: "20px 8px", background: i === 0 ? "#151926" : C.card, textAlign: "center" }}>
                    <div style={{ fontSize: i === 0 ? 32 : 26, fontWeight: 900, color: i === 0 ? C.white : C.dim, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: C.muted, marginTop: 7 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Track / swimming events */}
          {eventList && eventList.length > 0 && (
            <div style={{ padding: "22px 22px 18px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.3s ease 0.12s both" }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: C.muted, marginBottom: 14 }}>EVENTS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {eventList.map((ev, i) => (
                  <div key={i} style={{ padding: "12px 16px", background: i === 0 ? "#151926" : C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: "-0.02em", lineHeight: 1 }}>{ev.mark}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginTop: 5 }}>{ev.event}</div>
                    {ev.place && <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginTop: 2 }}>#{ev.place}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.3s ease 0.17s both" }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.muted, lineHeight: 1.7, fontStyle: "italic" }}>{notes}</p>
            </div>
          )}

          {/* CTA */}
          <div style={{ padding: "24px 22px 32px", animation: "fadeUp 0.3s ease 0.22s both" }}>
            {recruitToken ? (
              <a
                href={`/recruit/${recruitToken}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px 24px", background: `linear-gradient(135deg,#5BB8FF,#3B8FDB)`, borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#fff", textDecoration: "none", boxShadow: "0 4px 20px rgba(79,171,255,0.22)" }}
              >
                View Full Recruiting Profile
              </a>
            ) : (
              <a
                href="/"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px 24px", background: `linear-gradient(135deg,#5BB8FF,#3B8FDB)`, borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#fff", textDecoration: "none" }}
              >
                Get CheckPeak Free
              </a>
            )}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <span style={{ fontSize: 11, color: "rgba(240,243,250,0.22)", fontWeight: 600, letterSpacing: "0.05em" }}>
                Powered by <span style={{ color: "rgba(79,171,255,0.5)" }}>CHECKPEAK</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── SSR ──────────────────────────────────────────────────────────────────────

export async function getServerSideProps({ params, req }) {
  const id = String(params?.id || "").trim();
  if (!id) return { notFound: true };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Fetch the game log
  const { data: game } = await db
    .from("athlete_game_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!game) return { props: { notFound: true } };

  // Athlete must have a public profile
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("avatar_url, share_token, sport, position, school")
    .eq("athlete_token", game.athlete_token)
    .eq("is_public", true)
    .maybeSingle();

  if (!profile) return { props: { notFound: true } };

  const { data: athlete } = await db
    .from("athletes")
    .select("name")
    .eq("athlete_token", game.athlete_token)
    .maybeSingle();

  const athleteName = athlete?.name || "Athlete";
  const sport = game.sport || profile.sport || "";
  const cfg = SPORT_STATS[sport];

  // Build stat tiles
  let statTiles = [];
  let eventList = null;

  if (cfg) {
    if (cfg.type === "events") {
      eventList = Array.isArray(game.stats?.events) ? game.stats.events : [];
    } else {
      const groupKey = game.group_key || (cfg.type === "grouped" ? getFootballGroup(profile.position) : null);
      const roleKey  = game.role_key || (cfg.type === "role" ? Object.keys(cfg.roles)[0] : null);
      const fields   = getFields(sport, groupKey, roleKey);
      const computed = getComputed(sport, groupKey, roleKey);

      const displayKeys = cfg.type === "grouped" && groupKey
        ? (cfg.groups[groupKey]?.display ?? [])
        : cfg.type === "role" && roleKey
        ? (cfg.roles[roleKey]?.display ?? [])
        : (cfg.display ?? []);

      const labelMap = {};
      [...fields, ...computed].forEach(f => { labelMap[f.key] = f.label; });

      const totals = aggregateStats([game], fields);
      const computedVals = {};
      computed.forEach(c => { try { computedVals[c.key] = c.fn(totals); } catch { computedVals[c.key] = "—"; } });

      statTiles = displayKeys.map(key => {
        const raw = computedVals[key] != null ? computedVals[key] : (totals[key] != null ? totals[key] : null);
        if (raw == null || raw === "—") return null;
        const numVal = typeof raw === "number" ? raw : parseFloat(raw);
        const fmtVal = typeof raw === "string" ? raw : (!isNaN(numVal) && numVal >= 1000 ? numVal.toLocaleString() : String(raw));
        return { key, val: fmtVal, label: labelMap[key] || key };
      }).filter(Boolean).slice(0, 6);
    }
  }

  // Build OG image URL
  const host = process.env.NEXT_PUBLIC_SITE_URL
    || (req.headers["x-forwarded-proto"]
      ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"] || req.headers.host}`
      : `https://${req.headers.host}`);

  const ogP = new URLSearchParams({
    name:   athleteName,
    sport:  SPORT_LABELS[sport] || sport,
    pos:    profile.position || "",
    school: profile.school   || "",
    result: game.result      || "",
    opp:    game.opponent    || "",
    score:  (game.team_score != null && game.opp_score != null) ? `${game.team_score}-${game.opp_score}` : "",
  });
  statTiles.slice(0, 4).forEach((s, i) => {
    ogP.set(`stat${i + 1}`, String(s.val));
    ogP.set(`lbl${i + 1}`, s.label);
  });
  const ogImageUrl = `${host}/api/stats/og?${ogP}`;

  return {
    props: {
      notFound: false,
      gameData: {
        athleteName,
        avatarUrl:   profile.avatar_url || null,
        school:      profile.school     || null,
        position:    profile.position   || null,
        sport,
        gameDate:    game.game_date     || null,
        opponent:    game.opponent      || null,
        location:    game.location      || null,
        result:      game.result        || null,
        teamScore:   game.team_score    ?? null,
        oppScore:    game.opp_score     ?? null,
        notes:       game.notes         || null,
        statTiles,
        eventList,
        recruitToken: profile.share_token || null,
        ogImageUrl,
      },
    },
  };
}
