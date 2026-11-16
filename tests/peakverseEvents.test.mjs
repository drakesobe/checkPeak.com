import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { organizationReference, publishPeakverseEvent } from "../lib/peakverseEvents.js";
import health from "../pages/api/peakverse-health.js";

test("disabled bridge cannot send or derive a token reference", async () => {
  const previous = process.env.PEAKVERSE_PRODUCT_SECRET;
  const before = globalThis.fetch;
  delete process.env.PEAKVERSE_PRODUCT_SECRET;
  globalThis.fetch = async () => { throw new Error("Unexpected fetch"); };
  try {
    assert.equal(organizationReference("ORG-LOCAL"), "");
    assert.deepEqual(await publishPeakverseEvent({ id: "example" }), {configured:false,ok:false});
  } finally {
    globalThis.fetch = before;
    if (previous !== undefined) process.env.PEAKVERSE_PRODUCT_SECRET = previous;
  }
});

test("connectivity check is read-only, coalesced and cached", async () => {
  const before = globalThis.fetch;
  const old = process.env.PEAKVERSE_PRODUCT_SECRET;
  process.env.PEAKVERSE_PRODUCT_SECRET = "example-test-secret-".repeat(3);
  let calls = 0;
  const makeRes = () => ({ code: 0, value: null, setHeader(){}, status(n){this.code=n;return this}, json(v){this.value=v;return this}, end(){return this} });
  try {
    globalThis.fetch = async (_, req) => {calls++; assert.deepEqual(JSON.parse(req.body), {kind:"bridge_check"});return {ok:true}};
    const a=makeRes(), b=makeRes(), c=makeRes(), wrong=makeRes();
    await Promise.all([health({method:"GET"},a),health({method:"GET"},b)]);
    await health({method:"GET"},c);
    await health({method:"POST"},wrong);
    assert.equal(calls,1); assert.equal(a.code,200); assert.deepEqual(b.value,{connected:true});assert.equal(c.code,200);assert.equal(wrong.code,405);
  } finally {
    globalThis.fetch=before;
    if(old===undefined) delete process.env.PEAKVERSE_PRODUCT_SECRET; else process.env.PEAKVERSE_PRODUCT_SECRET=old;
  }
});

test("server-side receipt signature binds exact payload and hides token", async () => {
  const previous = process.env.PEAKVERSE_PRODUCT_SECRET;
  const before = globalThis.fetch;
  const key = "fake-test-secret-".repeat(3);
  process.env.PEAKVERSE_PRODUCT_SECRET = key;
  try {
    const org_ref = organizationReference("ORG-LOCAL");
    assert.match(org_ref, /^[a-f0-9]{64}$/);
    assert.equal(org_ref, organizationReference("org-local"));
    globalThis.fetch = async (url, req) => {
      assert.equal(url, "https://peakverse-founder.onrender.com/api/product/events");
      const ts = req.headers["X-Peakverse-Product-Timestamp"];
      assert.equal(req.headers["X-Peakverse-Product-Signature"], createHmac("sha256",key).update(ts+"."+req.body).digest("hex"));
      assert.equal(JSON.parse(req.body).org_ref, org_ref);
      assert.ok(!req.body.includes("ORG-LOCAL"));
      return {ok:true,status:200};
    };
    assert.deepEqual(await publishPeakverseEvent({id:"org:"+org_ref,kind:"organization_created",org_ref}),{configured:true,ok:true});
  } finally {
    globalThis.fetch = before;
    if (previous === undefined) delete process.env.PEAKVERSE_PRODUCT_SECRET;
    else process.env.PEAKVERSE_PRODUCT_SECRET = previous;
  }
});
