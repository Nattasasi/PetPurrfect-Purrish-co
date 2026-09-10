import { useMemo } from "react";
import staticQuizQuestions from "../data/quizQuestions.json";
import { scoreQuiz } from "../lib/quizScoring";
import { postJson, createSessionId, getDebugBreedImage } from "../lib/apiClient";
import { getPetImageById, resolvePetImageUrl } from "../lib/petImages";
import { exportQuizResultImage, createQuizResultImageFile } from "../lib/shareImage";
import { useInMemoryPageState } from "../lib/inMemoryPageState";
import ShareResultCard from "../components/share/ShareResultCard";

const RESULT_STORAGE_KEY = "purrishco.quiz.result.v2";
const STATIC_QUESTION_COUNT = 5;
const ADAPTIVE_QUESTION_COUNT = 15;
const TOTAL_QUESTION_COUNT = STATIC_QUESTION_COUNT + ADAPTIVE_QUESTION_COUNT;
const DEBUG_MATCHES = [
  { id: "golden_retriever", name: "Golden Retriever", petType: "dog", summary: "Friendly, social, and well-suited to active owners." },
  { id: "shiba_inu", name: "Shiba Inu", petType: "dog", summary: "Independent, alert, and confident with a balanced routine." },
  { id: "ragdoll_cat", name: "Ragdoll Cat", petType: "cat", summary: "Calm, affectionate, and ideal for relaxed households." },
  { id: "border_collie", name: "Border Collie", petType: "dog", summary: "Highly trainable and built for active, structured lifestyles." }
];

