const SAMPLE_SIZE = 48;

function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function distanceSq(a, b) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

// Simple weighted k-means (fixed k=3) so we get a few representative fur
// tones instead of a single washed-out average of the whole photo. Weights
// let callers down-rank pixels that are likely background rather than fur.
function clusterColors(pixels, weights, k = 3, iterations = 6) {
  const order = pixels.map((_, i) => i).sort((a, b) => luminance(pixels[a]) - luminance(pixels[b]));
  let centroids = [
    pixels[order[0]],
    pixels[order[Math.floor(order.length / 2)]],
    pixels[order[order.length - 1]]
  ].slice(0, k);

  const assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const distance = distanceSq(pixels[i], centroids[c]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = c;
        }
      }
      assignments[i] = bestIndex;
    }

    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
    for (let i = 0; i < pixels.length; i++) {
      const sum = sums[assignments[i]];
      const weight = weights[i];
      sum.r += pixels[i].r * weight;
      sum.g += pixels[i].g * weight;
      sum.b += pixels[i].b * weight;
      sum.weight += weight;
    }

    centroids = sums.map((sum, index) =>
      sum.weight
        ? { r: sum.r / sum.weight, g: sum.g / sum.weight, b: sum.b / sum.weight }
        : centroids[index]
    );
  }

  const populations = centroids.map(() => 0);
  for (let i = 0; i < assignments.length; i++) {
    populations[assignments[i]] += weights[i];
  }

  return centroids.map((centroid, index) => ({ rgb: centroid, population: populations[index] }));
}

function toRoundedRgb({ r, g, b }) {
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

// The crop box already has ~12% padding added around the detected pet, so
// its outer ring is usually background (or, for a loose/inaccurate
// detection box, unrelated stuff like a person's arm). Colour-based
// background matching is unreliable when that content isn't a single flat
// tone, so this simply excludes that outer ring geometrically instead.
const INNER_MARGIN_RATIO = 0.16;

// Extracts main/secondary/dark raw fur tone clusters from a region of an
// image. Colors are left unsnapped here — callers match them against a
// breed's curated preset list to pick a whole realistic coloring at once.
// `mask`, if provided (from segmentation.js's getForegroundMask, sized
// SAMPLE_SIZE x SAMPLE_SIZE, row-major, 0..1), is the actual per-pixel
// foreground signal and is used as-is (hard-excluding low-confidence
// pixels). Without one, this falls back to a geometric guess: trimming the
// crop's outer margin and biasing toward the center.
export function extractPetColors(imageElement, mask) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;

  if (!context) {
    return null;
  }

  context.drawImage(imageElement, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const pixels = [];
  const weights = [];
  const center = (SAMPLE_SIZE - 1) / 2;
  const margin = mask ? 0 : Math.round(SAMPLE_SIZE * INNER_MARGIN_RATIO);

  for (let y = margin; y < SAMPLE_SIZE - margin; y++) {
    for (let x = margin; x < SAMPLE_SIZE - margin; x++) {
      const i = (y * SAMPLE_SIZE + x) * 4;
      if (data[i + 3] < 16) {
        continue;
      }

      if (mask) {
        // Trust the segmentation model as the sole signal for what's pet
        // vs. background — no geometric guessing layered on top of it.
        const maskWeight = mask[y * SAMPLE_SIZE + x];
        if (maskWeight < 0.15) {
          continue;
        }
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        weights.push(maskWeight);
        continue;
      }

      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });

      // No segmentation available — bias toward the very center of the
      // (already margin-trimmed) crop, since the pet is more reliably
      // there than near the edges.
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const radius = Math.sqrt(dx * dx + dy * dy);
      weights.push(radius <= 0.5 ? 1 : Math.max(0.3, 1 - (radius - 0.5) / 0.5));
    }
  }

  if (pixels.length === 0) {
    return null;
  }

  const clusters = clusterColors(pixels, weights).sort((a, b) => b.population - a.population);
  const mainCluster = clusters[0];
  const rest = clusters.slice(1).sort((a, b) => luminance(a.rgb) - luminance(b.rgb));
  const darkCluster = rest[0] || mainCluster;
  const secondaryCluster = rest[1] || mainCluster;

  return {
    main: toRoundedRgb(mainCluster.rgb),
    secondary: toRoundedRgb(secondaryCluster.rgb),
    dark: toRoundedRgb(darkCluster.rgb)
  };
}
