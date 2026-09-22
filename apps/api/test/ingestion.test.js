import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { createIngestionRouter, validMessage } from "../src/routes/ingestion.js";
import { recordEvent, saveMessage, documentId, validEvent } from "../src/services/ingestionRepository.js";
import { originGuard, rateLimit } from "../src/middleware/ingestionGuard.js";
import { validateQuizRequest, validQuiz } from "../src/middleware/validate.js";
import { createQuizEvaluationHandler } from "../src/routes/quiz.js";
import { getStaticQuestions } from "../src/services/quizQuestionService.js";
import { requireAdmin } from "../src/middleware/requireAdmin.js";

function fakeDb() {
  const docs = new Map();
  const db = {
    docs,
    collection: (collection) => ({ doc: (id) => {
      const key = `${collection}/${id}`;
      return { key, create: async (data) => {
        if (docs.has(key)) throw Object.assign(new Error("duplicate"), { code: 6 });
        docs.set(key, data);
      } };
    } }),
    runTransaction: async (callback) => callback({
      get: async (ref) => ({ exists: docs.has(ref.key), get: (key) => docs.get(ref.key)?.[key] }),
      create: (ref, data) => docs.set(ref.key, data)
    })
  };
  return db;
}

const message = () => ({ submissionId: randomUUID(), name: "Test Visitor", email: "test@example.com", subject: "Test", message: "Hello" });
function quiz() {
  return {
    completionId: randomUUID(), sessionId: randomUUID(),
    answers: [
      ...getStaticQuestions().map((q) => ({ questionId: q.id, value: q.options[0].value })),
      ...[1, 2, 3, 4, 5].map((n) => ({ questionId: `adaptive-q${n}`, value: "option1" }))
    ],
    traits: { energy: 0.5, sociability: 0.5, independence: 0.5, routine: 0.5, trainability: 0.5 },
    topTraits: [{ key: "energy", value: 0.5 }]
  };
}

async function serve(t, app) {
  const server = await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, body, headers = {}) => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body)
  });
}

test("strict public event schema excludes quiz, timestamps, PII, arbitrary IDs and extra fields", () => {
  const event = { type: "browser_session", eventId: randomUUID() };
  assert.equal(validEvent(event), true);
  for (const body of [
    { ...event, type: "quiz_completion" }, { ...event, type: "purchase" },
    { ...event, email: "test@example.com" }, { ...event, createdAt: new Date() },
    { ...event, eventId: "../totals" }, null
  ]) assert.ok(!validEvent(body));
});

test("atomic event creation deduplicates concurrent retries and preserves server timestamp", async () => {
  const db = fakeDb();
  const id = randomUUID();
  const results = await Promise.all(Array.from({ length: 10 }, () => recordEvent("browser_session", id, db)));
  assert.equal(db.docs.size, 1);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  const stored = [...db.docs.values()][0];
  assert.deepEqual(Object.keys(stored), ["type", "createdAt"]);
  assert.equal(stored.createdAt.constructor.name, "ServerTimestampTransform");
  await recordEvent("shop_redirect", id, db);
  assert.equal(db.docs.size, 2);
  await assert.rejects(recordEvent("purchase", id, db));
});

test("message validation preserves existing lengths and rejects status/source/time injection", () => {
  assert.equal(validMessage(message()), true);
  for (const change of [
    { name: "a" }, { name: " x " }, { email: "not-email" }, { email: "x".repeat(151) },
    { message: "" }, { message: "x".repeat(2001) }, { subject: "x".repeat(151) },
    { status: "replied" }, { source: "admin" }, { createdAt: 0 }, { submissionId: "bad" }
  ]) assert.ok(!validMessage({ ...message(), ...change }));
});

test("message retry reuses the document without overwriting admin status; changed payload conflicts", async () => {
  const db = fakeDb();
  const body = message();
  await saveMessage(body, db);
  const key = `messages/${documentId("contact", body.submissionId)}`;
  const stored = db.docs.get(key);
  assert.deepEqual(Object.keys(stored).sort(), ["createdAt", "email", "message", "name", "source", "status", "subject"]);
  stored.status = "replied";
  await saveMessage(body, db);
  assert.equal(db.docs.size, 1);
  assert.equal(stored.status, "replied");
  await assert.rejects(saveMessage({ ...body, message: "Different" }, db), { status: 409 });
});

test("ingestion rejects invalid input/origins, handles backend failures, never reports a failed save as success", async (t) => {
  const app = express();
  app.use(express.json({ limit: "32kb" }), originGuard(["http://site.test"]));
  let saved = 0;
  app.use(createIngestionRouter({
    record: async () => { throw new Error("offline"); },
    save: async () => { saved += 1; throw new Error("offline"); }
  }));
  const post = await serve(t, app);
  assert.equal((await post("/analytics/events", { type: "quiz_completion", eventId: randomUUID() })).status, 400);
  assert.equal((await post("/analytics/events", { type: "browser_session", eventId: randomUUID() })).status, 503);
  assert.equal((await post("/messages", message(), { Origin: "https://evil.test" })).status, 403);
  assert.equal(saved, 0);
  assert.equal((await post("/messages", message())).status, 503);
  assert.equal(saved, 1);
});

test("request limiter rejects excess traffic and does not trust spoofed forwarded addresses", async (t) => {
  const app = express();
  app.post("/", rateLimit({ limit: 1 }), (_req, res) => res.sendStatus(204));
  const post = await serve(t, app);
  assert.equal((await post("/", {})).status, 204);
  const response = await post("/", {}, { "X-Forwarded-For": "1.2.3.4" });
  assert.equal(response.status, 429);
  assert.ok(response.headers.get("Retry-After"));
});

test("quiz requires all ten answers and only records after successful evaluation", async (t) => {
  assert.equal(validQuiz(quiz()), true);
  assert.equal(validQuiz({ ...quiz(), answers: [] }), false);
  assert.equal(validQuiz({ ...quiz(), source: "debug" }), false);
  const app = express();
  app.use(express.json());
  const db = fakeDb();
  let fail = false;
  app.post("/evaluate", validateQuizRequest, createQuizEvaluationHandler({
    evaluate: async () => { if (fail) throw new Error("failed"); return { match: { id: "test" } }; },
    record: (type, id) => recordEvent(type, id, db)
  }));
  const post = await serve(t, app);
  assert.equal((await post("/evaluate", { ...quiz(), answers: [] })).status, 400);
  assert.equal(db.docs.size, 0);
  fail = true;
  assert.equal((await post("/evaluate", quiz())).status, 500);
  assert.equal(db.docs.size, 0);
  fail = false;
  const body = quiz();
  assert.equal((await post("/evaluate", body)).status, 200);
  assert.equal((await post("/evaluate", body)).status, 200);
  assert.equal(db.docs.size, 1);
});

test("legacy analytics/recent results authorization rejects unauthenticated requests before database access", async (t) => {
  const app = express();
  app.post("/private", requireAdmin, (_req, res) => res.json({ secret: true }));
  const post = await serve(t, app);
  assert.equal((await post("/private", {})).status, 401);
  assert.equal((await post("/private", {}, { Authorization: "Bearer invalid" })).status, 403);
});
