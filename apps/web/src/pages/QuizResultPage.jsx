import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { exportQuizResultImage } from "../lib/shareImage";
import { resolvePetImageUrl } from "../lib/petImages";

const RESULT_STORAGE_KEY = "purrishco.quiz.result.v1";

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

  const result = useMemo(() => readStoredResult(), []);

  if (!result) {
    return (
      <section className="page-header">
        <h1>Quiz Result</h1>
        <p>No result found yet. Please complete the quiz first.</p>
        <div className="hero-buttons" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/quiz")}>
            Go to Quiz
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

  return (
    <>
      <section className="page-header">
        <h1>🐾 Your Quiz Result</h1>
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
              Explore products in the <Link to="/shop">shop page</Link>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
