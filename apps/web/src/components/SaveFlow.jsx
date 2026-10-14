import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";

const DISMISS_KEY = "purrishco.savePrompt.dismissed";
const MODAL_DELAY_MS = 4000;
const TOAST_MS = 5000;

function wasDismissed(itemId) {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]").includes(itemId); } catch { return false; }
}

function remember(itemId) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]").slice(-50), itemId])); } catch { /* storage unavailable */ }
}

// Signed in: runs save(getIdToken) once per item and confirms with a toast.
// Signed out: after a short read time, offers a popup to sign up and keep it.
export default function SaveFlow({ itemId, save, savedText, errorText, modalTitle, modalBody, next, active = true }) {
  const { user, loading, getIdToken } = useAuth();
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const savedFor = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!user || !itemId || savedFor.current === itemId) return;
    savedFor.current = itemId;
    (async () => {
      try {
        await saveRef.current(getIdToken);
        setToast({ ok: true, text: savedText });
      } catch (error) {
        if (error.message !== "already_claimed") setToast({ ok: false, text: errorText });
      }
    })();
  }, [user, itemId, getIdToken, savedText, errorText]);

  useEffect(() => {
    if (!active || loading || user || !itemId || wasDismissed(itemId)) return undefined;
    const timer = setTimeout(() => setModalOpen(true), MODAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, loading, user, itemId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function closeModal() {
    remember(itemId);
    setModalOpen(false);
  }

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  if (!itemId) return null;
  const target = encodeURIComponent(next);

  return createPortal(
    <>
      {toast && (
        <div className={`toast ${toast.ok ? "toast--ok" : "toast--error"}`} role="status" aria-live="polite">
          <span>{toast.text}</span>
          {toast.ok && <Link to="/profile">View profile</Link>}
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
      )}
      {modalOpen && active && !user && (
        <div className="save-modal-backdrop" onClick={closeModal}>
          <div className="save-modal" role="dialog" aria-modal="true" aria-labelledby="save-modal-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="save-modal-title">{modalTitle}</h2>
            <p>{modalBody}</p>
            <div className="save-modal-actions">
              <Link className="btn btn-primary" to={`/login?mode=signup&next=${target}`} onClick={() => remember(itemId)}>Sign up to save</Link>
              <Link className="btn btn-outline" to={`/login?next=${target}`} onClick={() => remember(itemId)}>I have an account</Link>
            </div>
            <button type="button" className="save-modal-skip" onClick={closeModal}>Not now</button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
