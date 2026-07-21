import { Router } from "express";
import { listProducts } from "../services/productService.js";

const router = Router();

router.get("/", (_, res) => {
  res.json({ products: listProducts() });
});

export default router;
