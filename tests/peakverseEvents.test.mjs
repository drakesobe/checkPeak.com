import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { organizationReference, publishPeakverseEvent } from "../lib/peakverseEvents.js";

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
