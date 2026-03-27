import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";

let baseUrl;
let server;
let dispose;

before(async () => {
  const appBundle = createApp();
  dispose = appBundle.dispose;
  server = appBundle.app.listen(0);
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  dispose?.();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

test("GET /api/incidents returns incident rows", async () => {
  const { response, body } = await request("/api/incidents");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.items.length > 0);
  assert.equal(typeof body.items[0].runId, "string");
});

test("GET /api/incidents/:runId returns detail", async () => {
  const { response, body } = await request("/api/incidents/run-ops-1001");
  assert.equal(response.status, 200);
  assert.equal(body.runId, "run-ops-1001");
  assert.equal(typeof body.howToFix.rootCause, "string");
  assert.ok(Array.isArray(body.howToFix.steps));
});

test("POST /api/runs/:runId/rerun queues a rerun and prevents duplicate active reruns", async () => {
  const initial = await request("/api/runs/run-ops-1002/rerun", { method: "POST" });
  assert.equal(initial.response.status, 202);
  assert.equal(initial.body.originalRunId, "run-ops-1002");
  assert.equal(initial.body.status, "queued");
  assert.ok(initial.body.newRunId.startsWith("run-rerun-"));

  const duplicate = await request("/api/runs/run-ops-1002/rerun", { method: "POST" });
  assert.equal(duplicate.response.status, 409);
  assert.equal(
    duplicate.body.error,
    "A rerun is already in progress for this run."
  );
});

