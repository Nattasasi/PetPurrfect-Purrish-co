function createSvgDataUri({ title, subtitle, background, accent, textColor }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background}" />
          <stop offset="100%" stop-color="#fff8f4" />
        </linearGradient>
      </defs>
      <rect width="960" height="640" rx="48" fill="url(#bg)" />
      <circle cx="176" cy="144" r="68" fill="${accent}" opacity="0.22" />
      <circle cx="792" cy="500" r="96" fill="${accent}" opacity="0.16" />
      <path d="M290 382c0-78 68-142 190-142 121 0 190 64 190 142 0 90-74 166-190 166-117 0-190-76-190-166Z" fill="${accent}" opacity="0.94" />
      <circle cx="400" cy="300" r="20" fill="#ffffff" />
      <circle cx="560" cy="300" r="20" fill="#ffffff" />
      <circle cx="480" cy="360" r="32" fill="#ffffff" opacity="0.95" />
      <path d="M434 396c20 18 72 18 92 0" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" />
      <text x="480" y="108" text-anchor="middle" fill="${textColor}" font-family="Poppins, Arial, sans-serif" font-size="34" font-weight="700">Purrish&amp;Co.</text>
      <text x="480" y="536" text-anchor="middle" fill="${textColor}" font-family="Poppins, Arial, sans-serif" font-size="54" font-weight="700">${title}</text>
      <text x="480" y="588" text-anchor="middle" fill="${textColor}" font-family="Poppins, Arial, sans-serif" font-size="28" font-weight="500">${subtitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const PET_IMAGE_MAP = {
  golden_retriever: createSvgDataUri({
    title: "Golden Retriever",
    subtitle: "Warm, friendly, and easygoing",
    background: "#ffdca8",
    accent: "#ff9f6e",
    textColor: "#5a3b2e"
  }),
  border_collie: createSvgDataUri({
    title: "Border Collie",
    subtitle: "Sharp, active, and playful",
    background: "#cbe8ff",
    accent: "#6fa8dc",
    textColor: "#23435f"
  }),
  shiba_inu: createSvgDataUri({
    title: "Shiba Inu",
    subtitle: "Independent and spirited",
    background: "#ffd7c6",
    accent: "#e87a52",
    textColor: "#5d3327"
  }),
  ragdoll_cat: createSvgDataUri({
    title: "Ragdoll Cat",
    subtitle: "Calm, gentle, and affectionate",
    background: "#eadcff",
    accent: "#b68cff",
    textColor: "#43315f"
  }),
  british_shorthair: createSvgDataUri({
    title: "British Shorthair",
    subtitle: "Steady, plush, and classic",
    background: "#dbe4f3",
    accent: "#7b97c7",
    textColor: "#2f4058"
  })
};

const DEFAULT_IMAGE = PET_IMAGE_MAP.golden_retriever;

export function getPetImageById(matchId) {
  return PET_IMAGE_MAP[matchId] || DEFAULT_IMAGE;
}

export function resolvePetImageUrl(imageUrl, matchId) {
  if (typeof imageUrl === "string" && imageUrl && !imageUrl.startsWith("/images/")) {
    return imageUrl;
  }

  return getPetImageById(matchId);
}
