// tests/helpers/fakeSupabase.js
// In-memory stand-in for the Supabase JS client, covering the query-builder calls this codebase
// uses. Seed tables, run the code under test, then assert on db.tables.
//
//   const db = createFakeSupabase({ athletes: [{ id: "a1", email: "x@y.edu" }] });
//   vi.mock("@/lib/supabase", () => ({ supabaseAdmin: db, supabase: db }));
//
// Embedded selects ("*, organization:organizations(id, created_at)") resolve through `relations`.

let idSeq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, "0")}`;

const DEFAULT_RELATIONS = {
  "billing.organization": { table: "organizations", fk: "org_id" },
};

function likeToRegex(pattern) {
  const body = String(pattern)
    .replace(/\\([%_\\])/g, "\u0000$1")             // escaped wildcards are literal
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".")
    .replace(/\u0000(.)/g, (_, c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${body}$`, "i");
}

export function createFakeSupabase(seed = {}, { relations = DEFAULT_RELATIONS } = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const calls = [];

  function from(table) {
    tables[table] ??= [];
    const state = { table, op: "select", filters: [], order: null, limit: null, single: null, payload: null, select: "*", count: null, head: false, returning: false };

    const matches = (row) => state.filters.every((f) => f(row));
    const embed = (row) => {
      const out = { ...row };
      const re = /(\w+):(\w+)\(([^)]*)\)/g;
      let m;
      while ((m = re.exec(state.select))) {
        const rel = relations[`${table}.${m[1]}`];
        if (!rel) continue;
        const target = (tables[rel.table] || []).find((t) => t.id === row[rel.fk]);
        out[m[1]] = target ? { ...target } : null;
      }
      return out;
    };

    function run() {
      calls.push({ table, op: state.op, payload: state.payload });
      const rows = tables[table];
      let data;
      if (state.op === "insert") {
        const items = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((r) => ({ id: uuid(), created_at: new Date().toISOString(), ...r }));
        rows.push(...items);
        data = items;
      } else if (state.op === "update") {
        data = rows.filter(matches);
        data.forEach((r) => Object.assign(r, state.payload));
      } else if (state.op === "delete") {
        data = rows.filter(matches);
        tables[table] = rows.filter((r) => !matches(r));
      } else {
        data = rows.filter(matches);
        if (state.order) {
          const { col, asc } = state.order;
          data = [...data].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
        }
      }
      const count = data.length;
      if (state.limit != null) data = data.slice(0, state.limit);
      data = data.map(embed);
      if (state.op !== "select" && !state.returning) data = null;

      if (state.single) {
        const row = data?.[0] ?? null;
        if (!row && state.single === "single") return { data: null, error: { message: "No rows found", code: "PGRST116" } };
        return { data: row, error: null };
      }
      if (state.head) return { data: null, count, error: null };
      return { data, count: state.count ? count : null, error: null };
    }

    const builder = {
      select(cols = "*", opts = {}) {
        if (state.op === "select") state.select = cols; else state.returning = true;
        state.count = opts.count || null;
        state.head = Boolean(opts.head);
        return builder;
      },
      insert(payload) { state.op = "insert"; state.payload = payload; return builder; },
      update(payload) { state.op = "update"; state.payload = payload; return builder; },
      upsert(payload) { state.op = "insert"; state.payload = payload; return builder; },
      delete() { state.op = "delete"; return builder; },
      eq(col, v) { state.filters.push((r) => r[col] === v); return builder; },
      neq(col, v) { state.filters.push((r) => r[col] !== v); return builder; },
      in(col, vs) { state.filters.push((r) => vs.includes(r[col])); return builder; },
      is(col, v) { state.filters.push((r) => (v === null ? r[col] == null : r[col] === v)); return builder; },
      not(col, op, v) { state.filters.push((r) => (op === "is" && v === null ? r[col] != null : r[col] !== v)); return builder; },
      gte(col, v) { state.filters.push((r) => r[col] >= v); return builder; },
      lte(col, v) { state.filters.push((r) => r[col] <= v); return builder; },
      like(col, p) { const re = likeToRegex(p); state.filters.push((r) => re.test(String(r[col] ?? ""))); return builder; },
      ilike(col, p) { const re = likeToRegex(p); state.filters.push((r) => re.test(String(r[col] ?? ""))); return builder; },
      or(expr) {
        const parts = String(expr).split(",").map((p) => p.match(/^(\w+)\.(ilike|eq)\.(.*)$/)).filter(Boolean);
        state.filters.push((r) => parts.some(([, col, op, val]) => (op === "eq" ? String(r[col]) === val : likeToRegex(val).test(String(r[col] ?? "")))));
        return builder;
      },
      order(col, { ascending = true } = {}) { state.order = { col, asc: ascending }; return builder; },
      limit(n) { state.limit = n; return builder; },
      maybeSingle() { state.single = "maybe"; return builder; },
      single() { state.single = "single"; return builder; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
    };
    return builder;
  }

  return { from, tables, calls };
}
