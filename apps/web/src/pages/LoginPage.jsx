import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
    signOut,
    sendPasswordReset,
    sendVerificationEmail,
    refreshUser,
    clearError
  } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "login");
  const resetMode = mode === "reset";
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user && next) navigate(next, { replace: true });
  }, [user, next, navigate]);

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

  const handleVerification = async () => {
    setNotice("");
    try {
      await sendVerificationEmail();
      setNotice("Verification email sent. Open the link, then refresh your account status.");
    } catch {
      // AuthProvider exposes the sanitized error below the action.
    }
  };

  const handleRefresh = async () => {
    setNotice("");
    try {
      const refreshed = await refreshUser();
      setNotice(refreshed?.emailVerified ? "Your email is verified." : "Verification is still pending.");
    } catch {
      // AuthProvider exposes the sanitized error below the action.
    }
  };

  const handleSignOut = async () => {
    setNotice("");
    try {
      await signOut();
    } catch {
      // AuthProvider exposes the sanitized error below the action.
    }
  };

  return (
    <>
      <section className="page-header auth-page-header">
        <h1>{user ? "Your Account" : mode === "signup" ? "Create Your Account" : "Welcome Back"}</h1>
        <p>{user ? "Manage your Purrish&Co. customer session." : mode === "signup" ? "Save your quiz results and manage your pets." : "Sign in securely with your Purrish&Co. account."}</p>
      </section>

      <section className="auth-section" aria-busy={loading || pending}>
        <div className="auth-card">
          {loading ? (
            <p className="auth-status" role="status">Restoring your session...</p>
          ) : user ? (
            <div className="account-panel">
              <span className="auth-kicker">Signed in as</span>
              <h2>{user.displayName || user.email}</h2>
              {user.displayName && <p className="account-email">{user.email}</p>}
              <Link className="btn btn-outline" to="/profile">Go to my profile</Link>
              <span className={`account-verification ${user.emailVerified ? "is-verified" : ""}`}>
                {user.emailVerified ? "Email verified" : "Email not verified"}
              </span>

              {!user.emailVerified && (
                <div className="auth-actions">
                  <button className="btn btn-outline" type="button" disabled={pending} onClick={handleVerification}>
                    Send Verification Email
                  </button>
                  <button className="auth-text-button" type="button" disabled={pending} onClick={handleRefresh}>
                    Refresh status
                  </button>
                </div>
              )}

              <button className="btn btn-primary auth-submit" type="button" disabled={pending} onClick={handleSignOut}>
                {pending ? "Please wait..." : "Sign Out"}
              </button>
            </div>
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
                <button className="btn btn-outline auth-submit" type="button" disabled={pending} onClick={handleGoogle}>
                  <i className="fa-brands fa-google" aria-hidden="true" /> Continue with Google
                </button>
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

          {user && error && <p className="auth-message auth-error" role="alert">{error.message}</p>}
          {user && notice && <p className="auth-message auth-success" role="status">{notice}</p>}
        </div>
      </section>
    </>
  );
}
