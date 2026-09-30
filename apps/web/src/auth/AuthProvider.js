import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { customerAuthError } from "../lib/customerAuth.js";
import { getCustomerAuth } from "../lib/firebaseClient.js";

const AuthContext = createContext(null);

// Supplies authentication without rendering UI, redirecting, or gating pages.
export function AuthProvider({ children, service }) {
  const [state, setState] = useState({ user: null, loading: true, error: null });
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const getService = useCallback(() => service || getCustomerAuth(), [service]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let unsubscribe;
    try {
      unsubscribe = getService().subscribe(
        (user) => {
          if (active) setState((previous) => ({ ...previous, user, loading: false }));
        },
        (error) => {
          if (active) setState({ user: null, loading: false, error: customerAuthError(error) });
        }
      );
    } catch (error) {
      setState({ user: null, loading: false, error: customerAuthError(error) });
    }
    return () => {
      active = false;
      mounted.current = false;
      unsubscribe?.();
    };
  }, [getService]);

  const run = useCallback(async (method, ...args) => {
    if (inFlight.current) throw customerAuthError({ code: "auth/operation-in-progress" });
    inFlight.current = true;
    setPending(true);
    setState((previous) => ({ ...previous, error: null }));
    try {
      return await getService()[method](...args);
    } catch (error) {
      const friendlyError = customerAuthError(error);
      if (mounted.current) setState((previous) => ({ ...previous, error: friendlyError }));
      throw friendlyError;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, [getService]);

  const actions = useMemo(() => ({
    signUp: (credentials) => run("signUp", credentials),
    signIn: (credentials) => run("signIn", credentials),
    signOut: () => run("signOut"),
    sendPasswordReset: (email) => run("sendPasswordReset", email),
    sendVerificationEmail: () => run("sendVerificationEmail"),
    refreshUser: () => run("refreshUser"),
    // Token retrieval should not clear form errors or block sign-out.
    getIdToken: async (forceRefresh = false) => {
      try {
        return await getService().getIdToken(forceRefresh);
      } catch (error) {
        throw customerAuthError(error);
      }
    },
    clearError: () => setState((previous) => ({ ...previous, error: null }))
  }), [getService, run]);

  const value = useMemo(() => ({ ...state, pending, ...actions }), [state, pending, actions]);
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
