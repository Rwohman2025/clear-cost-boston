
import assert from "node:assert/strict";
import test from "node:test";
import { createHttpApi } from "../src/lib/api/http-api.ts";

test("missing backend configuration never fetches or supplies demo prices", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("unexpected fetch"); };
  try {
    await assert.rejects(createHttpApi().listHospitals(), /Hospital pricing is unavailable/);
    assert.equal(called, false);
  } finally { globalThis.fetch = original; }
});

test("comparison sends insurer, setting and selected hospitals to the separate API", async () => {
  const original = globalThis.fetch;
  let requested;
  const result = { rows: [], missingHospitals: [] };
  globalThis.fetch = async (url) => { requested = new URL(url); return Response.json(result); };
  try {
    const actual = await createHttpApi("https://api.example.test").comparePrices({
      code: "45385", priceType: "negotiated", setting: "outpatient",
      payerId: "blue-cross-blue-shield", hospitalIds: ["bidmc", "mgh"],
    });
    assert.deepEqual(actual, result);
    assert.equal(requested.origin, "https://api.example.test");
    assert.equal(requested.pathname, "/api/prices/compare");
    assert.equal(requested.searchParams.get("payerId"), "blue-cross-blue-shield");
    assert.equal(requested.searchParams.get("hospitalIds"), "bidmc,mgh");
    assert.equal(requested.searchParams.get("setting"), "outpatient");
  } finally { globalThis.fetch = original; }
});

test("backend failures remain errors", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 503 });
  try { await assert.rejects(createHttpApi("https://api.example.test").listHospitals(), /503/); }
  finally { globalThis.fetch = original; }
});
