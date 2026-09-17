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
