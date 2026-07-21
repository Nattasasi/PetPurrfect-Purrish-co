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
