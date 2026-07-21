import { Router } from "express";

const router = Router();

router.get("/status", (_, res) => {
  res.json({ provider: "external-api", ready: false });
});

export default router;
