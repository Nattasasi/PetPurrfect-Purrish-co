import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "hosting");
// Only this generated directory is removed. Never publish the repository root.
await rm(output, { recursive: true, force: true });
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
await copy("apps/web/dist/index.html", "app.html");
await copy("apps/web/dist/assets", "assets");
await copy("apps/web/dist/pet_stickers", "pet_stickers");
await mkdir(path.join(output, "models"), { recursive: true });
await copy("apps/web/dist/models/breed_classifier.onnx", "models/breed_classifier.onnx");
console.log("Prepared hosting/: static site, admin, React routes, and browser assets only.");
