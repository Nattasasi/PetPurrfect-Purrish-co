import express from "express";
import cors from "cors";

import quizRoute from "./routes/quiz.js";
import ragRoute from "./routes/rag.js";
import productsRoute from "./routes/products.js";
import stickerRoute from "./routes/sticker.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_, res) => {
  res.json({ ok: true, service: "purrishco-api" });
});

app.use("/api/quiz", quizRoute);
app.use("/api/rag", ragRoute);
app.use("/api/products", productsRoute);
app.use("/api/sticker", stickerRoute);

export default app;
