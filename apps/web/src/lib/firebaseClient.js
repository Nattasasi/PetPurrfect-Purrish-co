import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  useDeviceLanguage
} from "firebase/auth";
import { createCustomerAuth } from "./customerAuth.js";

// Public web configuration for the existing project, also used by the admin
// site. This is not a service-account credential or an authorization boundary.
const firebaseConfig = {
  apiKey: "AIzaSyAskiafkevyYF5YU7JNJBjJI6Hz5v95Dd8",
  authDomain: "purperfect-169de.firebaseapp.com",
  projectId: "purperfect-169de",
  storageBucket: "purperfect-169de.firebasestorage.app",
  messagingSenderId: "693128476224",
  appId: "1:693128476224:web:d43e7949cd98c355cbd1a5"
};

let customerAuth;

export function getCustomerAuth() {
  if (customerAuth) return customerAuth;

  // A named app keeps customer persistence separate from the admin default app,
  // including when both sites are opened on the same local origin.
  const appName = "purrishco-customer";
  const emulatorUrl = import.meta.env?.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  const config = emulatorUrl ? {
    ...firebaseConfig,
    apiKey: "demo-api-key",
    projectId: "demo-purrishco",
    authDomain: "demo-purrishco.firebaseapp.com"
  } : firebaseConfig;
  const app = getApps().find((candidate) => candidate.name === appName) || initializeApp(config, appName);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
  });
  if (emulatorUrl && !auth.emulatorConfig) connectAuthEmulator(auth, emulatorUrl);
  useDeviceLanguage(auth);
  customerAuth = createCustomerAuth(auth);
  return customerAuth;
}
