// Curated, breed-accurate color presets for each layered sticker asset.
// Instead of freely snapping arbitrary extracted photo colors onto a generic
// palette, the photo's colors are matched to the closest whole preset for
// the detected breed, then that preset's exact layer colors are used —
// keeping every generated sticker looking like a real, recognizable
// coloring of that breed. Layer keys match the asset's own layer names
// ("coat" | "overcoat" | "undercoat" | "eyes").
export const BREED_COLOR_PRESETS = {
  Abyssinian: [
    { name: "Usual (Ruddy)", colors: { overcoat: "#A9633B", undercoat: "#F0C48A", eyes: "#B8860B" } },
    { name: "Sorrel (Red)", colors: { overcoat: "#B8502E", undercoat: "#F4B27A", eyes: "#C9A227" } },
    { name: "Blue", colors: { overcoat: "#8C8C94", undercoat: "#E9DFD3", eyes: "#7A8B4A" } },
    { name: "Fawn", colors: { overcoat: "#D9B48F", undercoat: "#F5E6D3", eyes: "#B8860B" } }
  ],
  "American Shorthair": [
    { name: "Silver Tabby (Default)", colors: { overcoat: "#2B2B2E", undercoat: "#F7F5F0", eyes: "#D9B23C" } },
    { name: "Red Tabby", colors: { overcoat: "#D4845C", undercoat: "#E8B896", eyes: "#D9B23C" } },
    { name: "Brown Tabby", colors: { overcoat: "#6B4A2F", undercoat: "#C9A66B", eyes: "#7A8B4A" } },
    { name: "Blue Silver", colors: { overcoat: "#8A8A8E", undercoat: "#DADADC", eyes: "#3F7A5B" } },
    { name: "Solid Black", colors: { overcoat: "#242426", undercoat: "#4A4745", eyes: "#D9B23C" } },
    { name: "Solid White", colors: { overcoat: "#F1F0EB", undercoat: "#FFFFFF", eyes: "#7A8B4A" } },
    { name: "Cream", colors: { overcoat: "#E8D3AD", undercoat: "#F6EAD2", eyes: "#B8860B" } },
    { name: "Bicolor (Tuxedo)", colors: { overcoat: "#1F1D1C", undercoat: "#F5F3EE", eyes: "#D9B23C" } },
    { name: "Tortoiseshell", colors: { overcoat: "#2A1D14", undercoat: "#B5602E", eyes: "#B8860B" } }
  ],
  Boxer: [
    { name: "Fawn", colors: { coat: "#C97A3D" } },
    { name: "Brindle", colors: { coat: "#5A3A22" } },
    { name: "Dark Brindle", colors: { coat: "#3B2A20" } },
    { name: "Red Fawn", colors: { coat: "#B65D2B" } },
    { name: "White/Light Fawn", colors: { coat: "#E3C9A6" } }
  ],
  Corgi: [
    { name: "Red", colors: { coat: "#B5502E" } },
    { name: "Sable", colors: { coat: "#8C5A2E" } },
    { name: "Fawn", colors: { coat: "#D9B48F" } },
    { name: "Black & Tan", colors: { coat: "#4A3324" } },
    { name: "Blue Merle", colors: { coat: "#6F7472" } },
    { name: "White/Blonde", colors: { coat: "#E9D8B9" } }
  ],
  Dachshund: [
    { name: "Red", colors: { coat: "#A6472B" } },
    { name: "Chocolate", colors: { coat: "#5C3A22" } },
    { name: "Cream", colors: { coat: "#E7CBA0" } },
    { name: "Black & Tan", colors: { coat: "#33231A" } },
    { name: "Blue", colors: { coat: "#62666A" } },
    { name: "Isabella", colors: { coat: "#9B806D" } },
    { name: "Wheaten", colors: { coat: "#D7B27B" } }
  ],
  "German Shepherd": [
    { name: "Black & Tan", colors: { undercoat: "#B8823C" } },
    { name: "Sable", colors: { undercoat: "#8C5A2E" } },
    { name: "All Black", colors: { undercoat: "#2B2420" } },
    { name: "Bi-Color", colors: { undercoat: "#4A3022" } },
    { name: "Liver", colors: { undercoat: "#6B3E2A" } },
    { name: "White", colors: { undercoat: "#EDE6D6" } }
  ],
  "Golden Retriever": [
    { name: "Golden", colors: { coat: "#E0AE5C" } },
    { name: "Light/Cream", colors: { coat: "#F0DCAF" } },
    { name: "Dark Golden/Red", colors: { coat: "#B8752E" } },
    { name: "Mahogany Red", colors: { coat: "#9E5429" } }
  ],
  "Siberian Husky": [
    { name: "Grey & White", colors: { coat: "#8A8680" } },
    { name: "Silver & White", colors: { coat: "#B8B9BA" } },
    { name: "Black & White", colors: { coat: "#332E2A" } },
    { name: "Red/Copper & White", colors: { coat: "#B5602E" } },
    { name: "Sable & White", colors: { coat: "#7B5836" } },
    { name: "Agouti & White", colors: { coat: "#4B4038" } },
    { name: "All White", colors: { coat: "#FFFFFF" } },
    { name: "Cream White", colors: { coat: "#E8DCC8" } }
  ]
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

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

  return [h * 60, s, l];
}

