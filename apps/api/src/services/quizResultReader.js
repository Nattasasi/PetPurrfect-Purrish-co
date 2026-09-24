import { getFirestoreDb } from "../config/firebaseAdmin.js";
import { env } from "../config/env.js";

function normalizeCreatedAtToMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?._seconds === "number") {
    const nanos = typeof value?._nanoseconds === "number" ? value._nanoseconds : 0;
    return value._seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listRecentQuizResults(limit = 10) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, results: [] };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, results: [] };

  const boundedLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  const snapshot = await db
    .collection(env.firebase.quizResultsCollection)
    .orderBy("createdAt", "desc")
    .limit(boundedLimit)
    .get();

  return {
    enabled: true,
    results: snapshot.docs.map((item) => {
      const doc = item.data();
      return {
        id: item.id,
        sessionId: doc.sessionId || null,
        matchId: doc.matchId || null,
        matchName: doc.matchName || null,
        confidence: doc.confidence ?? null,
        source: doc.source || "api",
        createdAt: doc.createdAt || null,
        topTraits: doc.topTraits || [],
        traits: doc.traits || {}
      };
    })
  };
}

// Public, sanitized view of a quiz result for shared links. Deliberately omits
// sessionId and raw answers so a shared URL never leaks the sharer's data.
export async function getPublicQuizResult(id) {
  if (!id || env.dataStore !== "firebase") {
    return null;
  }

  try {
    const db = getFirestoreDb();
    if (!db) return null;

    const snapshot = await db
      .collection(env.firebase.quizResultsCollection)
      .doc(id)
      .get();
    if (!snapshot.exists) return null;

    const doc = snapshot.data();
    return {
      id: snapshot.id,
      matchId: doc.matchId || null,
      matchName: doc.matchName || null,
      confidence: doc.confidence ?? null,
      imageUrl: doc.imageUrl || null,
      topTraits: doc.topTraits || [],
      traits: doc.traits || {},
      shareCaptions: doc.shareCaptions || [],
      createdAt: doc.createdAt || null
    };
  } catch {
    // A database outage shouldn't break shared links — the visitor just sees
    // the "take the quiz" fallback instead of the shared result.
    return null;
  }
}

export async function getLatestQuizResultForSession(sessionId) {
  if (!sessionId || env.dataStore !== "firebase") {
    return null;
  }

  try {
    const db = getFirestoreDb();
    if (!db) return null;

    let item = null;
    try {
      const snapshot = await db
        .collection(env.firebase.quizResultsCollection)
        .where("sessionId", "==", sessionId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      item = snapshot.docs[0] || null;
    } catch (error) {
      if (!String(error?.message || "").includes("requires an index")) {
        throw error;
      }

      // Fallback when composite index is not provisioned yet.
      const fallback = await db
        .collection(env.firebase.quizResultsCollection)
        .where("sessionId", "==", sessionId)
        .limit(25)
        .get();
      item = fallback.docs
        .sort((a, b) => normalizeCreatedAtToMillis(b.data()?.createdAt) - normalizeCreatedAtToMillis(a.data()?.createdAt))[0] || null;
    }

    if (!item) return null;

    const doc = item.data();
    return {
      id: item.id,
      sessionId: doc.sessionId || null,
      matchId: doc.matchId || null,
      matchName: doc.matchName || null,
      confidence: doc.confidence ?? null,
      topTraits: doc.topTraits || [],
      traits: doc.traits || {},
      createdAt: doc.createdAt || null
    };
  } catch {
    // A database outage shouldn't block quiz question generation — just
    // treat it the same as "no previous result".
    return null;
  }
}

