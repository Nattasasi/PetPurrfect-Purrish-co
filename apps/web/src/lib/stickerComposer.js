import { findClosestBreedPreset } from "./cv/breedColorPresets";

const ASSET_BASE = "/pet_stickers/";

// Breeds with per-layer artwork (line art + recolorable fur/eye layers) so a
// sticker can be tinted from photo colors instead of using one flat PNG.
const STICKER_ASSETS = [
  {
    breed: "Abyssinian", petType: "cat", traits: ["short", "slender", "pointed", "warm"],
    folder: "abyssinian",
    files: ["pet_abyssinian_0000_eyes.png", "pet_abyssinian_0001_nochange.png", "pet_abyssinian_0002_overcoat.png", "pet_abyssinian_0003_undercoat.png"]
  },
  {
    breed: "American Shorthair", petType: "cat", traits: ["short", "round", "medium", "classic"],
    folder: "american_shorthair",
    files: ["pet_americanshorthair_0000_eyes.png", "pet_americanshorthair_0001_nochange.png", "pet_americanshorthair_0002_overcoat.png", "pet_americanshorthair_0003_undercoat.png"]
  },
  { fileName: "pet_beagle.png", breed: "Beagle", petType: "dog", traits: ["short", "medium", "floppy", "hound"] },
  {
    breed: "Boxer", petType: "dog", traits: ["short", "large", "broad", "upright"],
    folder: "boxer",
    files: ["pet_boxer_0000_nochange.png", "pet_boxer_0001_coat.png"]
  },
  { fileName: "pet_bulldog.png", breed: "Bulldog", petType: "dog", traits: ["short", "medium", "broad", "upright"] },
  { fileName: "pet_chihuahua.png", breed: "Chihuahua", petType: "dog", traits: ["short", "small", "pointed", "upright"] },
  {
    breed: "Corgi", petType: "dog", traits: ["medium", "small", "long", "upright"],
    folder: "corgi",
    files: ["pet_corgi.png_0000_nochange.png", "pet_corgi.png_0001_coat.png"]
  },
  {
    breed: "Dachshund", petType: "dog", traits: ["short", "small", "long", "floppy"],
    folder: "dachshund",
    files: ["pet_dachshund_0000_nochange.png", "pet_dachshund_0001_coat.png"]
  },
  {
    breed: "German Shepherd", petType: "dog", traits: ["medium", "large", "long", "upright"],
    folder: "german_shepherd",
    files: ["pet_germanshepherd_0000_undercoat.png", "pet_germanshepherd_0001_nochange.png"]
  },
  {
    breed: "Golden Retriever", petType: "dog", traits: ["long", "large", "broad", "floppy"],
    folder: "golden_retriever",
    files: ["pet_goldenretreiver_0000_nochange.png", "pet_goldenretreiver_0001_coat.png"]
  },
  {
    breed: "Siberian Husky", petType: "dog", traits: ["medium", "large", "pointed", "upright"],
    folder: "husky",
    files: ["pet_husky_0000_nochange.png", "pet_husky_0001_coat.png"]
  }
];

const BREED_TRAITS = {
  "American Staffordshire Terrier": ["short", "medium", "broad", "upright"],
  "Australian Terrier": ["medium", "small", "pointed", "upright"],
  "Basenji": ["short", "medium", "pointed", "upright"],
  "Basset Hound": ["short", "medium", "long", "floppy"],
  "Bernese Mountain Dog": ["long", "large", "broad", "floppy"],
  "Border Collie": ["medium", "medium", "long", "upright"],
  "Boston Terrier": ["short", "small", "broad", "upright"],
  "Bullmastiff": ["short", "large", "broad", "floppy"],
  "Cardigan Welsh Corgi": ["medium", "small", "long", "upright"],
  "Chesapeake Bay Retriever": ["short", "large", "broad", "floppy"],
  "Collie": ["long", "large", "long", "upright"],
  "Dalmatian": ["short", "large", "long", "floppy"],
  "Doberman Pinscher": ["short", "large", "long", "upright"],
  "English Foxhound": ["short", "large", "long", "floppy"],
  "French Bulldog": ["short", "small", "broad", "upright"],
  "German Shorthaired Pointer": ["short", "large", "long", "floppy"],
  "Great Dane": ["short", "large", "long", "floppy"],
  "Labrador Retriever": ["short", "large", "broad", "floppy"],
  "Pekingese": ["long", "small", "broad", "floppy"],
  "Pembroke Welsh Corgi": ["medium", "small", "long", "upright"],
  "Pomeranian": ["long", "small", "pointed", "upright"],
  "Pug": ["short", "small", "broad", "floppy"],
  "Rottweiler": ["short", "large", "broad", "floppy"],
  "Samoyed": ["long", "large", "pointed", "upright"],
  "Shetland Sheepdog": ["long", "small", "long", "upright"],
  "Shiba Inu": ["medium", "medium", "pointed", "upright"],
  "Shih Tzu": ["long", "small", "broad", "floppy"],
  "Siamese Cat": ["short", "slender", "pointed", "classic"],
  "Tabby Cat": ["short", "round", "medium", "classic"],
  "Tiger Cat": ["short", "round", "medium", "classic"]
};

