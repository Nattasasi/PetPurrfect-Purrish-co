import { useEffect, useMemo, useRef, useState } from "react";
import staticQuizQuestions from "../data/quizQuestions.json";
import { scoreQuiz } from "../lib/quizScoring";
import { postJson, getJson, createSessionId } from "../lib/apiClient";
import { getPetImageById, resolvePetImageUrl } from "../lib/petImages";
import { exportQuizResultImage, createQuizResultImageFile } from "../lib/shareImage";
import { useInMemoryPageState } from "../lib/inMemoryPageState";
import { buildPersonalitySummary, matchStrengthLabel } from "../lib/personalityInsights";
import ShareResultCard from "../components/share/ShareResultCard";

const RESULT_STORAGE_KEY = "purrishco.quiz.result.v2";
const STATIC_QUESTION_COUNT = 5;
const ADAPTIVE_QUESTION_COUNT = 5;
const TOTAL_QUESTION_COUNT = STATIC_QUESTION_COUNT + ADAPTIVE_QUESTION_COUNT;
// Slot plan interleaves static (instant) and adaptive (generated) questions so
// each adaptive question can be generated in the background while the user is
// answering the static question right before it, hiding Ollama's latency.
// Layout: S S A S A S A S A, then the discriminator question is appended last.
const SLOT_TYPES = ["static", "static", "adaptive", "static", "adaptive", "static", "adaptive", "static", "adaptive"];
const STATIC_SLOTS = SLOT_TYPES.reduce((acc, type, index) => (type === "static" ? [...acc, index] : acc), []);
const ADAPTIVE_SLOTS = SLOT_TYPES.reduce((acc, type, index) => (type === "adaptive" ? [...acc, index] : acc), []);
// Maps a static checkpoint slot to the adaptive slot that should start generating in the background as soon as the checkpoint is shown.
const ADAPTIVE_PREFETCH_CHECKPOINTS = ADAPTIVE_SLOTS.reduce((acc, slotIndex) => ({ ...acc, [slotIndex - 1]: slotIndex }), {});
const DISCRIMINATOR_TRIGGER_SLOT = ADAPTIVE_SLOTS[ADAPTIVE_SLOTS.length - 1];
const PRE_DISCRIMINATOR_SLOT_COUNT = SLOT_TYPES.length;
const TRAIT_SHORT_LABELS = {
  energy: "E",
  sociability: "S",
  stranger_friendly: "F",
  routine: "R",
  trainability: "T"
};
const DEBUG_MATCHES = [
  { id: "golden_retriever", name: "Golden Retriever", petType: "dog", summary: "Friendly, social, and well-suited to active owners." },
  { id: "labrador_retriever", name: "Labrador Retriever", petType: "dog", summary: "Warm, upbeat, and happiest when life is active and social." },
  { id: "corgi", name: "Corgi", petType: "dog", summary: "Cheerful, people-loving, and better with structure than chaos." },
  { id: "poodle", name: "Poodle", petType: "dog", summary: "Smart, adaptable, and quick to pick up on your rhythms." },
  { id: "shiba_inu", name: "Shiba Inu", petType: "dog", summary: "Independent, alert, and confident with a balanced routine." },
  { id: "husky", name: "Husky", petType: "dog", summary: "Energetic, bold, and happiest when life has room to roam." },
  { id: "ragdoll_cat", name: "Ragdoll Cat", petType: "cat", summary: "Calm, affectionate, and ideal for relaxed households." },
  { id: "siamese_cat", name: "Siamese Cat", petType: "cat", summary: "Expressive, social, and always ready to be part of the moment." },
  { id: "persian_cat", name: "Persian Cat", petType: "cat", summary: "Soft-spoken, low-key, and happiest in a calm, comfy setting." },
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

function formatOptionScore(option) {
  return Object.entries(option.traits || {})
    .filter(([trait]) => TRAIT_SHORT_LABELS[trait])
    .map(([trait, value]) => `${TRAIT_SHORT_LABELS[trait]} ${value >= 0 ? "+" : ""}${value}`)
    .join(" · ");
}

const STATIC_QUESTIONS = staticQuizQuestions
  .slice(0, STATIC_QUESTION_COUNT)
  .map((question) => ({ ...question, options: shuffleOptions(question.options) }));

function buildInitialQuestions() {
  const slots = new Array(PRE_DISCRIMINATOR_SLOT_COUNT).fill(null);
  STATIC_SLOTS.forEach((slotIndex, order) => {
    slots[slotIndex] = STATIC_QUESTIONS[order];
  });
  return slots;
}

// Answers for every resolved slot before `beforeIndex`, used as the growing context sent to Ollama.
function buildAnsweredSoFar(questionsSnapshot, answersSnapshot, beforeIndex) {
  const list = [];
  for (let index = 0; index < beforeIndex; index += 1) {
    const question = questionsSnapshot[index];
    if (!question) continue;
    const option = question.options.find((item) => item.value === answersSnapshot[question.id]);
    if (option) list.push({ text: question.text, label: option.label });
  }
  return list;
}

export default function QuizPage() {
  const [sessionId] = useInMemoryPageState("quiz.sessionId", createSessionId);
  const [questions, setQuestions] = useInMemoryPageState("quiz.questions", buildInitialQuestions);
  const [adaptiveLoading, setAdaptiveLoading] = useInMemoryPageState("quiz.adaptiveLoading", false);
  const [adaptiveError, setAdaptiveError] = useInMemoryPageState("quiz.adaptiveError", "");
  const [currentIndex, setCurrentIndex] = useInMemoryPageState("quiz.currentIndex", 0);
  const [answersById, setAnswersById] = useInMemoryPageState("quiz.answers", {});
  const [touched, setTouched] = useInMemoryPageState("quiz.touched", false);
  const [submitted, setSubmitted] = useInMemoryPageState("quiz.submitted", false);
  const [isSubmitting, setIsSubmitting] = useInMemoryPageState("quiz.isSubmitting", false);
  const [apiResult, setApiResult] = useInMemoryPageState("quiz.apiResult", null);
  const [apiError, setApiError] = useInMemoryPageState("quiz.apiError", "");
  const [showExplanation, setShowExplanation] = useState(false);
  const [debugScoreBreakdown, setDebugScoreBreakdown] = useState(null);
  const [profileData, setProfileData] = useState(null);
  // Tracks in-flight/settled background prefetch requests per slot index so a checkpoint never double-fires.
  const adaptiveFetchRef = useRef({});

  useEffect(() => {
    getJson("/api/quiz/profiles")
      .then(setProfileData)
      .catch(() => setProfileData(null));
  }, []);

  const currentQuestion = questions[currentIndex] || null;
  const selectedValue = currentQuestion ? answersById[currentQuestion.id] ?? "" : "";
  const progress = ((currentIndex + 1) / TOTAL_QUESTION_COUNT) * 100;

  const scoring = useMemo(
    () => scoreQuiz(questions.filter(Boolean), answersById, profileData),
    [questions, answersById, profileData]
  );

  const displayResult = useMemo(() => {
    if (apiResult?.match) {
      return {
        id: apiResult.match.id,
        name: apiResult.match.name,
        summary: apiResult.summary || "AI result generated.",
        personalitySummary: apiResult.personalitySummary || "",
        confidence: apiResult.match.confidence,
        grounding: apiResult.grounding || [],
        shareCaptions: apiResult.shareCaptions || [],
        imageUrl: resolvePetImageUrl(
          apiResult.match.imageUrl || apiResult.imageUrl,
          apiResult.match.id,
          apiResult.match.name,
          apiResult.match.petType
        )
      };
    }

    return {
      id: scoring.recommendation.id,
      name: scoring.recommendation.name,
      summary: scoring.recommendation.summary,
      personalitySummary: "",
      confidence: scoring.recommendation.confidence,
      grounding: [],
      shareCaptions: [],
      imageUrl: getPetImageById(scoring.recommendation.id, scoring.recommendation.name)
    };
  }, [apiResult, scoring]);

  // Starts (or reuses an in-flight) background request for the adaptive question at slotIndex,
  // using whatever answers have accumulated before checkpointIndex. Returns the shared promise so
  // both the silent background trigger and an on-demand caller can await the same request.
  const startAdaptivePrefetch = (slotIndex, checkpointIndex) => {
    if (adaptiveFetchRef.current[slotIndex]) {
      return adaptiveFetchRef.current[slotIndex];
    }
    const ordinal = ADAPTIVE_SLOTS.indexOf(slotIndex);
    const answeredSoFar = buildAnsweredSoFar(questions, answersById, checkpointIndex);
    const previousQuestionTexts = ADAPTIVE_SLOTS
      .filter((adaptiveSlot) => adaptiveSlot < slotIndex && questions[adaptiveSlot])
      .map((adaptiveSlot) => questions[adaptiveSlot].text);

    const promise = postJson("/api/quiz/questions/adaptive", {
      sessionId,
      answeredSoFar,
      previousQuestionTexts,
      questionCount: 1,
      questionOffset: STATIC_QUESTION_COUNT + ordinal
    }).then((result) => {
      if (result.source !== "ollama" || !Array.isArray(result.questions) || result.questions.length !== 1) {
        throw new Error("Ollama did not return the next question.");
      }
      const [question] = result.questions;
      setQuestions((prev) => {
        const next = [...prev];
        next[slotIndex] = question;
        return next;
      });
      return question;
    }).catch((error) => {
      // Clear the cache so a retry (background or on-demand) can be attempted again.
      delete adaptiveFetchRef.current[slotIndex];
      throw error;
    });

    adaptiveFetchRef.current[slotIndex] = promise;
    return promise;
  };

  // Silently kicks off the next adaptive question's generation while the user is still on the static checkpoint question right before it.
  useEffect(() => {
    const slotIndex = ADAPTIVE_PREFETCH_CHECKPOINTS[currentIndex];
    if (slotIndex === undefined || questions[slotIndex] || adaptiveFetchRef.current[slotIndex]) {
      return;
    }
    startAdaptivePrefetch(slotIndex, currentIndex).catch(() => {
      // Swallowed here; ensureAdaptiveSlotResolved surfaces the error if the user reaches this slot before a retry succeeds.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Awaits (or starts) the adaptive fetch for slotIndex, showing the loading state only if it hasn't already resolved in the background.
  const ensureAdaptiveSlotResolved = async (slotIndex) => {
    if (questions[slotIndex]) return true;
    setAdaptiveLoading(true);
    setAdaptiveError("");
    try {
      await startAdaptivePrefetch(slotIndex, slotIndex - 1);
      return true;
    } catch (error) {
      setAdaptiveError(error?.message || "We couldn't generate your personalized questions. Please try again.");
      return false;
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const fetchDiscriminatorQuestion = async (answersSnapshot) => {
    setAdaptiveLoading(true);
    setAdaptiveError("");
    try {
      const discriminatorTraits = scoreQuiz(questions.filter(Boolean), answersSnapshot, profileData).normalized;
      const result = await postJson("/api/quiz/discriminator-question", {
        sessionId,
        traits: discriminatorTraits
      });
      if (!result.question || !Array.isArray(result.question.options) || result.question.options.length !== 4) {
        throw new Error("The final matching question was invalid.");
      }
      setQuestions((prev) => [...prev, result.question]);
      return true;
    } catch (error) {
      setAdaptiveError(error?.message || "We couldn't generate your personalized questions. Please try again.");
      return false;
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const retryPendingGeneration = async () => {
    if (currentIndex === DISCRIMINATOR_TRIGGER_SLOT) {
      const generated = await fetchDiscriminatorQuestion(answersById);
      if (generated) setCurrentIndex((prev) => prev + 1);
      return;
    }
    const slotIndex = currentIndex + 1;
    const generated = await ensureAdaptiveSlotResolved(slotIndex);
    if (generated) setCurrentIndex((prev) => prev + 1);
  };

  const submitAnswers = async (answersMap, questionsForScoring = questions) => {
    const computedScoring = scoreQuiz(questionsForScoring, answersMap, profileData);
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
        imageUrl: getPetImageById(computedScoring.recommendation.id, computedScoring.recommendation.name)
      },
      summary: computedScoring.recommendation.summary,
      personalitySummary: "",
      grounding: [],
      topTraits: computedScoring.topTraits,
      traits: computedScoring.normalized,
      imageUrl: getPetImageById(computedScoring.recommendation.id, computedScoring.recommendation.name),
      answers
    };

    try {
      const result = await postJson("/api/quiz/evaluate", {
        sessionId,
        answers,
        questionCount: questionsForScoring.length,
        traits: computedScoring.normalized,
        topTraits: computedScoring.topTraits,
        discriminatorQuestion: questionsForScoring.find((question) => question.id === "adaptive-q10") || null
      });


      setApiResult(result);
      resultPayload = {
        ...resultPayload,
        source: "api",
        persistence: result.persistence || null,
        match: {
          id: result.match?.id || computedScoring.recommendation.id,
          name: result.match?.name || computedScoring.recommendation.name,
          petType: result.match?.petType,
          confidence:
            typeof result.match?.confidence === "number"
              ? result.match.confidence
              : computedScoring.recommendation.confidence,
          imageUrl: resolvePetImageUrl(
            result.match?.imageUrl || result.imageUrl,
            result.match?.id || computedScoring.recommendation.id,
            result.match?.name || computedScoring.recommendation.name,
            result.match?.petType
          )
        },
        summary: result.summary || computedScoring.recommendation.summary,
        personalitySummary: result.personalitySummary || "",
        grounding: result.grounding || [],
        shareCaptions: result.shareCaptions || [],
        imageUrl: resolvePetImageUrl(
          result.match?.imageUrl || result.imageUrl,
          result.match?.id || computedScoring.recommendation.id,
          result.match?.name || computedScoring.recommendation.name,
          result.match?.petType
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
    if (currentIndex === TOTAL_QUESTION_COUNT - 1) {
      setApiError("");
      setIsSubmitting(true);
      await submitAnswers(nextAnswers);
      return;
    }

    if (currentIndex === DISCRIMINATOR_TRIGGER_SLOT) {
      const generated = await fetchDiscriminatorQuestion(nextAnswers);
      if (generated) setCurrentIndex((prev) => prev + 1);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (!questions[nextIndex]) {
      const generated = await ensureAdaptiveSlotResolved(nextIndex);
      if (!generated) return;
    }
    setCurrentIndex(nextIndex);
  };

  const selectOption = async (value) => {
    setAnswersById((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setTouched(false);
    await goNext(value);
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
    adaptiveFetchRef.current = {};
    setQuestions(buildInitialQuestions());
    setDebugScoreBreakdown(null);
  };

  const showDebugResult = async () => {
    const resolvedQuestions = questions.filter(Boolean);
    const debugAnswers = resolvedQuestions.map((question) => {
      const option = question.options[Math.floor(Math.random() * question.options.length)];
      return { questionId: question.id, value: option.value };
    });
    const debugAnswersById = Object.fromEntries(
      debugAnswers.map((answer) => [answer.questionId, answer.value])
    );
    const computedScoring = scoreQuiz(resolvedQuestions, debugAnswersById, profileData);
    setDebugScoreBreakdown({
      raw: computedScoring.raw,
      normalized: computedScoring.normalized,
      topTraits: computedScoring.topTraits,
      answers: debugAnswers
    });

    try {
      const result = await postJson("/api/quiz/evaluate", {
        sessionId,
        answers: debugAnswers,
        questionCount: debugAnswers.length,
        traits: computedScoring.normalized,
        topTraits: computedScoring.topTraits
      });
      setApiResult(result);
      setApiError("");
      setSubmitted(true);
    } catch {
      const fallbackMatch = DEBUG_MATCHES[Math.floor(Math.random() * DEBUG_MATCHES.length)];
      setApiResult({
        match: {
          ...fallbackMatch,
          confidence: computedScoring.recommendation.confidence,
          imageUrl: getPetImageById(fallbackMatch.id, fallbackMatch.name, fallbackMatch.petType)
        },
        summary: `${fallbackMatch.summary} This is a local debug fallback.`,
        personalitySummary: buildPersonalitySummary(computedScoring.topTraits),
        grounding: [],
        traits: computedScoring.normalized,
        topTraits: computedScoring.topTraits
      });
      setApiError("AI service is currently unavailable. Showing a local debug fallback.");
      setSubmitted(true);
    }
  };

  return (
    <>
      <section className="page-header">
        <h1><img src="/business_assets/purrish_pet-07.png" alt="" className="inline-pet-icon" /> Person-Pet Quiz</h1>
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
              <img src="/business_assets/purrish_pet-06.png" alt="" className="quiz-loading-paw" />
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
              <button className="btn btn-primary" type="button" onClick={retryPendingGeneration}>
                Try Again
              </button>
            </div>
          ) : !currentQuestion ? (
            <div className="quiz-loading" role="status" aria-live="polite">
              <img src="/business_assets/purrish_pet-06.png" alt="" className="quiz-loading-paw" />
              <p className="quiz-loading-kicker">A fresh question is taking shape</p>
              <h2>Thinking beyond the obvious...</h2>
              <p className="quiz-hint">Finding a curious little twist that feels like you.</p>
            </div>
          ) : isSubmitting ? (
            <div className="quiz-loading quiz-loading--matching" role="status" aria-live="polite">
              <img src="/business_assets/purrish_pet-06.png" alt="" className="quiz-loading-paw" />
              <p className="quiz-loading-kicker">Your answers are in</p>
              <h2>Finding your perfect pet match...</h2>
              <p className="quiz-hint">We're comparing your personality with our breed knowledge base.</p>
              <div className="quiz-loading-steps" aria-hidden="true">
                <span><i className="fas fa-user-check" /> Reading your vibe</span>
                <span><i className="fas fa-magnifying-glass" /> Comparing breeds</span>
                <span><i className="fas fa-heart" /> Choosing your match</span>
              </div>
            </div>
          ) : submitted ? (
            <div className="quiz-result-panel">
              <h2><img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" /> Your Result Is Ready</h2>
              <img src={displayResult.imageUrl} alt={displayResult.name || "Recommended pet"} className="quiz-result-image quiz-result-image--large" />
              <p className="result-eyebrow">Your personality match</p>
              <div className="result-heading-row">
                <h3>{displayResult.name}</h3>
                <button
                  type="button"
                  className="result-explanation-btn"
                  aria-expanded={showExplanation}
                  aria-label="Why this match?"
                  onClick={() => setShowExplanation((value) => !value)}
                >
                  ?
                </button>
              </div>
              <p className="result-summary">{displayResult.personalitySummary || buildPersonalitySummary(scoring.topTraits)}</p>
              {showExplanation && (
                <p className="quiz-hint result-traits">{displayResult.summary}</p>
              )}
              {apiError && <p className="quiz-error">{apiError}</p>}
              {import.meta.env.DEV && debugScoreBreakdown && (
                <section className="quiz-debug-breakdown" aria-label="Debug score breakdown">
                  <h4>Score Breakdown</h4>
                  <div className="quiz-debug-grid">
                    <div>
                      <p className="quiz-debug-label">Raw Traits</p>
                      <ul className="quiz-debug-list">
                        {Object.entries(debugScoreBreakdown.raw).map(([trait, value]) => (
                          <li key={trait}><strong>{trait}</strong>: {value}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="quiz-debug-label">Normalized Traits</p>
                      <ul className="quiz-debug-list">
                        {Object.entries(debugScoreBreakdown.normalized).map(([trait, value]) => (
                          <li key={trait}><strong>{trait}</strong>: {value}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="quiz-debug-label">Top Traits</p>
                    <ul className="quiz-debug-list quiz-debug-list--compact">
                      {debugScoreBreakdown.topTraits.map((trait) => (
                        <li key={trait.key}><strong>{trait.key}</strong>: {trait.value}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
              <div className="quiz-buttons">
                <button className="btn btn-outline" type="button" onClick={resetQuiz}>
                  <i className="fas fa-rotate-left" aria-hidden="true" /> Retake Quiz
                </button>
                <ShareResultCard
                  title="Share your quiz result"
                  subtitle={`${displayResult.name} · ${matchStrengthLabel(displayResult.confidence || 0)}`}
                  shareText={`The Purrish&Co. quiz says I'm a match for a ${displayResult.name}! Curious what pet fits YOU? Take the quiz!`}
                  shareCaptions={displayResult.shareCaptions}
                  crossPromoText="Want to turn this personality into a personalized pet sticker?"
                  crossPromoPath="/pet"
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
                  <span className="option-label-text">{option.label}</span>
                  {import.meta.env.DEV && (
                    <span className="option-score-text" aria-label={`Option score ${formatOptionScore(option)}`}>
                      {formatOptionScore(option)}
                    </span>
                  )}
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
    </>
  );
}
