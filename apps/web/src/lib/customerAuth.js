import {
  createUserWithEmailAndPassword,
  getIdToken,
  onIdTokenChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

const errorMessages = {
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/missing-password": "Please enter your password.",
  "auth/weak-password": "Please choose a stronger password with at least 6 characters.",
  "auth/password-does-not-meet-requirements": "Your password does not meet the account password requirements.",
  "auth/email-already-in-use": "An account already uses this email. Try signing in or resetting your password.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Please wait and try again.",
  "auth/network-request-failed": "Please check your connection and try again.",
  "auth/operation-not-allowed": "Email and password sign-in is not enabled yet.",
  "auth/requires-recent-login": "Please sign in again to continue.",
  "auth/user-token-expired": "Your session has expired. Please sign in again.",
  "auth/sign-in-required": "Please sign in to continue.",
  "auth/operation-in-progress": "Please wait for the current account action to finish."
};

export function customerAuthError(error) {
  const code = error?.code || "auth/unavailable";
  return Object.assign(new Error(errorMessages[code] || "Account access is unavailable. Please try again."), { code });
}

// Expose identity only. Roles must be checked by Firestore rules or the server;
// a signed-in customer is never automatically an administrator.
function userSnapshot(user) {
  return user ? Object.freeze({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified
  }) : null;
}

function normalizeEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    throw customerAuthError({ code: "auth/invalid-email" });
  }
  return email.trim();
}

function requirePassword(password) {
  if (typeof password !== "string" || !password.length) {
    throw customerAuthError({ code: "auth/missing-password" });
  }
  // Passwords are passed unchanged, including intentional spaces.
  return password;
}

export function createCustomerAuth(auth) {
  async function currentUser(required = false) {
    await auth.authStateReady();
    if (required && !auth.currentUser) {
      throw customerAuthError({ code: "auth/sign-in-required" });
    }
    return auth.currentUser;
  }

  return {
    subscribe(onChange, onError) {
      return onIdTokenChanged(auth, (user) => onChange(userSnapshot(user)), onError);
    },

    async signUp({ email, password }) {
      const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), requirePassword(password));
      return userSnapshot(credential.user);
    },

    async signIn({ email, password }) {
      const credential = await signInWithEmailAndPassword(auth, normalizeEmail(email), requirePassword(password));
      return userSnapshot(credential.user);
    },

    async signOut() {
      await auth.authStateReady();
      await signOut(auth);
    },

    async sendPasswordReset(email) {
      try {
        await sendPasswordResetEmail(auth, normalizeEmail(email));
      } catch (error) {
        // Keep the same outward result whether or not an address is registered.
        if (error.code !== "auth/user-not-found") throw error;
      }
    },

    async sendVerificationEmail() {
      const user = await currentUser(true);
      if (!user.emailVerified) await sendEmailVerification(user);
    },

    async refreshUser() {
      const user = await currentUser();
      if (!user) return null;
      await reload(user);
      // Refresh claims and notify subscribers after verification in another tab.
      await getIdToken(user, true);
      return userSnapshot(auth.currentUser);
    },

    async getIdToken(forceRefresh = false) {
      const user = await currentUser();
      return user ? getIdToken(user, forceRefresh) : null;
    }
  };
}