function normalizeBreedName(breed = "") {
  return breed.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreSimilarity(targetTraits, candidateTraits) {
  return targetTraits.reduce((score, trait) => score + (candidateTraits.includes(trait) ? 1 : 0), 0);
}

export function selectStickerAsset(breed, attributes = {}) {
  const normalizedBreed = normalizeBreedName(breed);
  const exactMatch = STICKER_ASSETS.find((asset) => normalizeBreedName(asset.breed) === normalizedBreed);

  if (exactMatch) {
    return exactMatch;
  }

  const petType = attributes.petType || (breed.toLowerCase().includes("cat") ? "cat" : "dog");
  const targetTraits = BREED_TRAITS[breed] || [
    attributes.faceShape === "long" ? "long" : "broad",
    attributes.earStyle || "floppy"
  ];
  const candidates = STICKER_ASSETS.filter((asset) => asset.petType === petType);

  return candidates.reduce((best, asset) =>
    scoreSimilarity(targetTraits, asset.traits) > scoreSimilarity(targetTraits, best.traits) ? asset : best
  );
}

// Layer file names look like "..._0001_coat.png"; lower numbers draw on top.
function parseLayerFile(fileName) {
  const match = fileName.match(/_(\d{4})_([a-z]+)\.png$/i);
  return {
    fileName,
    order: match ? Number(match[1]) : 0,
    layer: match ? match[2].toLowerCase() : "nochange"
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Builds a fileName -> hex color lookup for the recolorable layers, using
// the matched breed preset's exact colors for whichever layer names it has
// ("coat" | "overcoat" | "undercoat" | "eyes"). "nochange" layers are never
// included here, so they're left untouched by the caller.
function buildLayerColorMap(parsedLayers, presetColors) {
  const map = {};
  for (const layer of parsedLayers) {
    if (presetColors[layer.layer]) {
      map[layer.fileName] = presetColors[layer.layer];
    }
  }
  return map;
}

// Recolors a layer to the target color while keeping its original shading
// (highlights/shadows) intact. Uses per-pixel HSL manipulation rather than a
// CSS blend mode: hue/saturation are replaced with the target's, and every
// pixel's lightness is shifted by a constant delta (target lightness minus
// the layer's average lightness) so the overall brightness actually matches
// the target color — a straight hue/sat-only blend keeps the *original*
// average brightness, so a light target color could still render dark if
// the template art itself was painted dark.
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }

  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

function hexToRgbTuple(hex) {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function tintLayer(image, hex) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const [targetR, targetG, targetB] = hexToRgbTuple(hex);
  const [targetH, targetS, targetL] = rgbToHsl(targetR, targetG, targetB);

  let sumLightness = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      continue;
    }
    sumLightness += rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
    count += 1;
  }
  const avgLightness = count ? sumLightness / count : targetL;

  // Recentering the average onto the target isn't enough on its own — deep
  // shadow pixels in the original art can stay dark enough that the tinted
  // result still reads as an overall dark/saturated color even though the
  // *average* matches a light target. Also compress each pixel's deviation
  // from that average toward the target, so a light target actually looks
  // uniformly light instead of "light average, dark shadows".
  const SHADING_STRENGTH = 0.5;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 1) {
      continue;
    }
    const originalLightness = rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
    const newLightness = Math.min(1, Math.max(0, targetL + (originalLightness - avgLightness) * SHADING_STRENGTH));
    const [r, g, b] = hslToRgb(targetH, targetS, newLightness);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

// Composites a breed's line-art + fur/eye layers, tinting each recolorable
// layer with the closest-matching breed color preset while keeping
// "nochange" layers untouched.
async function composeLayeredSticker(asset, sample) {
  const preset = findClosestBreedPreset(asset.breed, sample);
  const parsedLayers = asset.files.map(parseLayerFile);
  const images = await Promise.all(
    parsedLayers.map((layer) => loadImage(`${ASSET_BASE}${asset.folder}/${layer.fileName}`))
  );
  const layerColorMap = buildLayerColorMap(parsedLayers, preset?.colors || {});

  const canvas = document.createElement("canvas");
  canvas.width = images[0].naturalWidth;
  canvas.height = images[0].naturalHeight;
  const context = canvas.getContext("2d");

  // Draw bottom-first: highest layer number first, lowest (topmost) last.
  const drawOrder = parsedLayers
    .map((layer, index) => ({ layer, image: images[index] }))
    .sort((a, b) => b.layer.order - a.layer.order);

  context.globalCompositeOperation = "source-over";
  for (const { layer, image } of drawOrder) {
    const tint = layerColorMap[layer.fileName];
    const source = tint ? tintLayer(image, tint) : image;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/png");
}

// Composes a breed sticker, tinting fur/eye layers with the breed color
// preset that most closely matches the photo's sampled fur clusters ({
// main, secondary, dark } from extractPetColors). Falls back to a flat
// static asset for breeds without layered artwork.
export async function composeStickerImage(breed, attributes = {}, sample) {
  const asset = selectStickerAsset(breed, attributes);

  if (asset.fileName) {
    return `${ASSET_BASE}${asset.fileName}`;
  }

  return composeLayeredSticker(asset, sample);
}

// Returns the { name, colors } of the breed color preset a sticker would be
// (or was) tinted with, for display in the debug panel. Returns null for
// breeds without layered artwork (nothing is matched/tinted for those).
export function getMatchedPresetInfo(breed, attributes = {}, sample) {
  const asset = selectStickerAsset(breed, attributes);
  if (asset.fileName) {
    return null;
  }
  return findClosestBreedPreset(asset.breed, sample);
}


