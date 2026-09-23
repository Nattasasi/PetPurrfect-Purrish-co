import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../config/firebaseAdmin.js";

export const EVENT_TYPES = ["browser_session", "quiz_completion", "sticker_generation", "shop_redirect"];
export const PUBLIC_EVENT_TYPES = EVENT_TYPES.filter((type) => type !== "quiz_completion");
export const isUuid = (value) => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const documentId = (namespace, id) => createHash("sha256").update(`${namespace}:${id}`).digest("hex");

export function requireDb() {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firebase server credentials are not configured");
  return db;
}

export function validEvent(body) {
  return body && Object.keys(body).length === 2
    && PUBLIC_EVENT_TYPES.includes(body.type) && isUuid(body.eventId);
}

export async function recordEvent(type, id, db = requireDb()) {
  if (!EVENT_TYPES.includes(type) || !isUuid(id)) throw new Error("Invalid analytics event");
  const ref = db.collection("analytics_events").doc(documentId(type, id));
  try {
    await ref.create({ type, createdAt: FieldValue.serverTimestamp() });
    return { recorded: true, duplicate: false };
  } catch (error) {
    if (error.code === 6 || error.code === "already-exists") return { recorded: true, duplicate: true };
    throw error;
  }
}

export async function saveMessage(body, db = requireDb()) {
  const { submissionId, name, email, subject, message } = body;
  const fields = { name, email, subject, message };
  const ref = db.collection("messages").doc(documentId("contact", submissionId));
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      if (!Object.entries(fields).every(([key, value]) => existing.get(key) === value)) {
        const error = new Error("Submission ID already used");
        error.status = 409;
        throw error;
      }
      return { saved: true };
    }
    transaction.create(ref, {
      ...fields, status: "unread", source: "contact-page", createdAt: FieldValue.serverTimestamp()
    });
    return { saved: true };
  });
}
