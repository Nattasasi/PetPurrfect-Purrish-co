import { Router } from "express";
import { recordEvent, saveMessage, validEvent, isUuid } from "../services/ingestionRepository.js";
import { rateLimit } from "../middleware/ingestionGuard.js";

export function validMessage(body) {
  const keys = ["submissionId", "name", "email", "subject", "message"];
  return body && Object.keys(body).length === keys.length
    && keys.every((key) => typeof body[key] === "string")
    && isUuid(body.submissionId)
    && ["name", "email", "subject", "message"].every((key) => body[key] === body[key].trim())
    && body.name.length >= 2 && body.name.length <= 100
    && body.email.length >= 5 && body.email.length <= 150
    && /^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(body.email)
    && body.subject.length <= 150
    && body.message.length >= 1 && body.message.length <= 2000;
}

export function createIngestionRouter({ record = recordEvent, save = saveMessage } = {}) {
  const router = Router();
  router.post("/ingest/analytics-events", rateLimit(), async (req, res) => {
    if (!validEvent(req.body)) return res.status(400).json({ error: "invalid_event" });
    try { res.json(await record(req.body.type, req.body.eventId)); }
    catch { res.status(503).json({ error: "analytics_unavailable" }); }
  });
  router.post("/messages", rateLimit({ limit: 5, windowMs: 3600000 }), async (req, res) => {
    if (!validMessage(req.body)) return res.status(400).json({ error: "invalid_message" });
    try { res.json(await save(req.body)); }
    catch (error) { res.status(error.status || 503).json({ error: "message_not_saved" }); }
  });
  return router;
}
