import { Router } from "express";
import { evaluateQuiz } from "../services/ragService.js";
import {
  listRecentQuizResults,
  getLatestQuizResultForSession,
  getPublicQuizResult
} from "../services/quizResultReader.js";
import {
  recordShareEvent,
  recordLandingEvent,
  getShareAnalytics
} from "../services/shareAnalyticsRepository.js";
import { generateAdaptiveQuestions, getStaticQuestions } from "../services/quizQuestionService.js";
import { fetchBreedImageUrl } from "../adapters/petImageApi.js";
import { saveQuizResult } from "../services/quizResultRepository.js";
import {
  getQuizProfiles,
  getTopClusters,
  buildDiscriminatorQuestion
} from "../services/breedProfileService.js";

const router = Router();

router.get("/questions/static", (_req, res) => {
  res.json({ questions: getStaticQuestions() });
});

// NEW: Endpoint to get all 486 breeds organized into clusters
// Used by frontend to load breed profiles and perform cluster-based matching
router.get("/profiles", async (req, res) => {
  try {
    const data = await getQuizProfiles();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "breed_profiles_failed",
      message: error?.message || "Failed to load breed profiles"
    });
  }
});

router.post("/discriminator-question", async (req, res) => {
  try {
    const profiles = await getQuizProfiles();
    const traits = req.body?.traits || {};
    const candidateClusters = getTopClusters(traits, profiles.clusters, 3);
    const question = buildDiscriminatorQuestion(traits, candidateClusters, profiles.breeds);
    if (!question) {
      res.status(422).json({ error: "discriminator_question_unavailable" });
      return;
    }
    res.json({ question, candidateClusterIds: candidateClusters.map((cluster) => cluster.representative?.id) });
  } catch (error) {
    res.status(500).json({
      error: "discriminator_question_failed",
      message: error?.message || "Failed to generate the final quiz question"
    });
  }
});

// Used by the frontend's dev-only debug result generator to preview a real
// breed photo instead of the static SVG fallback.
router.get("/debug/breed-image", async (req, res) => {
  try {
    const imageUrl = await fetchBreedImageUrl(req.query.breed, req.query.petType);
    res.json({ imageUrl: imageUrl || null });
  } catch (error) {
    res.status(500).json({ error: "breed_image_failed", message: error?.message || "Unexpected server error" });
  }
});

// Dev-only debug result generator: persists the randomized debug match the
// same way a real quiz submission would, instead of bypassing the backend.
router.post("/debug/save-result", async (req, res) => {
  try {
    const body = req.body || {};
    const match = body.match || {};
    const persistence = await saveQuizResult({
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      matchId: match.id || null,
      matchName: match.name || null,
      confidence: typeof match.confidence === "number" ? match.confidence : null,
      imageUrl: match.imageUrl || null,
      source: "debug",
      traits: body.traits || {},
      topTraits: Array.isArray(body.topTraits) ? body.topTraits : [],
      answers: Array.isArray(body.answers) ? body.answers : [],
      questionCount: body.questionCount,
      shareCaptions: Array.isArray(body.shareCaptions) ? body.shareCaptions : [],
      shareCaptionModel: null,
      generatedAt: new Date().toISOString()
    });
    res.json({ persistence });
  } catch (error) {
    res.status(500).json({ error: "debug_result_save_failed", message: error?.message || "Unexpected server error" });
  }
});

router.post("/questions/adaptive", async (req, res) => {
  try {
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : null;
    const answeredSoFar = Array.isArray(req.body.answeredSoFar)
      ? req.body.answeredSoFar.filter((item) => item && typeof item.text === "string" && typeof item.label === "string")
      : [];
      const previousQuestionTexts = Array.isArray(req.body.previousQuestionTexts)
      ? req.body.previousQuestionTexts
      : [];
      const questionCount = Number(req.body.questionCount) > 0 ? Number(req.body.questionCount) : 1;
      const questionOffset = Number.isInteger(req.body.questionOffset) ? req.body.questionOffset : 0;
    const previousResult = await getLatestQuizResultForSession(sessionId);
      const result = await generateAdaptiveQuestions(
        answeredSoFar,
        previousResult,
        previousQuestionTexts,
        questionCount,
        questionOffset
      );
    res.json({ ...result, basedOnPreviousResult: Boolean(previousResult) });
  } catch (error) {
    res.status(500).json({
      error: "quiz_questions_failed",
      message: error?.message || "Ollama is unavailable. Start Ollama and try again."
    });
  }
});

router.post("/evaluate", async (req, res) => {
  try {
    const result = await evaluateQuiz(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "quiz_evaluation_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

router.get("/results/recent", async (req, res) => {
  try {
    const limit = req.query.limit;
    const result = await listRecentQuizResults(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "quiz_results_fetch_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

// Public sanitized result used by shared links: /quiz/result/:id
router.get("/results/:id", async (req, res) => {
  try {
    const result = await getPublicQuizResult(req.params.id);
    if (!result) {
      res.status(404).json({ error: "quiz_result_not_found" });
      return;
    }
    res.json({ result });
  } catch (error) {
    res.status(500).json({
      error: "quiz_result_fetch_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

// Top of the viral funnel: someone shared their result on a platform.
router.post("/share", async (req, res) => {
  try {
    const outcome = await recordShareEvent({
      resultId: typeof req.body?.resultId === "string" ? req.body.resultId : null,
      platform: typeof req.body?.platform === "string" ? req.body.platform : "unknown"
    });
    res.json(outcome);
  } catch (error) {
    res.status(500).json({
      error: "share_event_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

// Bottom of the viral funnel: a new visitor arrived via a shared link.
router.post("/landing", async (req, res) => {
  try {
    const outcome = await recordLandingEvent({
      resultId: typeof req.body?.resultId === "string" ? req.body.resultId : null,
      utmSource: req.body?.utmSource,
      utmMedium: req.body?.utmMedium,
      utmCampaign: req.body?.utmCampaign
    });
    res.json(outcome);
  } catch (error) {
    res.status(500).json({
      error: "landing_event_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

// Share funnel analytics: shares and resulting landings per platform.
router.get("/share/analytics", async (_req, res) => {
  try {
    const analytics = await getShareAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({
      error: "share_analytics_failed",
      message: error?.message || "Unexpected server error"
    });
  }
});

export default router;
