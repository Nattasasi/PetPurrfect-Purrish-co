import app from "./server.js";
import { loadKnowledgeBase } from "./services/petKnowledgeBase.js";

const port = process.env.PORT || 3001;

// Load the pet knowledge base from Ninja API on startup
async function startup() {
  console.log("[STARTUP] Initializing server...");
  await loadKnowledgeBase();
  
  app.listen(port, () => {
    console.log(`[STARTUP] API listening on http://localhost:${port}`);
  });
}

startup().catch((error) => {
  console.error("[STARTUP] Failed to start server:", error);
  process.exit(1);
});
