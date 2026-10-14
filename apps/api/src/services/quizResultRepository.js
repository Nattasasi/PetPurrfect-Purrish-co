import { getFirestoreDb } from "../config/firebaseAdmin.js";
import { env } from "../config/env.js";

export async function saveQuizResult(payload) {
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const questionCount = Number(payload.questionCount);
  const hasCompleteAnswers =
    questionCount > 0 &&
    answers.length === questionCount &&
    answers.every((answer) => answer && typeof answer.value === "string" && answer.value.trim().length > 0);

  if (!hasCompleteAnswers) {
    return { enabled: false, saved: false, skipped: true, reason: "incomplete_answers" };
  }

  if (env.dataStore !== "firebase") {
    return { enabled: false, saved: false };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, saved: false };

  const doc = {
    sessionId: payload.sessionId || null,
    matchId: payload.matchId || null,
    matchName: payload.matchName || null,
    confidence: payload.confidence ?? null,
    imageUrl: payload.imageUrl || null,
    source: payload.source || "api",
    traits: payload.traits || {},
    topTraits: payload.topTraits || [],
    answers,
    shareCaptions: payload.shareCaptions || [],
    shareCaptionModel: payload.shareCaptionModel || null,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    createdAt: new Date()
  };

  const result = await db.collection(env.firebase.quizResultsCollection).add(doc);
  return { enabled: true, saved: true, id: result.id, store: "firebase" };
}

// Attaches a result to a user. The caller must prove it created the result by
// supplying the sessionId stored on the document.
export async function claimQuizResult(id, uid, sessionId) {
  const db = getFirestoreDb();
  if (!db) return { ok: false, status: 503, error: "storage_unavailable" };
  if (typeof id !== "string" || !id || typeof sessionId !== "string" || !sessionId) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const ref = db.collection(env.firebase.quizResultsCollection).doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, status: 404, error: "quiz_result_not_found" };
    const data = snap.data();
    if (data.ownerUid && data.ownerUid !== uid) return { ok: false, status: 409, error: "already_claimed" };
    if (!data.ownerUid) {
      if (!data.sessionId || data.sessionId !== sessionId) return { ok: false, status: 403, error: "session_mismatch" };
      tx.update(ref, { ownerUid: uid, claimedAt: new Date() });
    }
    return { ok: true };
  });
}

export async function listOwnedQuizResults(uid) {
  const db = getFirestoreDb();
  if (!db) return [];
  const snapshot = await db
    .collection(env.firebase.quizResultsCollection)
    .where("ownerUid", "==", uid)
    .limit(100)
    .get();
  const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : new Date(value || 0).getTime());
  return snapshot.docs
    .map((item) => {
      const doc = item.data();
      return {
        id: item.id,
        matchId: doc.matchId || null,
        matchName: doc.matchName || null,
        confidence: doc.confidence ?? null,
        imageUrl: doc.imageUrl || null,
        topTraits: doc.topTraits || [],
        createdAt: doc.createdAt?.toDate?.().toISOString?.() || doc.createdAt || null
      };
    })
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}
