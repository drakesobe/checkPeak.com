// lib/sportStats.js
// Sport stat definitions — fields, aggregation rules, computed stats, display keys.
// Shared between the stats page, API, and recruit page.

// ── Football position groups ───────────────────────────────────────────────────

export const FOOTBALL_GROUPS = {
  qb: {
    label: "QB",
    match: (pos) => /^qb$/i.test(String(pos || "").trim()),
    fields: [
      { key: "comp",     label: "Comp",       type: "int",     agg: "sum" },
      { key: "att",      label: "Att",        type: "int",     agg: "sum" },
      { key: "pass_yds", label: "Pass Yds",   type: "int",     agg: "sum" },
      { key: "pass_td",  label: "Pass TD",    type: "int",     agg: "sum" },
      { key: "int",      label: "INT",        type: "int",     agg: "sum" },
      { key: "rush_att", label: "Rush Att",   type: "int",     agg: "sum" },
      { key: "rush_yds", label: "Rush Yds",   type: "int",     agg: "sum" },
      { key: "rush_td",  label: "Rush TD",    type: "int",     agg: "sum" },
      { key: "sacked",   label: "Sacked",     type: "int",     agg: "sum" },
    ],
    computed: [
      { key: "comp_pct", label: "Comp%",  fn: (t) => t.att  ? ((t.comp / t.att) * 100).toFixed(1) + "%" : "—" },
      { key: "ypa",      label: "YPA",    fn: (t) => t.att  ? (t.pass_yds / t.att).toFixed(1) : "—" },
      { key: "td_int",   label: "TD:INT", fn: (t) => `${t.pass_td || 0}:${t.int || 0}` },
    ],
    display: ["comp_pct", "pass_yds", "pass_td", "int", "rush_yds", "rush_td"],
  },
  skill: {
    label: "Skill (RB / WR / TE)",
    match: (pos) => /^(rb|hb|fb|wr|te|sb|slot|flex|atp|h-back)$/i.test(String(pos || "").trim()),
    fields: [
      { key: "rush_att", label: "Rush Att",  type: "int", agg: "sum" },
      { key: "rush_yds", label: "Rush Yds",  type: "int", agg: "sum" },
      { key: "rush_td",  label: "Rush TD",   type: "int", agg: "sum" },
      { key: "rec",      label: "Rec",       type: "int", agg: "sum" },
      { key: "targets",  label: "Targets",   type: "int", agg: "sum" },
      { key: "rec_yds",  label: "Rec Yds",   type: "int", agg: "sum" },
      { key: "rec_td",   label: "Rec TD",    type: "int", agg: "sum" },
      { key: "fumbles",  label: "Fumbles",   type: "int", agg: "sum" },
    ],
    computed: [
      { key: "ypc",  label: "YPC",  fn: (t) => t.rush_att ? (t.rush_yds / t.rush_att).toFixed(1) : "—" },
      { key: "ypr",  label: "YPR",  fn: (t) => t.rec ? (t.rec_yds / t.rec).toFixed(1) : "—" },
      { key: "yfs",  label: "Total Yds", fn: (t) => String((t.rush_yds || 0) + (t.rec_yds || 0)) },
    ],
    display: ["rush_yds", "rush_td", "rec", "rec_yds", "rec_td"],
  },
  oline: {
    label: "OL",
    match: (pos) => /^(ol|c|g|og|t|ot|lt|rt|lg|rg|center|guard|tackle)$/i.test(String(pos || "").trim()),
    fields: [
      { key: "pancakes",      label: "Pancakes",       type: "int", agg: "sum" },
      { key: "sacks_allowed", label: "Sacks Allowed",  type: "int", agg: "sum" },
      { key: "penalties",     label: "Penalties",      type: "int", agg: "sum" },
    ],
    computed: [],
    display: ["pancakes", "sacks_allowed", "penalties"],
  },
  defense: {
    label: "Defense",
    match: (pos) => /^(lb|mlb|olb|ilb|de|dt|nt|dl|cb|s|fs|ss|db|nickel|dime|rover|linebacker|cornerback|safety)$/i.test(String(pos || "").trim()),
    fields: [
      { key: "tackles",     label: "Tackles",        type: "int",     agg: "sum" },
      { key: "solo",        label: "Solo",           type: "int",     agg: "sum" },
      { key: "ast",         label: "Assisted",       type: "int",     agg: "sum" },
      { key: "sacks",       label: "Sacks",          type: "decimal", agg: "sum" },
      { key: "tfl",         label: "TFL",            type: "decimal", agg: "sum" },
      { key: "int",         label: "INTs",           type: "int",     agg: "sum" },
      { key: "int_td",      label: "INT TD",         type: "int",     agg: "sum" },
      { key: "pbu",         label: "PBU",            type: "int",     agg: "sum" },
      { key: "ff",          label: "Forced Fumb.",   type: "int",     agg: "sum" },
      { key: "fr",          label: "Fumble Rec",     type: "int",     agg: "sum" },
      { key: "qb_hurries",  label: "QB Hurries",     type: "int",     agg: "sum" },
    ],
    computed: [],
    display: ["tackles", "sacks", "tfl", "int", "pbu", "ff"],
  },
  kicker: {
    label: "K / P",
    match: (pos) => /^(k|pk|p|punter|kicker|ls|long.snapper)$/i.test(String(pos || "").trim()),
    fields: [
      { key: "fg_att",    label: "FG Att",      type: "int", agg: "sum" },
      { key: "fg_made",   label: "FG Made",     type: "int", agg: "sum" },
      { key: "fg_long",   label: "FG Long",     type: "int", agg: "max" },
      { key: "xp_att",    label: "XP Att",      type: "int", agg: "sum" },
      { key: "xp_made",   label: "XP Made",     type: "int", agg: "sum" },
      { key: "punts",     label: "Punts",       type: "int", agg: "sum" },
      { key: "punt_yds",  label: "Punt Yds",    type: "int", agg: "sum" },
      { key: "punt_long", label: "Punt Long",   type: "int", agg: "max" },
      { key: "tb",        label: "Touchbacks",  type: "int", agg: "sum" },
    ],
    computed: [
      { key: "fg_pct",   label: "FG%",      fn: (t) => t.fg_att ? ((t.fg_made / t.fg_att) * 100).toFixed(1) + "%" : "—" },
      { key: "punt_avg", label: "Punt Avg", fn: (t) => t.punts  ? (t.punt_yds / t.punts).toFixed(1) : "—" },
    ],
    display: ["fg_made", "fg_att", "fg_long", "punt_avg", "punt_long"],
  },
};

