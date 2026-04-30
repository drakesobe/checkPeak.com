// pages/org/help.js
// CheckPeak Coach Training Center — fully responsive
// Desktop: sidebar left, video right
// Mobile: horizontal episode strip top, video + info below

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Video data ────────────────────────────────────────────────────────────────

const VIDEOS = [
  {
    id:        1,
    episode:   "01",
    title:     "Dashboard Overview",
    subtitle:  "Your command center",
    desc:      "Get oriented with CheckPeak. Understand your main controls, navigation, and how athlete data surfaces at a glance. Start here before anything else.",
    duration:  "3 min",
    embedId:   "110d9e292ad74f388e5f7809e597a19c",
    url:       "https://www.loom.com/share/110d9e292ad74f388e5f7809e597a19c",
    category:  "Foundation",
    accent:    "#4FABFF",
  },
  {
    id:        2,
    episode:   "02",
    title:     "Workouts & Calendar",
    subtitle:  "Build and assign programming",
    desc:      "Create workouts from scratch, assign them to individual athletes or entire teams, and manage your programming calendar week by week.",
    duration:  "4 min",
    embedId:   "36d2d9e03e0a4de0a0a7386a8b796e85",
    url:       "https://www.loom.com/share/36d2d9e03e0a4de0a0a7386a8b796e85",
    category:  "Programming",
    accent:    "#34D399",
  },
  {
    id:        3,
    episode:   "03",
    title:     "Understanding Nutrition",
    subtitle:  "How the nutrition system works",
    desc:      "Walk through the nutrition dashboard — how meals are structured, what athletes see in the app, and how macro targets are displayed.",
    duration:  "Coming soon",
    embedId:   null,
    url:       null,
    category:  "Nutrition",
    accent:    "#F59E0B",
    comingSoon: true,
  },
  {
    id:        4,
    episode:   "04",
    title:     "Building Nutrition Plans",
    subtitle:  "Create and assign meal plans",
    desc:      "Build customized meal plans with specific macro targets and assign them to individual athletes or your full roster.",
    duration:  "5 min",
    embedId:   "611392c826dc484f83e426dd8a1f8bd1",
    url:       "https://www.loom.com/share/611392c826dc484f83e426dd8a1f8bd1",
    category:  "Nutrition",
    accent:    "#F59E0B",
  },
  {
    id:        5,
    episode:   "05",
    title:     "Feed, Messaging & Rankings",
    subtitle:  "Communication and accountability",
    desc:      "Broadcast team announcements, send direct messages to athletes, and monitor the Top 25 accountability leaderboard in real time.",
    duration:  "4 min",
    embedId:   "6d4b71fee769462c9382bfda39c25956",
    url:       "https://www.loom.com/share/6d4b71fee769462c9382bfda39c25956",
    category:  "Communication",
    accent:    "#A78BFA",
  },
  {
    id:        6,
    episode:   "06",
    title:     "Inviting Your Team",
    subtitle:  "Add trainers and athletes",
    desc:      "Add staff members and athletes to your organization. Understand roles, permissions, and how the coach-issued invite code system works.",
    duration:  "3 min",
    embedId:   "2330b6c7351240a18fa803f97b0cbc0b",
    url:       "https://www.loom.com/share/2330b6c7351240a18fa803f97b0cbc0b",
    category:  "Setup",
    accent:    "#FB923C",
  },
  {
    id:        7,
    episode:   "07",
    title:     "Managing the Review Queue",
    subtitle:  "Approve and track submissions",
    desc:      "Review athlete workout submissions, approve evidence photos, and keep your accountability pipeline moving efficiently.",
    duration:  "4 min",
    embedId:   "7d0e71d7ccae46b0835e451bf6893bdf",
    url:       "https://www.loom.com/share/7d0e71d7ccae46b0835e451bf6893bdf",
    category:  "Accountability",
    accent:    "#F87171",
  },
];

function getLoomEmbed(embedId) {
  return `https://www.loom.com/embed/${embedId}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true&autoplay=0`;
}

// ── useIsMobile hook ──────────────────────────────────────────────────────────

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < bp);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [bp]);
  return mobile;
}

