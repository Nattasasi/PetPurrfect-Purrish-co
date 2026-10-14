import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { claimQuizResult } from "../lib/apiClient";

const DISMISS_KEY = "purrishco.savePrompt.dismissed";

function readSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
}

function addToSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify([...readSet(key), value])); } catch { /* storage unavailable */ }
}

// Offers to attach a freshly generated result to the signed-in user's profile.
export default function SaveResultPrompt({ resultId, sessionId, label = "result" }) {
  const { user, loading, getIdToken } = useAuth();
  const [params] = useSearchParams();
  const [status, setStatus] = useState("idle");
  const [dismissed, setDismissed] = useState(() => readSet(DISMISS_KEY).has(resultId));
  const autoTried = useRef(false);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await claimQuizResult(await getIdToken(), resultId, sessionId);
      setStatus("saved");
    } catch (error) {
      setStatus(error.message === "already_claimed" ? "saved" : "error");
    }
  }, [getIdToken, resultId, sessionId]);

  // Returning from sign up with ?save=1 completes the save automatically.
  useEffect(() => {
    if (user && params.get("save") === "1" && !autoTried.current && resultId && sessionId) {
      autoTried.current = true;
      save();
    }
  }, [user, params, resultId, sessionId, save]);

  if (!resultId || !sessionId || loading || dismissed) return null;

  const dismiss = () => {
    addToSet(DISMISS_KEY, resultId);
    setDismissed(true);
  };

  if (status === "saved") {
    return (
      <div className="info-card" role="status">
        <h3>Saved to your profile</h3>
        <p><Link to="/profile">View it on your profile</Link></p>
      </div>
    );
  }

  const next = encodeURIComponent("/quiz/result?save=1");
  return (
    <div className="info-card">
      <h3>Save this {label} to your profile</h3>
      <p>{user ? "Keep it so you can come back to it anytime." : "Create a free account to keep it, add your pet, and get care reminders."}</p>
      {status === "error" && <p className="quiz-error" role="alert">Couldn't save right now. Please try again.</p>}
      <div className="quiz-buttons">
        {user ? (
          <button className="btn btn-primary" type="button" disabled={status === "saving"} onClick={save}>
            {status === "saving" ? "Saving..." : "Save to profile"}
          </button>
        ) : (
          <Link className="btn btn-primary" to={`/login?mode=signup&next=${next}`}>Sign up to save</Link>
        )}
        <button className="btn btn-outline" type="button" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
