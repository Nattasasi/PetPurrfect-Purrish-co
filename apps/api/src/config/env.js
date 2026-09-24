import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  dataStore: process.env.DATA_STORE || "firebase",
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "purperfect-169de",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY || "",
    applicationDefault: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      || process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true",
    quizResultsCollection: process.env.FIREBASE_QUIZ_RESULTS_COLLECTION || "quiz_results",
    shareEventsCollection: process.env.FIREBASE_SHARE_EVENTS_COLLECTION || "share_events",
    analyticsEventsCollection: process.env.FIREBASE_ANALYTICS_EVENTS_COLLECTION || "analytics_events"
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
    contextLength: Number(process.env.OLLAMA_CONTEXT_LENGTH || 8192)
  }
};
