import { useEffect, useMemo, useState } from "react";
import quizQuestions from "../data/quizQuestions.json";
import { scoreQuiz } from "../lib/quizScoring";
import { postJson } from "../lib/apiClient";
import { getPetImageById } from "../lib/petImages";

const STORAGE_KEY = "purrishco.quiz.answers.v1";
const RESULT_STORAGE_KEY = "purrishco.quiz.result.v1";

function loadSavedAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export default function QuizPage() {
  const totalQuestions = quizQuestions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersById, setAnswersById] = useState(() => loadSavedAnswers());
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [apiError, setApiError] = useState("");

  const currentQuestion = quizQuestions[currentIndex];
  const selectedValue = answersById[currentQuestion.id] ?? "";
  const answeredCount = Object.keys(answersById).length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  const scoring = useMemo(() => scoreQuiz(quizQuestions, answersById), [answersById]);

  const displayResult = useMemo(() => {
    if (apiResult?.match) {
      return {
        id: apiResult.match.id,
        name: apiResult.match.name,
        summary: apiResult.summary || "AI result generated.",
        confidence: apiResult.match.confidence,
        grounding: apiResult.grounding || [],
        imageUrl:
          apiResult.match.imageUrl ||
          apiResult.imageUrl ||
          getPetImageById(apiResult.match.id)
      };
    }

    return {
      id: scoring.recommendation.id,
      name: scoring.recommendation.name,
      summary: scoring.recommendation.summary,
      confidence: scoring.recommendation.confidence,
      grounding: [],
      imageUrl: getPetImageById(scoring.recommendation.id)
    };
  }, [apiResult, scoring]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answersById));
  }, [answersById]);

  const buildRandomAnswers = () => {
    return quizQuestions.reduce((acc, question) => {
      const randomOption = question.options[Math.floor(Math.random() * question.options.length)];
      acc[question.id] = randomOption.value;
      return acc;
    }, {});
  };

  const submitAnswers = async (answersMap) => {
    const computedScoring = scoreQuiz(quizQuestions, answersMap);
    const answers = quizQuestions.map((question) => ({
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
        answers,
        traits: computedScoring.normalized,
        topTraits: computedScoring.topTraits
      });

      setApiResult(result);
      resultPayload = {
        ...resultPayload,
        source: "api",
        match: {
          id: result.match?.id || computedScoring.recommendation.id,
          name: result.match?.name || computedScoring.recommendation.name,
          confidence:
            typeof result.match?.confidence === "number"
              ? result.match.confidence
              : computedScoring.recommendation.confidence,
          imageUrl:
            result.match?.imageUrl ||
            result.imageUrl ||
            getPetImageById(result.match?.id || computedScoring.recommendation.id)
        },
        summary: result.summary || computedScoring.recommendation.summary,
        grounding: result.grounding || [],
        imageUrl:
          result.match?.imageUrl ||
          result.imageUrl ||
          getPetImageById(result.match?.id || computedScoring.recommendation.id)
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

  const selectOption = (value) => {
    setAnswersById((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setTouched(false);
  };

  const goPrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setTouched(false);
  };

  const goNext = () => {
    if (!selectedValue) {
      setTouched(true);
      return;
    }
    setTouched(false);
    setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
  };

  const submitQuiz = async () => {
    if (answeredCount < totalQuestions) {
      setTouched(true);
      return;
    }

    setTouched(false);
    setApiError("");
    setIsSubmitting(true);
    await submitAnswers(answersById);
  };

  const handleDebugRandomSubmit = async () => {
    const randomAnswers = buildRandomAnswers();
    setAnswersById(randomAnswers);
    setCurrentIndex(totalQuestions - 1);
    setTouched(false);
    setApiError("");
    setIsSubmitting(true);
    await submitAnswers(randomAnswers);
  };

  const resetQuiz = () => {
    setAnswersById({});
    setCurrentIndex(0);
    setSubmitted(false);
    setTouched(false);
    setApiResult(null);
    setApiError("");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RESULT_STORAGE_KEY);
  };

  return (
    <>
      <section className="page-header">
        <h1>🐾 Person-Pet Quiz</h1>
        <p>Discover which pet matches your personality through our fun AI-powered quiz.</p>
      </section>

      <section className="quiz-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p>
          Question {currentIndex + 1} of {totalQuestions} | Answered {answeredCount}/{totalQuestions}
        </p>
      </section>

      <section className="quiz-container">
        <div className="quiz-card">
          {submitted ? (
            <div className="quiz-result-panel">
              <h2>🐾 Your Result Is Ready</h2>
              <img
                src={displayResult.imageUrl}
                alt={displayResult.name || "Recommended pet"}
                className="quiz-result-image quiz-result-image--large"
              />
              <h3>{displayResult.name}</h3>
              <p>{displayResult.summary}</p>
              <p className="quiz-hint">Confidence: {Math.round((displayResult.confidence || 0) * 100)}%</p>
              <p className="quiz-hint">Top traits: {scoring.topTraits.map((item) => item.key).join(", ")}</p>
              {displayResult.grounding.length > 0 && (
                <p className="quiz-hint">Grounded from: {displayResult.grounding[0].source}</p>
              )}
              {apiError && <p className="quiz-error">{apiError}</p>}
              <div className="quiz-buttons">
                <button className="btn btn-primary" type="button" onClick={resetQuiz}>
                  Retake Quiz
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handleDebugRandomSubmit}
                  disabled={isSubmitting}
                >
                  Debug: Random Answers
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2>{currentQuestion.text}</h2>
              {currentQuestion.options.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={`option ${isSelected ? "selected" : ""}`.trim()}
                    onClick={() => selectOption(option.value)}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
              {touched && !selectedValue && (
                <p className="quiz-hint">Please select an answer before continuing.</p>
              )}
              <div className="quiz-buttons">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={goPrevious}
                  disabled={currentIndex === 0}
                >
                  Previous
                </button>
                {currentIndex < totalQuestions - 1 ? (
                  <button className="btn btn-primary" type="button" onClick={goNext}>
                    Next
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={submitQuiz}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Generating..." : "Show My Result"}
                  </button>
                )}
              </div>

              <div className="quiz-buttons" style={{ marginTop: "18px" }}>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handleDebugRandomSubmit}
                  disabled={isSubmitting}
                >
                  Debug: Random Answers
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {!submitted && (
        <section className="result-section">
          <h2>Your Future Result</h2>
          <div className="result-card">
            <i className="fas fa-paw fa-4x" />
            <h3>Complete all 20 questions for your result</h3>
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
          <div className="card">
            <i className="fas fa-user" />
            <h3>Answer Questions</h3>
            <p>Complete a short personality quiz.</p>
          </div>
          <div className="card">
            <i className="fas fa-brain" />
            <h3>AI Analysis</h3>
            <p>Our AI analyzes your personality traits.</p>
          </div>
          <div className="card">
            <i className="fas fa-dog" />
            <h3>Pet Recommendation</h3>
            <p>Receive the pet breed that suits you best.</p>
          </div>
        </div>
      </section>

      <section className="info-section">
        <div className="info-card">
          <h2>Why Take the Quiz?</h2>
          <ul>
            <li>Fun personality experience</li>
            <li>AI-powered recommendation</li>
            <li>Share your results with friends</li>
            <li>Discover your ideal pet companion</li>
          </ul>
        </div>
      </section>
    </>
  );
}
