import { Router } from "express";

const router = Router();

router.get("/assets-manifest", (_, res) => {
  res.json({
    layers: ["base", "fur", "ears", "face", "accessories"],
    version: "0.1.0"
  });
});

export default router;
