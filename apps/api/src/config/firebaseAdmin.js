import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

let firestore = null;

function createCredential() {
  if (env.firebase.clientEmail && env.firebase.privateKey && env.firebase.projectId) {
    return cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey.replace(/\\n/g, "\n")
    });
  }

  if (env.firebase.applicationDefault) {
    return applicationDefault();
  }

  return null;
}

export function getFirestoreDb() {
  if (env.dataStore !== "firebase" || firestore) {
    return firestore;
  }

  const credential = createCredential();
  if (!credential) {
    return null;
  }

  const app = getApps()[0] || initializeApp({
    credential,
    projectId: env.firebase.projectId || undefined
  });

  firestore = getFirestore(app);
  return firestore;
}