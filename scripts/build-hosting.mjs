import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "apps/web/dist");
// Ensure output directory exists, then merge static files into React build output
await mkdir(output, { recursive: true });
const copy = (from, to = from) => cp(path.join(root, from), path.join(output, to), {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith(".")
});
for (const file of [
  "index.html", "contact.html", "quiz.html", "pet.html", "css/style.css",
  "js/script.js", "js/ingestion-client.mjs",
  "admin/index.html", "admin/login.html", "admin/css/admin.css", "admin/js/admin.js", "admin/js/login.js"
]) {
  await copy(file);
}
// React build already produced index.html, assets/, pet_stickers/, models/ in apps/web/dist
// Rename React's index.html to app.html to avoid conflict with static index.html, then add business_assets
await copy("apps/web/dist/index.html", "app.html");
await copy("apps/web/public/business_assets", "business_assets");
console.log("Merged static site, admin, and React routes into apps/web/dist.");