// Fur "colorways" (red vs brown vs black vs grey tabby, etc.) are
// fundamentally a hue+saturation classification. Raw RGB distance instead
// weighs absolute brightness just as heavily as hue, which misfires badly
// here: photos have shadow/highlight variation that can make the dominant
// sampled cluster much darker or lighter than a preset's reference swatch
// while still being clearly the same color family.
// Hue becomes numerically unstable (near-arbitrary) once saturation drops
// close to zero — a near-grey pixel's "hue" is essentially noise. So any
// comparison involving a near-grey color falls back to a saturation +
// lightness-only distance instead of letting that noisy hue dominate.
const ACHROMATIC_SATURATION_THRESHOLD = 0.12;

function colorDistance(a, b) {
  if (!a || !b) {
    return 0;
  }
  const [h1, s1, l1] = rgbToHsl(a.r, a.g, a.b);
  const [h2, s2, l2] = rgbToHsl(b.r, b.g, b.b);
  const ds = s1 - s2;
  const dl = l1 - l2;

  if (s1 < ACHROMATIC_SATURATION_THRESHOLD || s2 < ACHROMATIC_SATURATION_THRESHOLD) {
    return 0.65 * ds * ds + 0.35 * dl * dl;
  }

  let dh = Math.abs(h1 - h2);
  if (dh > 180) {
    dh = 360 - dh;
  }
  dh /= 180;

  return 0.7 * dh * dh + 0.2 * ds * ds + 0.02 * dl * dl;
}

function luminance(rgb) {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

// The dominant sampled color carries the most weight because it represents
// the largest visible fur area. Secondary and dark clusters still contribute
// for markings and shading, but cannot override the dominant coat color.
// When the main sample is very light (white fur), dramatically increase its
// weight so that grey shadows don't pull the match toward greyer presets.
function distanceToPreset(preset, sample) {
  const { colors } = preset;
  const outerRole = colors.overcoat ? "overcoat" : colors.coat ? "coat" : "undercoat";
  const outerRgb = hexToRgb(colors[outerRole]);
  const populations = sample.populations || { main: 0.7, secondary: 0.2, dark: 0.1 };

  let distance;
  if (colors.overcoat && colors.undercoat) {
    // "overcoat" is always the darker/pattern color and "undercoat" the
    // lighter base across every preset, but the sampled "main" cluster is
    // whichever cluster has the largest population — not necessarily the
    // darker one (e.g. a tabby's light base fur can easily outweigh its
    // dark stripes). Pair each preset role with whichever sampled cluster
    // actually has matching lightness, instead of assuming main=overcoat.
    const clusters = [
      { rgb: sample.main, weight: populations.main },
      { rgb: sample.secondary, weight: populations.secondary },
      { rgb: sample.dark, weight: populations.dark }
    ]
      .filter((cluster) => cluster.rgb)
      .sort((a, b) => luminance(b.rgb) - luminance(a.rgb));
    const lightest = clusters[0];
    const darkest = clusters[clusters.length - 1];
    const totalWeight = (lightest.weight || 0) + (darkest.weight || 0) || 1;

    distance =
      (darkest.weight / totalWeight) * colorDistance(darkest.rgb, outerRgb) +
      (lightest.weight / totalWeight) * colorDistance(lightest.rgb, hexToRgb(colors.undercoat));
  } else {
    // The single "coat" swatch represents the pattern's overall visual
    // impression, so weight each cluster's contribution by how much of the
    // actual photo it covers. A fixed/brightness-based weighting (e.g.
    // always trusting a light main cluster almost exclusively) breaks down
    // for breeds with large, genuinely-dark patches — a 36%-population
    // black cluster shouldn't be drowned out just because the largest
    // cluster happens to be white.
    distance =
      populations.main * colorDistance(sample.main, outerRgb) +
      populations.secondary * colorDistance(sample.secondary, outerRgb) +
      populations.dark * colorDistance(sample.dark, outerRgb);
  }

  return distance;
}

// Picks the breed preset whose colors are the closest overall match to the
// photo's sampled main/secondary/dark fur clusters. Falls back to the
// breed's first ("default") preset when there's no usable sample. Golden
// Retrievers use their standard golden preset consistently rather than letting
// lighting or shadows select a less representative color variant.
export function findClosestBreedPreset(breedName, sample) {
  const presets = BREED_COLOR_PRESETS[breedName];
  if (!presets || presets.length === 0) {
    return null;
  }
  if (breedName === "Golden Retriever") {
    return presets[0];
  }
  if (!sample || !sample.main) {
    return presets[0];
  }

  return presets.reduce((best, preset) =>
    distanceToPreset(preset, sample) < distanceToPreset(best, sample) ? preset : best
  );
}
