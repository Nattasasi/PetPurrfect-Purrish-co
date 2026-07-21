import { Router } from "express";
import { evaluateQuiz } from "../services/ragService.js";
import { listRecentQuizResults } from "../services/quizResultReader.js";

const router = Router();

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
