import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIngestionRouter } from "./routes/ingestion.js";
import { originGuard, rateLimit } from "./middleware/ingestionGuard.js";

import quizRoute from "./routes/quiz.js";
import ragRoute from "./routes/rag.js";
import productsRoute from "./routes/products.js";
import stickerRoute from "./routes/sticker.js";
import analyticsRoute from "./routes/analytics.js";

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  "https://purperfect-169de.web.app", "https://purperfect-169de.firebaseapp.com",
  ...(process.env.NODE_ENV !== "production" ? [
    "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "http://127.0.0.1:3001",
    "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:8000", "http://127.0.0.1:8000"
  ] : [])
].join(",")).split(",").map((origin) => origin.trim()).filter(Boolean);
<<<<<<< HEAD

=======
>>>>>>> firebase-ingestion-dashboard
// Leave proxy trust off by default: arbitrary X-Forwarded-For must not bypass limits.
app.use("/api", originGuard(allowedOrigins));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api", rateLimit({ limit: 120 }));
app.use("/api", createIngestionRouter());

app.get("/health", (_, res) => {
  res.json({ ok: true, service: "purrishco-api" });
});

app.use("/api/quiz", quizRoute);
app.use("/api/rag", ragRoute);
app.use("/api/products", productsRoute);
app.use("/api/sticker", stickerRoute);
app.use("/api/analytics", analyticsRoute);

if (process.env.SERVE_WEB === "true") {
  const root = fileURLToPath(new URL("../../../hosting/", import.meta.url));
  app.use(express.static(root));
  app.get(["/quiz", "/quiz/*", "/pet", "/about", "/contact"], (_req, res) => res.sendFile(path.join(root, "app.html")));
  app.get("/admin/share", (_req, res) => res.redirect("/admin/index.html"));
}

app.use((error, _req, res, _next) => {
  res.status(error.status === 413 ? 413 : 400).json({ error: "invalid_request" });
});


export default app;
