import { Router } from "express";
import { generateShareCaptions } from "../services/ragService.js";

const router = Router();

router.get("/assets-manifest", (_, res) => {
  res.json({
    layers: ["base", "fur", "ears", "face", "accessories"],
    version: "0.1.0"
  });
});

router.post("/caption", async (req, res) => {
  const breed = typeof req.body?.breed === "string" ? req.body.breed.trim() : "pet";
  const attributes = req.body?.attributes && typeof req.body.attributes === "object"
    ? req.body.attributes
    : {};

  try {
    const captions = await generateShareCaptions(
      { name: breed },
      attributes,
      "custom pet sticker result"
    );
    res.json({ captions, provider: "ollama" });
  } catch {
    res.status(503).json({ error: "sticker_caption_unavailable" });
  }
});

export default router;
