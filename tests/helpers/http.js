// tests/helpers/http.js
// Minimal Next.js API request/response doubles, plus signed-session builders.
import { signSession } from "@/lib/session";

export function mockReq({ method = "GET", query = {}, body = undefined, cookies = {}, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
  return {
    method,
    query,
    body,
    cookies: Object.fromEntries(Object.entries(cookies)),
    headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}), ...headers },
  };
}

export function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    send(payload) { res.body = payload; return res; },
    end(payload) { res.body = payload; return res; },
    setHeader(k, v) { res.headers[k.toLowerCase()] = v; return res; },
    getHeader(k) { return res.headers[k.toLowerCase()]; },
  };
  return res;
}

export async function callApi(handler, reqInit) {
  const req = mockReq(reqInit);
  const res = mockRes();
  await handler(req, res);
  return res;
}

// Signed sessions shaped like /api/lookupUser output
export async function coachSession({ email = "coach@state.edu", orgId = "org-1", token = "ORG-AAA111-BBB222", role = "Organization", name = "Coach Carter" } = {}) {
  const [s] = await signSession({ email, name, role, orgId, Token: token, orgToken: token });
  return s;
}

export async function athleteSession({ email = "athlete@state.edu", athleteToken = "ATH-111", token = "ORG-AAA111-BBB222", name = "Jordan Ellis" } = {}) {
  const [s] = await signSession({ email, name, role: "Athlete", athlete_token: athleteToken, Token: token });
  return s;
}

export const asCookie = (session) => ({ user: JSON.stringify(session) });
