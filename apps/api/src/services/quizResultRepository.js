import { getMongoDb } from "../config/mongo.js";

export async function saveQuizResult(payload) {
  const db = await getMongoDb();

  if (!db) {
    return { enabled: false, saved: false };
  }

  const collectionName =
    process.env.MONGODB_QUIZ_RESULTS_COLLECTION || "quiz_results";

  const doc = {
    sessionId: payload.sessionId || null,
    matchId: payload.matchId || null,
    matchName: payload.matchName || null,
    confidence: payload.confidence ?? null,
    source: payload.source || "api",
    traits: payload.traits || {},
    topTraits: payload.topTraits || [],
    answers: payload.answers || [],
    generatedAt: payload.generatedAt || new Date().toISOString(),
    createdAt: new Date()
  };

  const result = await db.collection(collectionName).insertOne(doc);
  return {
    enabled: true,
    saved: true,
    id: result.insertedId.toString()
  };
}
