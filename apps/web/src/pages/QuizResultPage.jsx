import { useMemo, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { exportQuizResultImage } from "../lib/shareImage";
import { resolvePetImageUrl } from "../lib/petImages";
import { buildPersonalitySummary, matchStrengthLabel } from "../lib/personalityInsights";
import { getPublicQuizResult } from "../lib/apiClient";

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

export default function QuizResultPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [sharedResult, setSharedResult] = useState(null);
  const [sharedResultError, setSharedResultError] = useState(false);

  const storedResult = useMemo(() => readStoredResult(), []);

  // Fetch shared result if ID is in URL
  useEffect(() => {
    if (!id) {
      return;
    }

    getPublicQuizResult(id)
      .then((result) => {
        if (result) {
          setSharedResult(result);
        } else {
          setSharedResultError(true);
        }
      })
      .catch(() => {
        setSharedResultError(true);
      });
  }, [id]);

  // Set Open Graph meta tags for shared results
  useEffect(() => {
    const result = sharedResult || storedResult;
    if (!result || !result.match) {
      return;
    }

    const imageUrl = resolvePetImageUrl(
      result.imageUrl || result.match.imageUrl,
      result.match.id,
      result.match.name,
      result.match.petType
    );

    // Update title and description
    document.title = `${result.match.name} - Pet Quiz Result | Purrish&Co.`;

    // Remove existing OG meta tags
    document.querySelectorAll('meta[property^="og:"]').forEach((tag) => tag.remove());

    // Add new OG meta tags
    const createMetaTag = (property, content) => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", property);
      meta.setAttribute("content", content);
      document.head.appendChild(meta);
    };

    createMetaTag("og:title", `I got ${result.match.name}!`);
    createMetaTag("og:description", result.personalitySummary || "Check out my pet personality quiz result!");
    createMetaTag("og:image", imageUrl);
    createMetaTag("og:type", "website");
    createMetaTag("og:url", window.location.href);

    return () => {
      // Cleanup: remove OG tags when component unmounts
      document.querySelectorAll('meta[property^="og:"]').forEach((tag) => tag.remove());
    };
  }, [sharedResult, storedResult]);

  const result = sharedResult || storedResult;

  if (!result) {
    return (
      <section className="page-header">
        <h1>Quiz Result</h1>
        <p>{sharedResultError ? "Result not found." : "No result found yet. Please complete the quiz first."}</p>
        <div className="hero-buttons" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/quiz")}>
            Go to Quiz
          </button>
        </div>
      </section>
    );
  }

  const personalitySummary = result.personalitySummary || buildPersonalitySummary(result.topTraits || []);
  const matchStrength = matchStrengthLabel(result.match?.confidence || 0);

  const imageUrl = resolvePetImageUrl(
    result.imageUrl || result.match?.imageUrl,
    result.match?.id,
    result.match?.name,
    result.match?.petType
  );

  return (
    <>
      <section className="page-header">
        <h1><img src="/business_assets/purrish_pet-06.png" alt="" className="inline-pet-icon" /> Your Quiz Result</h1>
        <p>Here's what your answers reveal about you and your ideal pet match.</p>
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
          <p>{personalitySummary}</p>
          <p className="quiz-hint">{result.summary}</p>
          <p className="quiz-hint">A {result.match?.name || "pet"} looks like {matchStrength} for your personality!</p>
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
              Retake Quiz
            </button>
          </div>
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
