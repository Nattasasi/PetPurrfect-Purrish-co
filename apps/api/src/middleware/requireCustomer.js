import { getAuth } from "firebase-admin/auth";
import { getFirestoreDb } from "../config/firebaseAdmin.js";

// Any signed-in user; no role check. Sets req.uid from the verified ID token.
export async function requireCustomer(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.get("Authorization") || "");
  if (!match) return res.status(401).json({ error: "sign_in_required" });
  try {
    // Ensures the admin app is initialised before verifying.
    getFirestoreDb();
    const token = await getAuth().verifyIdToken(match[1]);
    req.uid = token.uid;
    res.set("Cache-Control", "private, no-store");
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}
