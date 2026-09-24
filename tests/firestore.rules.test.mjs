import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { recordEvent, saveMessage, documentId } from "../apps/api/src/services/ingestionRepository.js";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getCountFromServer, query, where, Timestamp, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

test("Firestore permits active admin reads only; no client can mutate analytics or bypass message ingestion", async (t) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Use npm run test:rules via the Firestore emulator; never production.");
  const env = await initializeTestEnvironment({
    projectId: "demo-purrishco",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
  t.after(() => env.cleanup());
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, profile] of Object.entries({
      admin: { role: "admin", active: true }, inactive: { role: "admin", active: false },
      legacy: { role: "admin" }, customer: { role: "customer", active: true }
    })) await setDoc(doc(db, "users", uid), profile);
    await setDoc(doc(db, "analytics_events", "event"), { type: "browser_session", createdAt: Timestamp.now() });
    await setDoc(doc(db, "analytics_events", "ten-days-ago"), { type: "browser_session", createdAt: Timestamp.fromMillis(Date.now() - 10 * 86400000) });
    await setDoc(doc(db, "analytics_events", "forty-days-ago"), { type: "browser_session", createdAt: Timestamp.fromMillis(Date.now() - 40 * 86400000) });
    await setDoc(doc(db, "messages", "message"), { name: "Test", email: "test@example.com", subject: "", message: "Hello", status: "unread", source: "contact-page", createdAt: Timestamp.now() });
  });
  const admin = env.authenticatedContext("admin").firestore();
  await assertSucceeds(getDoc(doc(admin, "analytics_events", "event")));
  await assertSucceeds(getCountFromServer(query(collection(admin, "analytics_events"),
    where("type", "==", "browser_session"), where("createdAt", ">=", Timestamp.fromMillis(0)))));
  const end = Date.now();
  const countFor = async (days) => (await getCountFromServer(query(collection(admin, "analytics_events"),
    where("type", "==", "browser_session"), where("createdAt", ">=", Timestamp.fromMillis(end - days * 86400000)),
    where("createdAt", "<=", Timestamp.fromMillis(end))))).data().count;
  assert.equal(await countFor(7), 1);
  assert.equal(await countFor(30), 2);
  // Use the real Admin SDK against the emulator to exercise atomic create and
  // transaction retries, not just the unit-test database double.
  const serverApp = initializeAdminApp({ projectId: "demo-purrishco" }, "ingestion-rules-test");
  t.after(() => deleteAdminApp(serverApp));
  const serverDb = getAdminFirestore(serverApp);
  const eventId = randomUUID();
  const writes = await Promise.all(Array.from({ length: 5 }, () => recordEvent("shop_redirect", eventId, serverDb)));
  assert.equal(writes.filter((item) => !item.duplicate).length, 1);
  const savedEvent = await serverDb.collection("analytics_events").doc(documentId("shop_redirect", eventId)).get();
  assert.ok(savedEvent.get("createdAt").toDate() instanceof Date);
  const submission = { submissionId: randomUUID(), name: "Test", email: "test@example.com", subject: "", message: "Hello" };
  await Promise.all(Array.from({ length: 5 }, () => saveMessage(submission, serverDb)));
  const messageRef = serverDb.collection("messages").doc(documentId("contact", submission.submissionId));
  await messageRef.update({ status: "replied" });
  await saveMessage(submission, serverDb);
  assert.equal((await messageRef.get()).get("status"), "replied");
  await assert.rejects(saveMessage({ ...submission, message: "Changed" }, serverDb), { status: 409 });
  await assertSucceeds(getDoc(doc(admin, "messages", "message")));
  await assertSucceeds(updateDoc(doc(admin, "messages", "message"), { status: "read", updatedAt: serverTimestamp(), updatedBy: "admin" }));
  await assertSucceeds(updateDoc(doc(admin, "messages", "message"), { status: "replied" }));
  for (const db of [env.unauthenticatedContext().firestore(), ...["customer", "inactive", "legacy", "missing"].map((uid) => env.authenticatedContext(uid).firestore())]) {
    await assertFails(getDoc(doc(db, "analytics_events", "event")));
    await assertFails(getCountFromServer(collection(db, "analytics_events")));
    await assertFails(getDoc(doc(db, "messages", "message")));
    await assertFails(updateDoc(doc(db, "messages", "message"), { status: "replied" }));
    await assertFails(deleteDoc(doc(db, "messages", "message")));
    await assertFails(setDoc(doc(db, "messages", "public"), { name: "Test", email: "test@example.com", subject: "", message: "Hi", status: "unread", source: "contact-page", createdAt: serverTimestamp() }));
  }
  for (const db of [admin, env.unauthenticatedContext().firestore()]) {
    await assertFails(setDoc(doc(db, "analytics_events", "new"), { type: "browser_session", createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "analytics_events", "event"), { type: "quiz_completion" }));
    await assertFails(deleteDoc(doc(db, "analytics_events", "event")));
    await assertFails(setDoc(doc(db, "analytics_totals", "all"), { count: 999 }));
  }
  await assertFails(updateDoc(doc(env.authenticatedContext("customer").firestore(), "users", "customer"), { role: "admin" }));
  await env.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), "users", "admin"), { active: false }));
  await assertFails(getDoc(doc(admin, "analytics_events", "event")));
  await assertFails(getDoc(doc(admin, "messages", "message")));
});