// ── Top progress bar ──────────────────────────────────────────────────────────

function TopProgressBar({ current, total, accent }) {
  const pct = total > 1 ? ((current - 1) / (total - 1)) * 100 : 0;
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
      <div style={{
        height:     "100%",
        width:      `${pct}%`,
        background: accent,
        boxShadow:  `0 0 10px ${accent}88`,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

// ── Desktop sidebar episode row ───────────────────────────────────────────────

function EpisodeRow({ video, isActive, isWatched, onClick }) {
  const [hovered, setHovered] = useState(false);
  const available = !video.comingSoon;

  return (
    <div
      onClick={() => available && onClick(video.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:     "flex",
        alignItems:  "flex-start",
        gap:         12,
        padding:     "13px 14px",
        borderRadius: 10,
        cursor:      available ? "pointer" : "default",
        background:  isActive
          ? "rgba(255,255,255,0.07)"
          : hovered && available
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        borderLeft:  `2px solid ${isActive ? video.accent : "transparent"}`,
        transition:  "all 0.15s ease",
        opacity:     video.comingSoon ? 0.45 : 1,
      }}
    >
      {/* Circle */}
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   "50%",
        flexShrink:     0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     isActive ? video.accent + "22" : "rgba(255,255,255,0.06)",
        border:         `1px solid ${isActive ? video.accent + "55" : "rgba(255,255,255,0.1)"}`,
        marginTop:      1,
      }}>
        {isWatched && !isActive
          ? <span style={{ fontSize: 12, color: "#34D399" }}>✓</span>
          : <span style={{ fontSize: 10, fontWeight: 800, color: isActive ? video.accent : "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{video.episode}</span>
        }
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? "#fff" : "rgba(255,255,255,0.6)", lineHeight: 1.3, marginBottom: 2 }}>
          {video.title}
        </div>
        <div style={{ fontSize: 11, color: isActive ? video.accent : "rgba(255,255,255,0.28)", fontWeight: 500 }}>
          {video.comingSoon ? "Coming soon" : video.duration}
        </div>
      </div>
    </div>
  );
}

// ── Mobile horizontal episode chip ────────────────────────────────────────────

function EpisodeChip({ video, isActive, isWatched, onClick }) {
  const available = !video.comingSoon;
  return (
    <div
      onClick={() => available && onClick(video.id)}
      style={{
        flexShrink:     0,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            6,
        padding:        "10px 14px",
        borderRadius:   12,
        cursor:         available ? "pointer" : "default",
        background:     isActive ? video.accent + "18" : "rgba(255,255,255,0.05)",
        border:         `1px solid ${isActive ? video.accent + "55" : "rgba(255,255,255,0.08)"}`,
        opacity:        video.comingSoon ? 0.45 : 1,
        minWidth:       72,
        transition:     "all 0.15s ease",
      }}
    >
      <div style={{
        width:          28,
        height:         28,
        borderRadius:   "50%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     isActive ? video.accent + "33" : "rgba(255,255,255,0.07)",
        border:         `1px solid ${isActive ? video.accent + "66" : "rgba(255,255,255,0.1)"}`,
        fontSize:       10,
        fontWeight:     800,
        color:          isActive ? video.accent : "rgba(255,255,255,0.4)",
        fontFamily:     "monospace",
      }}>
        {isWatched && !isActive ? <span style={{ color: "#34D399", fontSize: 11 }}>✓</span> : video.episode}
      </div>
      <div style={{
        fontSize:    10,
        fontWeight:  isActive ? 700 : 500,
        color:       isActive ? "#fff" : "rgba(255,255,255,0.45)",
        textAlign:   "center",
        lineHeight:  1.2,
        maxWidth:    64,
        overflow:    "hidden",
        textOverflow:"ellipsis",
        whiteSpace:  "nowrap",
      }}>
        {video.title}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const router    = useRouter();
  const isMobile  = useIsMobile(768);
  const stripRef  = useRef(null);

  const [activeId, setActiveId] = useState(1);
  const [watched,  setWatched]  = useState(new Set([1]));

  const available     = VIDEOS.filter(v => !v.comingSoon);
  const active        = VIDEOS.find(v => v.id === activeId);
  const episodeIndex  = available.findIndex(v => v.id === activeId) + 1;
  const hasPrev       = VIDEOS.some(v => v.id < activeId && !v.comingSoon);
  const hasNext       = VIDEOS.some(v => v.id > activeId && !v.comingSoon);

  const handleSelect = (id) => {
    setActiveId(id);
    setWatched(prev => new Set([...prev, id]));
  };

  const handleNext = () => {
    const next = VIDEOS.find(v => v.id > activeId && !v.comingSoon);
    if (next) handleSelect(next.id);
  };

  const handlePrev = () => {
    const prevList = VIDEOS.filter(v => v.id < activeId && !v.comingSoon);
    const prev = prevList[prevList.length - 1];
    if (prev) handleSelect(prev.id);
  };

  // Scroll active chip into view on mobile
  useEffect(() => {
    if (!isMobile || !stripRef.current) return;
    const chip = stripRef.current.querySelector(`[data-id="${activeId}"]`);
    if (chip) chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId, isMobile]);

  const accent = active?.accent || "#4FABFF";

  return (
    <div style={{
      minHeight:     "100vh",
      background:    "#0A0E17",
      color:         "#fff",
      display:       "flex",
      flexDirection: "column",
      fontFamily:    "'Barlow', system-ui, sans-serif",
    }}>

      {/* ── Progress bar ── */}
      <TopProgressBar current={episodeIndex || 1} total={available.length} accent={accent} />

      {/* ── Top nav ── */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        isMobile ? "12px 16px" : "14px 24px",
        borderBottom:   "1px solid rgba(255,255,255,0.06)",
        flexShrink:     0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16 }}>
          <button
            type="button"
            onClick={() => router.push("/org/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            ← {isMobile ? "Back" : "Dashboard"}
          </button>
          {!isMobile && (
            <>
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                CheckPeak · Training Center
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
              {watched.size} of {available.length} watched
            </span>
          )}
          <div style={{ height: 4, width: isMobile ? 60 : 80, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(watched.size / available.length) * 100}%`, background: "#34D399", borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      {/* ── Mobile: horizontal episode strip ── */}
      {isMobile && (
        <div
          ref={stripRef}
          style={{
            display:          "flex",
            gap:              8,
            padding:          "12px 16px",
            overflowX:        "auto",
            borderBottom:     "1px solid rgba(255,255,255,0.06)",
            flexShrink:       0,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth:   "none",
          }}
        >
          <style>{`.strip::-webkit-scrollbar { display: none; }`}</style>
          {VIDEOS.map(video => (
            <div key={video.id} data-id={video.id}>
              <EpisodeChip
                video={video}
                isActive={activeId === video.id}
                isWatched={watched.has(video.id)}
                onClick={handleSelect}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{
        flex:          1,
        display:       "flex",
        flexDirection: isMobile ? "column" : "row",
        overflow:      isMobile ? "auto" : "hidden",
        minHeight:     0,
      }}>

        {/* ── Desktop sidebar ── */}
        {!isMobile && (
          <div style={{
            width:         300,
            flexShrink:    0,
            borderRight:   "1px solid rgba(255,255,255,0.06)",
            display:       "flex",
            flexDirection: "column",
            overflow:      "hidden",
          }}>
            <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>Course</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Getting Started with CheckPeak</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>7 episodes · ~26 min total</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {VIDEOS.map(video => (
                <EpisodeRow
                  key={video.id}
                  video={video}
                  isActive={activeId === video.id}
                  isWatched={watched.has(video.id)}
                  onClick={handleSelect}
                />
              ))}
            </div>
            <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 6, fontWeight: 600 }}>Need more help?</div>
              <a href="mailto:support@checkpeak.com" style={{ fontSize: 12, color: "#4FABFF", textDecoration: "none", fontWeight: 600 }}>
                support@checkpeak.com →
              </a>
            </div>
          </div>
        )}

        {/* ── Video + info area ── */}
        <div style={{
          flex:          1,
          display:       "flex",
          flexDirection: "column",
          minWidth:      0,
          minHeight:     0,
        }}>

          {active && !active.comingSoon ? (
            <>
              {/* Video player — aspect ratio wrapper */}
              <div style={{
                position:      "relative",
                width:         "100%",
                paddingBottom: "56.25%",
                background:    "#000",
                flexShrink:    0,
              }}>
                <iframe
                  key={active.embedId}
                  src={getLoomEmbed(active.embedId)}
                  frameBorder="0"
                  allowFullScreen
                  allow="fullscreen"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  title={active.title}
                />
              </div>

              {/* Info strip */}
              <div style={{
                padding:    isMobile ? "16px" : "20px 28px",
                borderTop:  "1px solid rgba(255,255,255,0.06)",
                background: "#0D1120",
                flexShrink: 0,
              }}>
                {/* Tags row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{
                    fontSize:      9,
                    fontWeight:    800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color:         accent,
                    background:    accent + "18",
                    border:        `1px solid ${accent}33`,
                    borderRadius:  20,
                    padding:       "3px 10px",
                  }}>
                    {active.category}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
                    Episode {active.episode} · {active.duration}
                    {episodeIndex > 0 && ` · ${episodeIndex} of ${available.length}`}
                  </span>
                </div>

                {/* Title + desc */}
                <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                  {active.title}
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  {active.desc}
                </p>

                {/* Navigation */}
                <div style={{ display: "flex", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={!hasPrev}
                    style={{
                      flex:         isMobile ? "1 1 auto" : "0 0 auto",
                      padding:      "10px 16px",
                      borderRadius: 8,
                      background:   hasPrev ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                      border:       "1px solid rgba(255,255,255,0.1)",
                      color:        hasPrev ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                      fontSize:     13,
                      fontWeight:   600,
                      cursor:       hasPrev ? "pointer" : "not-allowed",
                    }}
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!hasNext}
                    style={{
                      flex:         isMobile ? "1 1 auto" : "0 0 auto",
                      padding:      "10px 20px",
                      borderRadius: 8,
                      background:   hasNext ? accent : "rgba(255,255,255,0.05)",
                      border:       `1px solid ${hasNext ? accent : "rgba(255,255,255,0.08)"}`,
                      color:        hasNext ? "#000" : "rgba(255,255,255,0.2)",
                      fontSize:     13,
                      fontWeight:   800,
                      cursor:       hasNext ? "pointer" : "not-allowed",
                      boxShadow:    hasNext ? `0 0 16px ${accent}44` : "none",
                    }}
                  >
                    Next Episode →
                  </button>

                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex:           isMobile ? "1 1 100%" : "0 0 auto",
                      fontSize:       12,
                      color:          "rgba(255,255,255,0.2)",
                      textDecoration: "none",
                      fontWeight:     500,
                      textAlign:      isMobile ? "center" : "left",
                      padding:        isMobile ? "8px 0" : "0",
                    }}
                  >
                    Open in Loom ↗
                  </a>
                </div>

                {/* Mobile support link */}
                {isMobile && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Questions? </span>
                    <a href="mailto:support@checkpeak.com" style={{ fontSize: 12, color: "#4FABFF", textDecoration: "none", fontWeight: 600 }}>
                      support@checkpeak.com
                    </a>
                  </div>
                )}
              </div>
            </>

          ) : (
            /* Coming soon */
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
              <div style={{ textAlign: "center", maxWidth: 380 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
                  Episode {active?.episode} · Coming soon
                </div>
                <h3 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: "#fff", marginBottom: 10, letterSpacing: "-0.3px" }}>
                  {active?.title}
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 24 }}>
                  {active?.desc}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <a
                    href="mailto:support@checkpeak.com?subject=Question about Nutrition"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, background: "#4FABFF", color: "#000", fontSize: 13, fontWeight: 800, textDecoration: "none" }}
                  >
                    Contact support
                  </a>
                  {hasNext && (
                    <button
                      type="button"
                      onClick={handleNext}
                      style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Skip to next episode →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}