function clearSavedQuizProgress() {
  try {
    [
      "purrishco.quiz.answers.v1",
      "purrishco.quiz.answers.v2",
      "purrishco.quiz.result.v1",
      "purrishco.quiz.result.v2",
      "purrishco.quiz.questions.v2",
      "purrishco.quiz.questions.v3.ollama"
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage restrictions and use the in-memory quiz session.
  }
}

clearSavedQuizProgress();

function shuffleOptions(options) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

const STATIC_QUESTIONS = staticQuizQuestions
  .slice(0, STATIC_QUESTION_COUNT)
  .map((question) => ({ ...question, options: shuffleOptions(question.options) }));

export default function QuizPage() {
  const [sessionId] = useInMemoryPageState("quiz.sessionId", createSessionId);
  const [questions, setQuestions] = useInMemoryPageState("quiz.questions", STATIC_QUESTIONS);
  const [adaptiveLoading, setAdaptiveLoading] = useInMemoryPageState("quiz.adaptiveLoading", false);
  const [adaptiveError, setAdaptiveError] = useInMemoryPageState("quiz.adaptiveError", "");
  const totalQuestions = questions.length;
  const [currentIndex, setCurrentIndex] = useInMemoryPageState("quiz.currentIndex", 0);
  const [answersById, setAnswersById] = useInMemoryPageState("quiz.answers", {});
  const [touched, setTouched] = useInMemoryPageState("quiz.touched", false);
  const [submitted, setSubmitted] = useInMemoryPageState("quiz.submitted", false);
  const [isSubmitting, setIsSubmitting] = useInMemoryPageState("quiz.isSubmitting", false);
  const [apiResult, setApiResult] = useInMemoryPageState("quiz.apiResult", null);
  const [apiError, setApiError] = useInMemoryPageState("quiz.apiError", "");

  const currentQuestion = questions[currentIndex];
  const selectedValue = answersById[currentQuestion.id] ?? "";
  const progress = ((currentIndex + 1) / TOTAL_QUESTION_COUNT) * 100;
  // Question 5 and each later question load the next adaptive question on demand.
  const isLastStaticQuestion = currentIndex === STATIC_QUESTION_COUNT - 1 && questions.length === STATIC_QUESTION_COUNT;

  const scoring = useMemo(() => scoreQuiz(questions, answersById), [questions, answersById]);

  const displayResult = useMemo(() => {
    if (apiResult?.match) {
      return {
        id: apiResult.match.id,
        name: apiResult.match.name,
        summary: apiResult.summary || "AI result generated.",
        confidence: apiResult.match.confidence,
        grounding: apiResult.grounding || [],
        shareCaptions: apiResult.shareCaptions || [],
        imageUrl: resolvePetImageUrl(apiResult.match.imageUrl || apiResult.imageUrl, apiResult.match.id)
      };
    }

    return {
      id: scoring.recommendation.id,
      name: scoring.recommendation.name,
      summary: scoring.recommendation.summary,
      confidence: scoring.recommendation.confidence,
      grounding: [],
      shareCaptions: [],
      imageUrl: getPetImageById(scoring.recommendation.id)
    };
  }, [apiResult, scoring]);

  // Request only the next adaptive question so the user never waits for a full batch.
  const fetchAdaptiveQuestions = async (staticAnswersById) => {
    setAdaptiveLoading(true);
    setAdaptiveError("");
    try {
      const staticAnswers = STATIC_QUESTIONS.map((question) => ({
        questionId: question.id,
        value: staticAnswersById[question.id]
      }));
      const previousQuestionTexts = questions
        .slice(STATIC_QUESTION_COUNT)
        .map((question) => question.text)
        .filter(Boolean);
      const result = await postJson("/api/quiz/questions/adaptive", {
        sessionId,
        staticAnswers,
        previousQuestionTexts,
        questionCount: 1,
        questionOffset: questions.length - STATIC_QUESTION_COUNT
      });
      if (result.source !== "ollama" || !Array.isArray(result.questions) || result.questions.length !== 1) {
        throw new Error("Ollama did not return the next question.");
      }
      const combined = [...questions, result.questions[0]];
      setQuestions(combined);
      return true;
    } catch (error) {
      setAdaptiveError(error?.message || "We couldn't generate your personalized questions. Please try again.");
      return false;
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const submitAnswers = async (answersMap, questionsForScoring = questions) => {
    const computedScoring = scoreQuiz(questionsForScoring, answersMap);
    const answers = questionsForScoring.map((question) => ({
      questionId: question.id,
      value: answersMap[question.id]
    }));

    let resultPayload = {
      generatedAt: new Date().toISOString(),
      source: "local",
      match: {
        id: computedScoring.recommendation.id,
        name: computedScoring.recommendation.name,
        confidence: computedScoring.recommendation.confidence,
        imageUrl: getPetImageById(computedScoring.recommendation.id)
      },
      summary: computedScoring.recommendation.summary,
      grounding: [],
      topTraits: computedScoring.topTraits,
      traits: computedScoring.normalized,
      imageUrl: getPetImageById(computedScoring.recommendation.id),
      answers
    };

    try {
      const result = await postJson("/api/quiz/evaluate", {
        sessionId,
        answers,
        traits: computedScoring.normalized,
        topTraits: computedScoring.topTraits
      });


      setApiResult(result);
      resultPayload = {
        ...resultPayload,
        source: "api",
        persistence: result.persistence || null,
        match: {
          id: result.match?.id || computedScoring.recommendation.id,
          name: result.match?.name || computedScoring.recommendation.name,
          confidence:
            typeof result.match?.confidence === "number"
              ? result.match.confidence
              : computedScoring.recommendation.confidence,
          imageUrl: resolvePetImageUrl(
            result.match?.imageUrl || result.imageUrl,
            result.match?.id || computedScoring.recommendation.id
          )
        },
        summary: result.summary || computedScoring.recommendation.summary,
        grounding: result.grounding || [],
        shareCaptions: result.shareCaptions || [],
        imageUrl: resolvePetImageUrl(
          result.match?.imageUrl || result.imageUrl,
          result.match?.id || computedScoring.recommendation.id
        )
      };
    } catch {
      setApiResult(null);
      setApiError("AI service is currently unavailable. Showing local preview result.");
      resultPayload = {
        ...resultPayload,
        error: "AI service unavailable. Local fallback result shown."
      };
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
      localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultPayload));
    }
  };

  const goPrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setTouched(false);
  };

  const goNext = async (value = selectedValue) => {
    if (!value) {
      setTouched(true);
      return;
    }
    setTouched(false);

    const nextAnswers = { ...answersById, [currentQuestion.id]: value };
    if (currentIndex >= TOTAL_QUESTION_COUNT - 1) {
      setApiError("");
      setIsSubmitting(true);
      await submitAnswers(nextAnswers);
      return;
    }

    if (isLastStaticQuestion || currentIndex === totalQuestions - 1) {
      const generated = await fetchAdaptiveQuestions(nextAnswers);
      if (generated) setCurrentIndex((prev) => prev + 1);
      return;
    }

    setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
  };

  const selectOption = async (value) => {
    setAnswersById((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setTouched(false);
    await goNext(value);
  };

  const submitQuiz = async () => {
    const allQuestionsAnswered = questions.every((question) => answersById[question.id]);
    if (!allQuestionsAnswered) {
      setTouched(true);
      return;
    }

    setTouched(false);
    setApiError("");
    setIsSubmitting(true);
    await submitAnswers(answersById);
  };

  const resetQuiz = () => {
    setAnswersById({});
    setCurrentIndex(0);
    setSubmitted(false);
    setTouched(false);
    setAdaptiveError("");
    setApiResult(null);
    setApiError("");
    localStorage.removeItem(RESULT_STORAGE_KEY);
    setQuestions(STATIC_QUESTIONS);
  };

  const showDebugResult = async () => {
    const match = DEBUG_MATCHES[Math.floor(Math.random() * DEBUG_MATCHES.length)];
    const confidence = Number((0.72 + Math.random() * 0.27).toFixed(3));
    const realImageUrl = await getDebugBreedImage(match.name, match.petType);
    const debugResult = {
      match: {
        ...match,
        confidence,
        imageUrl: realImageUrl || getPetImageById(match.id)
      },
      summary: `${match.summary} This is a randomized debug result for quickly testing sharing.`,
      grounding: [],
      traits: { energy: 0.5, sociability: 0.5, independence: 0.5, routine: 0.5, trainability: 0.5 },
      shareCaptions: [
        `My Purrish&Co. debug result says I'm a match for a ${match.name} 🐾 What pet matches you?`,
        `Apparently, my personality matches a ${match.name}. Take the Purrish&Co. quiz and find yours!`,
        `Would you get the same result? Discover your person-pet match with Purrish&Co. ✨`
      ],
      persistence: { enabled: false, saved: false }
    };

    setApiResult(debugResult);
    setApiError("");
    setSubmitted(true);
  };

  return (
    <>
      <section className="page-header">
        <h1>🐾 Person-Pet Quiz</h1>
        <p>Discover which pet matches your personality through our fun AI-powered quiz.</p>
        {import.meta.env.DEV && (
          <button className="btn btn-outline debug-launch-button" type="button" onClick={showDebugResult}>
            <i className="fas fa-flask" aria-hidden="true" /> Random Debug Result
          </button>
        )}
      </section>

      <section className="quiz-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p>Question {currentIndex + 1} of {TOTAL_QUESTION_COUNT}</p>
      </section>

      <section className="quiz-container">
        <div className={`quiz-card ${submitted ? "quiz-card--result" : ""}`.trim()}>
          {adaptiveLoading ? (
            <div className="quiz-loading" role="status" aria-live="polite">
              <div className="quiz-loading-paw" aria-hidden="true">🐾</div>
              <p className="quiz-loading-kicker">A fresh question is taking shape</p>
              <h2>Thinking beyond the obvious...</h2>
              <p className="quiz-hint">Finding a curious little twist that feels like you.</p>
              <div className="quiz-loading-steps" aria-hidden="true">
                <span><i className="fas fa-lightbulb" /> New angle</span>
                <span><i className="fas fa-wand-magic-sparkles" /> Fresh scenario</span>
                <span><i className="fas fa-heart" /> Your vibe</span>
              </div>
            </div>
          ) : adaptiveError ? (
            <div className="quiz-result-panel">
              <p className="quiz-error">{adaptiveError}</p>
              <button className="btn btn-primary" type="button" onClick={() => fetchAdaptiveQuestions(answersById)}>
                Try Again
              </button>
            </div>
          ) : submitted ? (
            <div className="quiz-result-panel">
              <h2>🐾 Your Result Is Ready</h2>
              <img src={displayResult.imageUrl} alt={displayResult.name || "Recommended pet"} className="quiz-result-image quiz-result-image--large" />
              <p className="result-eyebrow">Your personality match</p>
              <h3>{displayResult.name}</h3>
              <p className="result-summary">{displayResult.summary}</p>
              <div className="result-metrics">
                <span><strong>{Math.round((displayResult.confidence || 0) * 100)}%</strong> confidence</span>
                <span><strong>{scoring.topTraits.length}</strong> top traits</span>
              </div>
              <p className="quiz-hint result-traits">Top traits: {scoring.topTraits.map((item) => item.key).join(", ")}</p>
              {displayResult.grounding.length > 0 && <p className="quiz-hint">Grounded from: {displayResult.grounding[0].source}</p>}
              {apiError && <p className="quiz-error">{apiError}</p>}
              <div className="quiz-buttons">
                <button className="btn btn-primary" type="button" onClick={resetQuiz}>Retake Quiz</button>
              </div>
              <ShareResultCard
                title="Share your quiz result"
                subtitle={`${displayResult.name} · ${Math.round((displayResult.confidence || 0) * 100)}% confidence`}
                shareText={`🐾 The Purrish&Co. quiz says I'm a match for a ${displayResult.name}! ${Math.round((displayResult.confidence || 0) * 100)}% confidence. Curious what pet fits YOU? Take the quiz! ✨`}
                shareCaptions={displayResult.shareCaptions}
                onDownload={() => exportQuizResultImage({
                  match: { name: displayResult.name, confidence: displayResult.confidence },
                  summary: displayResult.summary,
                  topTraits: scoring.topTraits
                })}
                getShareFile={() => createQuizResultImageFile({
                  match: { name: displayResult.name, confidence: displayResult.confidence },
                  summary: displayResult.summary,
                  topTraits: scoring.topTraits
                })}
              />
            </div>
          ) : (
            <>
              <h2>{currentQuestion.text}</h2>
              {currentQuestion.options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`option ${selectedValue === option.value ? "selected" : ""}`.trim()}
                  onClick={() => selectOption(option.value)}
                  aria-pressed={selectedValue === option.value}
                  disabled={adaptiveLoading || isSubmitting}
                >
                  {option.label}
                </button>
              ))}
              {touched && !selectedValue && <p className="quiz-hint">Please select an answer before continuing.</p>}
              <div className="quiz-buttons">
                <button className="btn btn-outline" type="button" onClick={goPrevious} disabled={currentIndex === 0 || adaptiveLoading || isSubmitting}>
                  Previous
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {!submitted && !adaptiveLoading && (
        <section className="result-section">
          <h2>Your Future Result</h2>
          <div className="result-card">
            <i className="fas fa-paw fa-4x" />
            <h3>Complete all {TOTAL_QUESTION_COUNT} questions for your result</h3>
            <p>Your matching pet will appear here after completing the quiz.</p>
            <button className="btn btn-primary" type="button" onClick={submitQuiz} disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Show My Result"}
            </button>
          </div>
        </section>
      )}

      <section className="features">
        <h2>How AI Matches Your Personality</h2>
        <div className="cards">
          <div className="card"><i className="fas fa-user" /><h3>Answer Questions</h3><p>Complete a short personality quiz.</p></div>
          <div className="card"><i className="fas fa-brain" /><h3>AI Analysis</h3><p>Our AI analyzes your personality traits.</p></div>
          <div className="card"><i className="fas fa-dog" /><h3>Pet Recommendation</h3><p>Receive the pet breed that suits you best.</p></div>
        </div>
      </section>

      <section className="info-section">
        <div className="info-card">
          <h2>Why Take the Quiz?</h2>
          <ul><li>Fun personality experience</li><li>AI-powered recommendation</li><li>Share your results with friends</li><li>Discover your ideal pet companion</li></ul>
        </div>
      </section>
    </>
  );
}
