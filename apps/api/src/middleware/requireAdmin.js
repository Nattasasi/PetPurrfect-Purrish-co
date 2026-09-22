import { getAuth } from "firebase-admin/auth";
import { requireDb } from "../services/ingestionRepository.js";

export async function requireAdmin(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.get("Authorization") || "");
  if (!match) return res.status(401).json({ error: "admin_sign_in_required" });
  try {
    const db = requireDb();
    const token = await getAuth().verifyIdToken(match[1], true);
    const profile = await db.collection("users").doc(token.uid).get();
    if (!profile.exists || profile.get("role") !== "admin" || profile.get("active") !== true) {
      return res.status(403).json({ error: "active_admin_required" });
    }
    res.set("Cache-Control", "private, no-store");
    next();
  } catch {
    res.status(403).json({ error: "admin_access_unavailable" });
  }
}