// ── Main sport config ──────────────────────────────────────────────────────────

export const SPORT_STATS = {

  football: {
    type: "grouped",
    gameLabel: "Game",
    groups: FOOTBALL_GROUPS,
    gameFields: [
      { key: "game_date",  label: "Date",       type: "date",   required: true },
      { key: "opponent",   label: "Opponent",   type: "text" },
      { key: "location",   label: "Location",   type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",     type: "select", options: ["W", "L", "T"] },
      { key: "team_score", label: "Our Score",  type: "int" },
      { key: "opp_score",  label: "Their Score",type: "int" },
    ],
  },

  basketball: {
    type: "flat",
    gameLabel: "Game",
    gameFields: [
      { key: "game_date",  label: "Date",       type: "date",   required: true },
      { key: "opponent",   label: "Opponent",   type: "text" },
      { key: "location",   label: "Location",   type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",     type: "select", options: ["W", "L"] },
      { key: "team_score", label: "Our Score",  type: "int" },
      { key: "opp_score",  label: "Their Score",type: "int" },
    ],
    fields: [
      { key: "min",   label: "Minutes",   type: "int", agg: "sum" },
      { key: "pts",   label: "Points",    type: "int", agg: "sum" },
      { key: "reb",   label: "Rebounds",  type: "int", agg: "sum" },
      { key: "oreb",  label: "Off Reb",   type: "int", agg: "sum" },
      { key: "dreb",  label: "Def Reb",   type: "int", agg: "sum" },
      { key: "ast",   label: "Assists",   type: "int", agg: "sum" },
      { key: "stl",   label: "Steals",    type: "int", agg: "sum" },
      { key: "blk",   label: "Blocks",    type: "int", agg: "sum" },
      { key: "tov",   label: "Turnovers", type: "int", agg: "sum" },
      { key: "fgm",   label: "FGM",       type: "int", agg: "sum" },
      { key: "fga",   label: "FGA",       type: "int", agg: "sum" },
      { key: "fg3m",  label: "3PM",       type: "int", agg: "sum" },
      { key: "fg3a",  label: "3PA",       type: "int", agg: "sum" },
      { key: "ftm",   label: "FTM",       type: "int", agg: "sum" },
      { key: "fta",   label: "FTA",       type: "int", agg: "sum" },
      { key: "fouls", label: "Fouls",     type: "int", agg: "sum" },
    ],
    computed: [
      { key: "fg_pct",  label: "FG%",  fn: (t) => t.fga  ? ((t.fgm  / t.fga)  * 100).toFixed(1) + "%" : "—" },
      { key: "fg3_pct", label: "3PT%", fn: (t) => t.fg3a ? ((t.fg3m / t.fg3a) * 100).toFixed(1) + "%" : "—" },
      { key: "ft_pct",  label: "FT%",  fn: (t) => t.fta  ? ((t.ftm  / t.fta)  * 100).toFixed(1) + "%" : "—" },
    ],
    display: ["pts", "reb", "ast", "stl", "blk", "fg_pct", "fg3_pct"],
    avgFields: ["pts", "reb", "ast", "stl", "blk", "tov"],
  },

  baseball: {
    type: "role",
    gameLabel: "Game",
    gameFields: [
      { key: "game_date",  label: "Date",       type: "date",   required: true },
      { key: "opponent",   label: "Opponent",   type: "text" },
      { key: "location",   label: "Location",   type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",     type: "select", options: ["W", "L", "T"] },
    ],
    roles: {
      hitter: {
        label: "Hitter",
        fields: [
          { key: "ab",      label: "AB",   type: "int", agg: "sum" },
          { key: "h",       label: "H",    type: "int", agg: "sum" },
          { key: "doubles", label: "2B",   type: "int", agg: "sum" },
          { key: "triples", label: "3B",   type: "int", agg: "sum" },
          { key: "hr",      label: "HR",   type: "int", agg: "sum" },
          { key: "rbi",     label: "RBI",  type: "int", agg: "sum" },
          { key: "r",       label: "R",    type: "int", agg: "sum" },
          { key: "bb",      label: "BB",   type: "int", agg: "sum" },
          { key: "hbp",     label: "HBP",  type: "int", agg: "sum" },
          { key: "so",      label: "K",    type: "int", agg: "sum" },
          { key: "sb",      label: "SB",   type: "int", agg: "sum" },
          { key: "cs",      label: "CS",   type: "int", agg: "sum" },
          { key: "e",       label: "E",    type: "int", agg: "sum" },
        ],
        computed: [
          { key: "avg", label: "AVG", fn: (t) => t.ab ? (t.h / t.ab).toFixed(3).replace(/^0/, "") : ".000" },
          { key: "obp", label: "OBP", fn: (t) => {
              const pa = (t.ab || 0) + (t.bb || 0) + (t.hbp || 0);
              return pa ? (((t.h || 0) + (t.bb || 0) + (t.hbp || 0)) / pa).toFixed(3).replace(/^0/, "") : ".000";
            }},
          { key: "slg", label: "SLG", fn: (t) => {
              if (!t.ab) return ".000";
              const tb = (t.h || 0) + (t.doubles || 0) + 2 * (t.triples || 0) + 3 * (t.hr || 0);
              return (tb / t.ab).toFixed(3).replace(/^0/, "");
            }},
          { key: "ops", label: "OPS", fn: (t) => {
              if (!t.ab) return ".000";
              const pa = (t.ab || 0) + (t.bb || 0) + (t.hbp || 0);
              const obp = pa ? ((t.h || 0) + (t.bb || 0) + (t.hbp || 0)) / pa : 0;
              const tb  = (t.h || 0) + (t.doubles || 0) + 2 * (t.triples || 0) + 3 * (t.hr || 0);
              const slg = t.ab ? tb / t.ab : 0;
              return (obp + slg).toFixed(3).replace(/^0/, "");
            }},
        ],
        display: ["avg", "obp", "slg", "hr", "rbi", "sb"],
      },
      pitcher: {
        label: "Pitcher",
        fields: [
          { key: "ip",        label: "IP",        type: "decimal", agg: "sum" },
          { key: "h",         label: "H",         type: "int",     agg: "sum" },
          { key: "r",         label: "R",         type: "int",     agg: "sum" },
          { key: "er",        label: "ER",        type: "int",     agg: "sum" },
          { key: "bb",        label: "BB",        type: "int",     agg: "sum" },
          { key: "so",        label: "K",         type: "int",     agg: "sum" },
          { key: "hr",        label: "HR",        type: "int",     agg: "sum" },
          { key: "np",        label: "Pitches",   type: "int",     agg: "sum" },
          { key: "decision",  label: "Decision",  type: "select",  options: ["W", "L", "S", "BS", "ND"] },
        ],
        computed: [
          { key: "era",  label: "ERA",  fn: (t) => t.ip ? ((t.er || 0) * 9 / t.ip).toFixed(2) : "—" },
          { key: "whip", label: "WHIP", fn: (t) => t.ip ? (((t.bb || 0) + (t.h || 0)) / t.ip).toFixed(2) : "—" },
          { key: "k9",   label: "K/9",  fn: (t) => t.ip ? ((t.so || 0) * 9 / t.ip).toFixed(1) : "—" },
        ],
        display: ["era", "whip", "k9", "so", "bb"],
      },
    },
  },

  soccer: {
    type: "flat",
    gameLabel: "Match",
    gameFields: [
      { key: "game_date",  label: "Date",          type: "date",   required: true },
      { key: "opponent",   label: "Opponent",      type: "text" },
      { key: "location",   label: "Location",      type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",        type: "select", options: ["W", "L", "D"] },
      { key: "team_score", label: "Goals For",     type: "int" },
      { key: "opp_score",  label: "Goals Against", type: "int" },
    ],
    fields: [
      { key: "goals",    label: "Goals",           type: "int",      agg: "sum" },
      { key: "assists",  label: "Assists",         type: "int",      agg: "sum" },
      { key: "shots",    label: "Shots",           type: "int",      agg: "sum" },
      { key: "sot",      label: "Shots on Target", type: "int",      agg: "sum" },
      { key: "saves",    label: "Saves (GK)",      type: "int",      agg: "sum" },
      { key: "cs",       label: "Clean Sheet (GK)",type: "checkbox", agg: "sum" },
      { key: "min",      label: "Minutes",         type: "int",      agg: "sum" },
      { key: "fouls",    label: "Fouls",           type: "int",      agg: "sum" },
      { key: "yc",       label: "Yellow Card",     type: "checkbox", agg: "sum" },
      { key: "rc",       label: "Red Card",        type: "checkbox", agg: "sum" },
    ],
    computed: [
      { key: "shot_acc", label: "Shot Acc%", fn: (t) => t.shots ? ((t.sot || 0) / t.shots * 100).toFixed(0) + "%" : "—" },
    ],
    display: ["goals", "assists", "shots", "sot", "saves"],
    avgFields: ["goals", "assists", "shots"],
  },

  track: {
    type: "events",
    gameLabel: "Meet",
    gameFields: [
      { key: "game_date", label: "Date",      type: "date", required: true },
      { key: "opponent",  label: "Meet Name", type: "text" },
      { key: "location",  label: "Location",  type: "text" },
    ],
    eventOptions: [
      "100m", "200m", "400m", "800m", "1600m", "3200m",
      "110m Hurdles", "100m Hurdles", "300m Hurdles", "400m Hurdles",
      "4×100m Relay", "4×400m Relay",
      "Long Jump", "Triple Jump", "High Jump", "Pole Vault",
      "Shot Put", "Discus", "Javelin", "Hammer",
      "Decathlon", "Heptathlon", "Pentathlon",
    ],
    // mark type per event — used for placeholder text
    markHints: {
      "100m": "10.85", "200m": "21.2", "400m": "48.5",
      "800m": "1:58.4", "1600m": "4:32.1", "3200m": "9:45.0",
      "Long Jump": `21'4"`, "Triple Jump": `44'2"`,
      "High Jump": `6'2"`, "Pole Vault": `14'6"`,
      "Shot Put": `52'8"`, "Discus": `145'6"`,
      "Javelin": `165'0"`, "Hammer": `180'3"`,
    },
  },

  swimming: {
    type: "events",
    gameLabel: "Meet",
    gameFields: [
      { key: "game_date", label: "Date",      type: "date", required: true },
      { key: "opponent",  label: "Meet Name", type: "text" },
      { key: "location",  label: "Location",  type: "text" },
    ],
    eventOptions: [
      "50 Free", "100 Free", "200 Free", "400 Free", "500 Free", "1000 Free", "1650 Free",
      "100 Back", "200 Back",
      "100 Breast", "200 Breast",
      "100 Fly", "200 Fly",
      "200 IM", "400 IM",
      "200 Free Relay", "400 Free Relay", "800 Free Relay",
      "200 Medley Relay", "400 Medley Relay",
    ],
    markHints: {
      "50 Free": "22.1", "100 Free": "48.5", "200 Free": "1:47.2",
      "100 Back": "53.4", "100 Breast": "1:02.3",
      "100 Fly": "52.8", "200 IM": "1:58.6",
    },
  },

  volleyball: {
    type: "flat",
    gameLabel: "Match",
    gameFields: [
      { key: "game_date",   label: "Date",         type: "date",   required: true },
      { key: "opponent",    label: "Opponent",     type: "text" },
      { key: "location",    label: "Location",     type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",      label: "Result",       type: "select", options: ["W", "L"] },
      { key: "sets_played", label: "Sets Played",  type: "int" },
    ],
    fields: [
      { key: "kills",     label: "Kills",          type: "int", agg: "sum" },
      { key: "errors",    label: "Errors",         type: "int", agg: "sum" },
      { key: "att",       label: "Attack Att",     type: "int", agg: "sum" },
      { key: "aces",      label: "Aces",           type: "int", agg: "sum" },
      { key: "svc_err",   label: "Service Errors", type: "int", agg: "sum" },
      { key: "digs",      label: "Digs",           type: "int", agg: "sum" },
      { key: "blocks",    label: "Solo Blocks",    type: "int", agg: "sum" },
      { key: "blk_ast",   label: "Block Assists",  type: "int", agg: "sum" },
      { key: "rec_att",   label: "Reception Att",  type: "int", agg: "sum" },
      { key: "rec_err",   label: "Reception Err",  type: "int", agg: "sum" },
      { key: "pts",       label: "Points",         type: "int", agg: "sum" },
    ],
    computed: [
      { key: "hit_pct", label: "Hit%", fn: (t) => t.att ? (((t.kills || 0) - (t.errors || 0)) / t.att).toFixed(3).replace(/^0/, "") : ".000" },
    ],
    display: ["kills", "hit_pct", "aces", "digs", "blocks"],
    avgFields: ["kills", "aces", "digs"],
  },

  wrestling: {
    type: "flat",
    gameLabel: "Match",
    gameFields: [
      { key: "game_date",    label: "Date",              type: "date",   required: true },
      { key: "opponent",     label: "Opponent Name",     type: "text" },
      { key: "meet_name",    label: "Meet / Tournament", type: "text" },
      { key: "weight_class", label: "Weight Class",      type: "text" },
      { key: "result",       label: "Result",            type: "select", options: ["W", "L"] },
      { key: "method",       label: "Method",            type: "select", options: ["Pin", "Technical Fall", "Major Decision", "Decision", "Forfeit", "DQ", "Medical"] },
      { key: "pin_time",     label: "Pin Time",          type: "text" },
    ],
    fields: [
      { key: "pts_scored",  label: "Points Scored",  type: "int", agg: "sum" },
      { key: "pts_allowed", label: "Points Allowed", type: "int", agg: "sum" },
      { key: "takedowns",   label: "Takedowns",      type: "int", agg: "sum" },
      { key: "escapes",     label: "Escapes",        type: "int", agg: "sum" },
      { key: "reversals",   label: "Reversals",      type: "int", agg: "sum" },
      { key: "near_falls",  label: "Near Falls",     type: "int", agg: "sum" },
    ],
    computed: [],
    display: ["pts_scored", "takedowns", "escapes"],
  },

  lacrosse: {
    type: "role",
    gameLabel: "Game",
    gameFields: [
      { key: "game_date",  label: "Date",       type: "date",   required: true },
      { key: "opponent",   label: "Opponent",   type: "text" },
      { key: "location",   label: "Location",   type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",     type: "select", options: ["W", "L", "T"] },
      { key: "team_score", label: "Our Score",  type: "int" },
      { key: "opp_score",  label: "Their Score",type: "int" },
    ],
    roles: {
      field: {
        label: "Field Player",
        fields: [
          { key: "goals",     label: "Goals",       type: "int", agg: "sum" },
          { key: "assists",   label: "Assists",     type: "int", agg: "sum" },
          { key: "shots",     label: "Shots",       type: "int", agg: "sum" },
          { key: "sog",       label: "SOG",         type: "int", agg: "sum" },
          { key: "gb",        label: "Ground Balls",type: "int", agg: "sum" },
          { key: "to",        label: "Turnovers",   type: "int", agg: "sum" },
          { key: "caused_to", label: "Caused TO",   type: "int", agg: "sum" },
          { key: "fow",       label: "Faceoff W",   type: "int", agg: "sum" },
          { key: "fol",       label: "Faceoff L",   type: "int", agg: "sum" },
        ],
        computed: [
          { key: "pts", label: "Pts", fn: (t) => String((t.goals || 0) + (t.assists || 0)) },
        ],
        display: ["goals", "assists", "shots", "gb", "caused_to"],
      },
      goalie: {
        label: "Goalie",
        fields: [
          { key: "saves", label: "Saves",         type: "int", agg: "sum" },
          { key: "ga",    label: "Goals Against", type: "int", agg: "sum" },
          { key: "gb",    label: "Ground Balls",  type: "int", agg: "sum" },
        ],
        computed: [
          { key: "sv_pct", label: "Sv%", fn: (t) => {
              const shots = (t.saves || 0) + (t.ga || 0);
              return shots ? ((t.saves || 0) / shots * 100).toFixed(1) + "%" : "—";
            }},
        ],
        display: ["saves", "ga", "sv_pct"],
      },
    },
  },

  hockey: {
    type: "role",
    gameLabel: "Game",
    gameFields: [
      { key: "game_date",  label: "Date",       type: "date",   required: true },
      { key: "opponent",   label: "Opponent",   type: "text" },
      { key: "location",   label: "Location",   type: "select", options: ["Home", "Away", "Neutral"] },
      { key: "result",     label: "Result",     type: "select", options: ["W", "L", "OT"] },
      { key: "team_score", label: "Our Score",  type: "int" },
      { key: "opp_score",  label: "Their Score",type: "int" },
    ],
    roles: {
      skater: {
        label: "Skater",
        fields: [
          { key: "goals",   label: "Goals",       type: "int",     agg: "sum" },
          { key: "assists", label: "Assists",     type: "int",     agg: "sum" },
          { key: "sog",     label: "SOG",         type: "int",     agg: "sum" },
          { key: "pm",      label: "+/-",         type: "int",     agg: "sum" },
          { key: "pim",     label: "PIM",         type: "int",     agg: "sum" },
          { key: "hits",    label: "Hits",        type: "int",     agg: "sum" },
          { key: "blocks",  label: "Blocks",      type: "int",     agg: "sum" },
          { key: "toi",     label: "TOI (min)",   type: "decimal", agg: "sum" },
        ],
        computed: [
          { key: "pts", label: "Pts", fn: (t) => String((t.goals || 0) + (t.assists || 0)) },
        ],
        display: ["goals", "assists", "pts", "pm", "sog"],
      },
      goalie: {
        label: "Goalie",
        fields: [
          { key: "saves", label: "Saves",         type: "int",     agg: "sum" },
          { key: "ga",    label: "Goals Against", type: "int",     agg: "sum" },
          { key: "sa",    label: "Shots Against", type: "int",     agg: "sum" },
          { key: "toi",   label: "TOI (min)",     type: "decimal", agg: "sum" },
          { key: "so",    label: "Shutout",       type: "checkbox",agg: "sum" },
        ],
        computed: [
          { key: "sv_pct", label: "Sv%", fn: (t) => t.sa ? ((t.saves || 0) / t.sa).toFixed(3).replace(/^0/, "") : ".000" },
          { key: "gaa",    label: "GAA", fn: (t) => t.toi ? ((t.ga || 0) / t.toi * 60).toFixed(2) : "—" },
        ],
        display: ["saves", "ga", "sv_pct", "gaa"],
      },
    },
  },

  tennis: {
    type: "flat",
    gameLabel: "Match",
    gameFields: [
      { key: "game_date",       label: "Date",       type: "date",   required: true },
      { key: "opponent",        label: "Opponent",   type: "text" },
      { key: "tournament",      label: "Tournament", type: "text" },
      { key: "surface",         label: "Surface",    type: "select", options: ["Hard", "Clay", "Grass", "Indoor"] },
      { key: "singles_doubles", label: "Format",     type: "select", options: ["Singles", "Doubles"] },
      { key: "result",          label: "Result",     type: "select", options: ["W", "L"] },
      { key: "score",           label: "Score",      type: "text" },
    ],
    fields: [
      { key: "aces",       label: "Aces",            type: "int", agg: "sum" },
      { key: "dbl_faults", label: "Double Faults",   type: "int", agg: "sum" },
      { key: "first_in",   label: "1st Serve In",    type: "int", agg: "sum" },
      { key: "first_att",  label: "1st Serve Att",   type: "int", agg: "sum" },
      { key: "first_won",  label: "1st Serve Won",   type: "int", agg: "sum" },
      { key: "second_won", label: "2nd Serve Won",   type: "int", agg: "sum" },
      { key: "second_att", label: "2nd Serve Att",   type: "int", agg: "sum" },
      { key: "winners",    label: "Winners",          type: "int", agg: "sum" },
      { key: "ue",         label: "Unforced Errors",  type: "int", agg: "sum" },
      { key: "bp_faced",   label: "Break Pts Faced",  type: "int", agg: "sum" },
      { key: "bp_saved",   label: "Break Pts Saved",  type: "int", agg: "sum" },
    ],
    computed: [
      { key: "first_pct", label: "1st%",     fn: (t) => t.first_att ? ((t.first_in  || 0) / t.first_att * 100).toFixed(0) + "%" : "—" },
      { key: "first_win", label: "1st Win%", fn: (t) => t.first_in  ? ((t.first_won || 0) / t.first_in  * 100).toFixed(0) + "%" : "—" },
    ],
    display: ["aces", "winners", "ue", "first_pct"],
    avgFields: ["aces", "winners", "ue"],
  },
};

// softball is identical to baseball
SPORT_STATS.softball = SPORT_STATS.baseball;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect football position group key from a position string. */
export function getFootballGroup(position) {
  const pos = String(position || "").trim();
  if (!pos) return "skill";
  for (const [key, group] of Object.entries(FOOTBALL_GROUPS)) {
    if (group.match(pos)) return key;
  }
  return "skill";
}

/** Get the active fields array for a sport+group+role combo. */
export function getFields(sport, groupKey, roleKey) {
  const cfg = SPORT_STATS[sport];
  if (!cfg) return [];
  if (cfg.type === "grouped") return cfg.groups[groupKey]?.fields ?? [];
  if (cfg.type === "role")    return cfg.roles[roleKey]?.fields  ?? [];
  return cfg.fields ?? [];
}

/** Get the computed array for a sport+group+role combo. */
export function getComputed(sport, groupKey, roleKey) {
  const cfg = SPORT_STATS[sport];
  if (!cfg) return [];
  if (cfg.type === "grouped") return cfg.groups[groupKey]?.computed ?? [];
  if (cfg.type === "role")    return cfg.roles[roleKey]?.computed  ?? [];
  return cfg.computed ?? [];
}

/** Aggregate stats across an array of game objects. */
export function aggregateStats(games, fields) {
  const totals = {};
  for (const field of fields) {
    const vals = games.map(g => Number(g.stats?.[field.key] ?? 0)).filter(v => !isNaN(v));
    if (field.agg === "sum")      totals[field.key] = vals.reduce((a, b) => a + b, 0);
    else if (field.agg === "max") totals[field.key] = vals.length ? Math.max(...vals) : 0;
    else if (field.agg === "avg") totals[field.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    else                          totals[field.key] = vals.reduce((a, b) => a + b, 0);
  }
  return totals;
}

/** Per-game averages for summed fields. */
export function avgStats(totals, fields, gameCount) {
  if (!gameCount) return {};
  const avgs = {};
  for (const field of fields) {
    if (field.agg === "sum" && totals[field.key] != null) {
      avgs[field.key] = totals[field.key] / gameCount;
    }
  }
  return avgs;
}

export const SPORT_LABELS = {
  football:   "Football",
  basketball: "Basketball",
  baseball:   "Baseball",
  softball:   "Softball",
  soccer:     "Soccer",
  track:      "Track & Field",
  swimming:   "Swimming",
  volleyball: "Volleyball",
  wrestling:  "Wrestling",
  lacrosse:   "Lacrosse",
  hockey:     "Hockey",
  tennis:     "Tennis",
};

export const ALL_SPORTS = Object.keys(SPORT_LABELS);
