import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";

// Only same-site paths are allowed as redirect targets.
function safeNext(value) {
  return typeof value === "string" && /^\/(?!\/)/.test(value) ? value : null;
}

export default function LoginPage() {
  const {
    user,
    loading,
    pending,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    clearError
  } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "login");
  const resetMode = mode === "reset";
  const [notice, setNotice] = useState("");

  // Signed-in users never see this page; they go to their profile (or the page they came from).
  if (user) return <Navigate to={next || "/profile"} replace />;

  const updateField = (setter) => (event) => {
    setter(event.target.value);
    setNotice("");
    if (error) clearError();
  };

  const switchMode = (target) => {
    setMode(target);
    setPassword("");
    setNotice("");
    clearError();
  };

  const handleGoogle = async () => {
    setNotice("");
    try {
      await signInWithGoogle();
    } catch {
      // AuthProvider exposes the sanitized error below the form.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice("");
    try {
      if (resetMode) {
        await sendPasswordReset(email);
        setNotice("If an account uses this email, a password-reset link has been sent.");
        return;
      }
      if (mode === "signup") await signUp({ email, password });
      else await signIn({ email, password });
      setPassword("");
    } catch {
      // AuthProvider exposes the sanitized error below the form.
    }
  };

  return (
    <>
      <section className="page-header auth-page-header">
        <h1>{mode === "signup" ? "Create Your Account" : "Welcome Back"}</h1>
        <p>{mode === "signup" ? "Save your quiz results and manage your pets." : "Sign in securely with your Purrish&Co. account."}</p>
      </section>

      <section className="auth-section" aria-busy={loading || pending}>
        <div className="auth-card">
          {loading ? (
            <p className="auth-status" role="status">Restoring your session...</p>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-card-heading">
                <span className="auth-kicker">Customer account</span>
                <h2>{resetMode ? "Reset Your Password" : mode === "signup" ? "Sign Up" : "Log In"}</h2>
                <p>
                  {resetMode
                    ? "Enter your account email and we’ll send a secure reset link."
                    : mode === "signup"
                      ? "Create an account with your email or Google."
                      : "Use the email and password connected to your account."}
                </p>
              </div>

              {!resetMode && (
                <>
                  <button className="btn auth-google" type="button" disabled={pending} onClick={handleGoogle}>
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
                      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
                    </svg>
                    Continue with Google
                  </button>
                  <p className="auth-divider"><span>or</span></p>
                </>
              )}

              <label htmlFor="customer-email">Email address</label>
              <input
                id="customer-email"
                name="email"
                type="email"
                value={email}
                onChange={updateField(setEmail)}
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
              />

              {!resetMode && (
                <>
                  <label htmlFor="customer-password">Password</label>
                  <input
                    id="customer-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={updateField(setPassword)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                </>
              )}

              {error && <p className="auth-message auth-error" role="alert">{error.message}</p>}
              {notice && <p className="auth-message auth-success" role="status">{notice}</p>}

              <button className="btn btn-primary auth-submit" type="submit" disabled={pending}>
                {pending ? "Please wait..." : resetMode ? "Send Reset Link" : mode === "signup" ? "Create Account" : "Log In"}
              </button>
              {resetMode ? (
                <button className="auth-text-button" type="button" disabled={pending} onClick={() => switchMode("login")}>
                  Back to login
                </button>
              ) : (
                <>
                  <button className="auth-text-button" type="button" disabled={pending} onClick={() => switchMode(mode === "signup" ? "login" : "signup")}>
                    {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
                  </button>
                  {mode === "login" && (
                    <button className="auth-text-button" type="button" disabled={pending} onClick={() => switchMode("reset")}>
                      Forgot your password?
                    </button>
                  )}
                </>
              )}
            </form>
          )}

        </div>
      </section>
    </>
  );
}
