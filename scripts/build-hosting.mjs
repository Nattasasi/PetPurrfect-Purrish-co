import { fileURLToPath } from "node:url";

// The React app (apps/web) now implements every customer-facing page
// (home, quiz, pet sticker, contact) itself, and Vite already copies
// apps/web/public/* (business_assets, models, pet_stickers) into dist/.
// Nothing extra needs to be merged in for the customer Hosting target.
fileURLToPath(new URL("../", import.meta.url));
console.log("apps/web/dist is ready to deploy as-is (no static page merge needed).");
