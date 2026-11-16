// middleware.js
// Session checkpoint for every API route. A session (cookie `user`, `_authUser` query param, or
// `_authUser` in a JSON body) must carry a valid signature (lib/session.js).
//   - Invalid cookie session (web): removed before the route runs, so the request is simply
//     signed-out. Protected routes refuse it; public routes (scanner, pricing data) still work.
//   - Invalid query or body session (mobile app only): rejected with 401; the app then signs out.
// Upload routes that read `_authUser` from multipart form fields verify it themselves.

import { NextResponse } from "next/server";
import { verifySession, parseSessionString } from "@/lib/session";

// Raw-body webhooks: never touch the request body
const SKIP_BODY = [/^\/api\/stripe\/webhook/, /^\/api\/webhooks\//, /^\/api\/mux\/webhook/];
const MAX_BODY_INSPECT = 2 * 1024 * 1024;

function clearCookieHeader(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("user="))
    .join("; ");
}

function unauthorized() {
  const res = NextResponse.json(
    { error: "Your session has expired. Please sign in again.", code: "session_invalid" },
    { status: 401 },
  );
  res.cookies.set("user", "", { path: "/", maxAge: 0 });
  return res;
}

export async function middleware(req) {
  const url = req.nextUrl;
  let dropCookie = false;

  const cookieRaw = req.cookies.get("user")?.value;
  if (cookieRaw) {
    const obj = parseSessionString(cookieRaw);
    if (!obj || !(await verifySession(obj))) dropCookie = true;
  }

  // Query sessions come only from the mobile app. Next.js re-merges the original query on rewrite,
  // so an invalid one can't be stripped: refuse it (the app signs the user out on 401).
  const queryRaw = url.searchParams.get("_authUser");
  if (queryRaw) {
    const obj = parseSessionString(queryRaw);
    if (!obj || !(await verifySession(obj))) return unauthorized();
  }

  const method = req.method.toUpperCase();
  const type = req.headers.get("content-type") || "";
  const length = Number(req.headers.get("content-length") || 0);
  if (
    method !== "GET" && method !== "HEAD" && type.includes("application/json")
    && length <= MAX_BODY_INSPECT && !SKIP_BODY.some((re) => re.test(url.pathname))
  ) {
    try {
      const body = await req.clone().json();
      if (body && typeof body === "object" && body._authUser != null && body._authUser !== "") {
        const obj = typeof body._authUser === "object" ? body._authUser : parseSessionString(body._authUser);
        if (!obj || !(await verifySession(obj))) return unauthorized();
      }
    } catch { /* not JSON or empty: nothing to check */ }
  }

  if (!dropCookie) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set("cookie", clearCookieHeader(req.headers.get("cookie") || ""));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set("user", "", { path: "/", maxAge: 0 });
  return res;
}

export const config = { matcher: "/api/:path*" };
