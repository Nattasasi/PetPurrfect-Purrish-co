import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { exportQuizResultImage, createQuizResultImageFile } from "../lib/shareImage";
import { resolvePetImageUrl } from "../lib/petImages";
import { getPublicQuizResult, trackLandingEvent } from "../lib/apiClient";
import ShareResultCard from "../components/share/ShareResultCard";

const RESULT_STORAGE_KEY = "purrishco.quiz.result.v2";
const QUIZ_STORAGE_VERSION_KEY = "purrishco.quiz.storage.version";
const QUIZ_STORAGE_VERSION = "v5";

function clearPreviousQuizData() {
  try {
    if (localStorage.getItem(QUIZ_STORAGE_VERSION_KEY) === QUIZ_STORAGE_VERSION) {
      return;
    }
    [
      "purrishco.quiz.answers.v1",
      "purrishco.quiz.answers.v2",
      "purrishco.quiz.result.v1",
      "purrishco.quiz.result.v2",
      "purrishco.quiz.questions.v2",
      "purrishco.quiz.questions.v3.ollama"
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(QUIZ_STORAGE_VERSION_KEY, QUIZ_STORAGE_VERSION);
  } catch {
    // Ignore storage restrictions and show no stale result.
  }
}

clearPreviousQuizData();

function readStoredResult() {
  try {
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Normalizes the sanitized public API result into the shape this page renders.
function publicResultToViewModel(publicResult) {
  return {
    match: {
      id: publicResult.matchId,
      name: publicResult.matchName || "Pet Match",
      confidence: publicResult.confidence ?? 0,
      imageUrl: null
    },
    topTraits: publicResult.topTraits || [],
    shareCaptions: publicResult.shareCaptions || [],
    summary:
      "A Purrish&Co. user took the person-pet personality quiz and got this match. Take the quiz yourself to find the pet that fits your lifestyle!",
    traits: publicResult.traits || {},
    sharedView: true
  };
}

export default function QuizResultPage() {
  const navigate = useNavigate();
  const { id: sharedResultId } = useParams();
  const [searchParams] = useSearchParams();
  const [sharedResult, setSharedResult] = useState(null);
  const [sharedLoadState, setSharedLoadState] = useState("idle");
  const landingTrackedRef = useRef(false);

  const localResult = useMemo(() => readStoredResult(), []);
  const isSharedView = Boolean(sharedResultId);
  const result = isSharedView ? sharedResult : localResult;

  // Load the public result when arriving via a shared link.
  useEffect(() => {
    if (!sharedResultId) {
      return;
    }
    setSharedLoadState("loading");
    getPublicQuizResult(sharedResultId).then((publicResult) => {
      setSharedResult(publicResult ? publicResultToViewModel(publicResult) : null);
      setSharedLoadState(publicResult ? "ready" : "missing");
    });
  }, [sharedResultId]);

  // Record the landing once for UTM attribution (viral funnel measurement).
  useEffect(() => {
    if (landingTrackedRef.current) {
      return;
    }
    const utmSource = searchParams.get("utm_source");
    if (!utmSource) {
      return;
    }
    landingTrackedRef.current = true;
    trackLandingEvent({
      resultId: sharedResultId || null,
      utmSource,
      utmMedium: searchParams.get("utm_medium"),
      utmCampaign: searchParams.get("utm_campaign")
    });
  }, [searchParams, sharedResultId]);

  if (isSharedView && sharedLoadState === "loading") {
    return (
      <section className="page-header">
        <h1>Quiz Result</h1>
        <p>Loading shared result…</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="page-header">
        <h1>Quiz Result</h1>
        <p>
          {isSharedView
            ? "This shared result isn't available anymore — but you can find your own perfect pet match!"
            : "No result found yet. Please complete the quiz first."}
        </p>
        <div className="hero-buttons" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/quiz")}>
            Take the Quiz
          </button>
        </div>
      </section>
    );
  }

  const confidence = Math.round((result.match?.confidence || 0) * 100);
  const topTraits = (result.topTraits || [])
    .slice(0, 3)
    .map((item) => item.key)
    .join(", ");

  const imageUrl = resolvePetImageUrl(result.imageUrl || result.match?.imageUrl, result.match?.id);
  // The sharer's persisted id drives the public share URL; a visitor re-sharing
  // keeps pointing at the same public result.
  const resultId = result.persistence?.id || (isSharedView ? sharedResultId : null);
  const sharePath = resultId ? `/quiz/result/${resultId}` : null;

  return (
    <>
      {isSharedView && (
        <section className="referral-banner">
          <p>
            🎉 A friend got matched with a <strong>{result.match?.name}</strong> on Purrish&Co.!
            Curious which pet fits <em>your</em> personality?
          </p>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/quiz")}>
            Take the Free Quiz →
          </button>
        </section>
      )}

      <section className="page-header">
        <h1>🐾 {isSharedView ? "Shared Quiz Result" : "Your Quiz Result"}</h1>
        <p>Here is your AI-grounded personality match.</p>
      </section>

      <section className="result-section">
        <div className="result-card">
          <img
            src={imageUrl}
            alt={result.match?.name || "Recommended pet"}
            className="quiz-result-image"
          />
          <i className="fas fa-paw fa-4x" />
          <h3>{result.match?.name || "Your Pet Match"}</h3>
          <p>{result.summary}</p>
          <p className="quiz-hint">Confidence: {confidence}%</p>
          <p className="quiz-hint">Top traits: {topTraits || "balanced"}</p>
          {result.grounding?.length > 0 && (
            <p className="quiz-hint">Grounded from: {result.grounding[0].source}</p>
          )}
          {result.error && <p className="quiz-error">{result.error}</p>}

          <div className="quiz-buttons">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => exportQuizResultImage(result)}
            >
              Download Result PNG
            </button>
            <button className="btn btn-outline" type="button" onClick={() => navigate("/quiz")}>
              {isSharedView ? "Take the Quiz Yourself" : "Retake Quiz"}
            </button>
          </div>
          <ShareResultCard
            title={isSharedView ? "Share this result" : "Share your quiz result"}
            subtitle={`${result.match?.name || "Your Pet Match"} · ${confidence}% confidence`}
            shareText={`🐾 The Purrish&Co. quiz says I'm a match for a ${result.match?.name || "perfect pet companion"}! ${confidence}% confidence. Curious what pet fits YOU? Take the quiz! ✨`}
            shareCaptions={result.shareCaptions}
            onDownload={() => exportQuizResultImage(result)}
            getShareFile={() => createQuizResultImageFile(result)}
            resultId={resultId}
            sharePath={sharePath}
          />
        </div>
      </section>

      <section className="info-section">
        <div className="info-card">
          <h2>Next Steps</h2>
          <ul>
            <li>Share your result image with friends</li>
            <li>Try the sticker generator for your pet photo</li>
            <li>
              Explore products in the{" "}
              <a href="https://shopee.co.th/purrishandco?entryPoint=ShopBySearch&searchKeyword=purrish" target="_blank" rel="noreferrer">
                shop page
              </a>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
