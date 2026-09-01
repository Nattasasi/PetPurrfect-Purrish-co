import { Router } from "express";
import { evaluateQuiz } from "../services/ragService.js";
import { listRecentQuizResults, getLatestQuizResultForSession } from "../services/quizResultReader.js";
import { generateAdaptiveQuestions, getStaticQuestions } from "../services/quizQuestionService.js";

const router = Router();

router.get("/questions/static", (_req, res) => {
  res.json({ questions: getStaticQuestions() });
});

router.post("/questions/adaptive", async (req, res) => {
  try {
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : null;
    const staticAnswers = Array.isArray(req.body.staticAnswers) ? req.body.staticAnswers : [];
      const previousQuestionTexts = Array.isArray(req.body.previousQuestionTexts)
      ? req.body.previousQuestionTexts
      : [];
      const questionCount = Number(req.body.questionCount) === 1 ? 1 : 15;
      const questionOffset = Number.isInteger(req.body.questionOffset) ? req.body.questionOffset : 0;
    const previousResult = await getLatestQuizResultForSession(sessionId);
      const result = await generateAdaptiveQuestions(
        staticAnswers,
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

export default router;
