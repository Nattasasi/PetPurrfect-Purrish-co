import { getMongoDb } from "../config/mongo.js";

export async function listRecentQuizResults(limit = 10) {
  const db = await getMongoDb();

  if (!db) {
    return { enabled: false, results: [] };
  }

  const collectionName =
    process.env.MONGODB_QUIZ_RESULTS_COLLECTION || "quiz_results";

  const results = await db
    .collection(collectionName)
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
    .toArray();

  return {
    enabled: true,
    results: results.map((doc) => ({
      id: doc._id.toString(),
      sessionId: doc.sessionId || null,
      matchId: doc.matchId || null,
      matchName: doc.matchName || null,
      confidence: doc.confidence ?? null,
      source: doc.source || "api",
      createdAt: doc.createdAt || null,
      topTraits: doc.topTraits || [],
      traits: doc.traits || {}
    }))
  };
}

export async function getLatestQuizResultForSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  try {
    const db = await getMongoDb();

    if (!db) {
      return null;
    }

    const collectionName =
      process.env.MONGODB_QUIZ_RESULTS_COLLECTION || "quiz_results";

    const doc = await db
      .collection(collectionName)
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    if (!doc) {
      return null;
    }

    return {
      id: doc._id.toString(),
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

