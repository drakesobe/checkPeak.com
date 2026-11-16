// API middleware: forged sessions must never reach a route.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";
import { coachSession } from "../helpers/http";

const BASE = "http://localhost:3000";
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const forged = { email: "attacker@x.edu", role: "Organization", Token: "ORG-VICTIM" };

function req(path, { method = "GET", cookie, body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (cookie) h.set("cookie", `user=${cookie}`);
  let payload;
  if (body !== undefined) {
    payload = typeof body === "string" ? body : JSON.stringify(body);
    h.set("content-type", "application/json");
    h.set("content-length", String(Buffer.byteLength(payload)));
  }
  return new NextRequest(new URL(path, BASE), { method, headers: h, body: payload });
}

const forwardedCookie = (res) => res.headers.get("x-middleware-request-cookie") ?? "";

describe("middleware", () => {
  it("only runs on API routes", () => {
    expect(config.matcher).toBe("/api/:path*");
  });

  it("passes a valid signed cookie through untouched", async () => {
    const res = await middleware(req("/api/org/today", { cookie: enc(await coachSession()) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-override-headers")).toBeNull();
  });

  it("strips a forged cookie so the route sees a signed-out request", async () => {
    const res = await middleware(req("/api/org/today", { headers: { cookie: `theme=dark; user=${enc(forged)}` } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-override-headers")).toContain("cookie");
    expect(res.headers.has("x-middleware-request-cookie")).toBe(true);
    expect(forwardedCookie(res)).toBe("theme=dark"); // other cookies survive, the forged session doesn't
    expect(res.headers.get("set-cookie")).toMatch(/user=;/);
  });

  it("rejects a forged mobile session in the query string with 401", async () => {
    const res = await middleware(req(`/api/org/today?_authUser=${enc(forged)}`));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("session_invalid");
  });

  it("accepts a valid mobile session in the query string", async () => {
    const res = await middleware(req(`/api/org/today?_authUser=${enc(await coachSession())}`));
    expect(res.status).toBe(200);
  });

  it("rejects a forged session in a JSON body (string or object form)", async () => {
    for (const _authUser of [JSON.stringify(forged), forged]) {
      const res = await middleware(req("/api/org/reviewQueue/reviewQueueUpdate", { method: "POST", body: { _authUser, id: "x" } }));
      expect(res.status).toBe(401);
    }
  });

  it("accepts a valid session in a JSON body", async () => {
    const res = await middleware(req("/api/x", { method: "POST", body: { _authUser: JSON.stringify(await coachSession()) } }));
    expect(res.status).toBe(200);
  });

  it("never reads webhook bodies (raw-body signature checks depend on it)", async () => {
    const res = await middleware(req("/api/stripe/webhook", { method: "POST", body: { _authUser: JSON.stringify(forged) } }));
    expect(res.status).toBe(200);
  });

  it("ignores bodies that aren't JSON objects", async () => {
    const res = await middleware(req("/api/x", { method: "POST", body: "not json" }));
    expect(res.status).toBe(200);
  });
});
