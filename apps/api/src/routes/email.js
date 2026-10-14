import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { emailConfigured, sendDueReminders, setEmailReminders, verifyUnsubscribe } from "../services/reminderEmailService.js";

const router = Router();

function validCronSecret(header) {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const given = Buffer.from(typeof header === "string" ? header : "");
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
}

// Called daily by a scheduler (e.g. Cloud Scheduler) with the shared secret.
router.post("/send-due", async (req, res) => {
  if (!validCronSecret(req.get("x-cron-secret"))) return res.status(401).json({ error: "unauthorized" });
  if (!emailConfigured()) return res.status(503).json({ error: "email_not_configured" });
  try {
    res.json(await sendDueReminders());
  } catch {
    res.status(500).json({ error: "send_failed" });
  }
});

router.get("/unsubscribe", async (req, res) => {
  if (!verifyUnsubscribe(req.query.uid, req.query.token)) return res.status(400).type("text/plain").send("Invalid unsubscribe link.");
  try {
    await setEmailReminders(req.query.uid, false);
    res.type("text/plain").send("You have been unsubscribed from reminder emails. You can turn them back on from your profile.");
  } catch {
    res.status(500).type("text/plain").send("Something went wrong. Please try again.");
  }
});

export default router;
