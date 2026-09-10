import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAskiafkevyYF5YU7JNJBjJI6Hz5v95Dd8",
  authDomain: "purperfect-169de.firebaseapp.com",
  projectId: "purperfect-169de",
  storageBucket: "purperfect-169de.firebasestorage.app",
  messagingSenderId: "693128476224",
  appId: "1:693128476224:web:d43e7949cd98c355cbd1a5",
  
};

const requiredFirebaseValues = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId
];

export const firebaseConfigReady = !requiredFirebaseValues
    .some((value) => !value || value.includes("PASTE_YOUR"));

export const app = firebaseConfigReady ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
