import { Router } from "express";
import { listProducts } from "../services/productService.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(listProducts({ context: typeof req.query.context === "string" ? req.query.context : "home" }));
});

export default router;
