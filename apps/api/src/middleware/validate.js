import { isUuid } from "../services/ingestionRepository.js";
import { getStaticQuestions } from "../services/quizQuestionService.js";

export function validQuiz(body) {
  const traits = ["energy", "sociability", "independence", "routine", "trainability"];
  if (!body || !isUuid(body.completionId) || typeof body.sessionId !== "string" || body.sessionId.length > 100
    || !Object.keys(body).every((key) => ["completionId", "sessionId", "answers", "traits", "topTraits"].includes(key))
    || !Array.isArray(body.answers) || body.answers.length !== 10
    || !body.traits || Object.keys(body.traits).length !== traits.length
    || !traits.every((key) => Number.isFinite(body.traits[key]) && body.traits[key] >= 0 && body.traits[key] <= 1)
    || !Array.isArray(body.topTraits) || body.topTraits.length > 5
    || !body.topTraits.every((item) => item && Object.keys(item).length === 2
      && traits.includes(item.key) && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1)) return false;
  if (!body.answers.every((answer) => answer && Object.keys(answer).length === 2
    && typeof answer.questionId === "string" && typeof answer.value === "string"
    && answer.value.length > 0 && answer.value.length <= 100)) return false;
  if (new Set(body.answers.map((answer) => answer.questionId)).size !== 10) return false;
  if (!getStaticQuestions().slice(0, 5).every((question) => body.answers.some((answer) =>
    answer.questionId === question.id && question.options.some((option) => option.value === answer.value)))) return false;
  return [1, 2, 3, 4, 5].every((n) => body.answers.some((answer) => answer.questionId === `adaptive-q${n}`));
}

export function validateQuizRequest(req, res, next) {
  if (!validQuiz(req.body)) return res.status(400).json({ error: "complete_quiz_required" });
  next();
}
