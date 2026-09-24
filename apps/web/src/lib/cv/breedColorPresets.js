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
    { name: "Red Tabby", colors: { overcoat: "#E07B39", undercoat: "#F3DAB0", eyes: "#D9B23C" } },
    { name: "Brown Tabby", colors: { overcoat: "#6B4A2F", undercoat: "#C9A66B", eyes: "#7A8B4A" } },
    { name: "Blue Silver", colors: { overcoat: "#8A8A8E", undercoat: "#DADADC", eyes: "#3F7A5B" } },
    { name: "Solid Black", colors: { overcoat: "#242426", undercoat: "#4A4745", eyes: "#D9B23C" } },
    { name: "Solid White", colors: { overcoat: "#F1F0EB", undercoat: "#FFFFFF", eyes: "#7A8B4A" } },
    { name: "Cream", colors: { overcoat: "#E8D3AD", undercoat: "#F6EAD2", eyes: "#B8860B" } }
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
    { name: "All White", colors: { coat: "#F4F1E8" } },
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

function colorDistance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

// The dominant sampled color carries the most weight because it represents
// the largest visible fur area. Secondary and dark clusters still contribute
// for markings and shading, but cannot override the dominant coat color.
function distanceToPreset(preset, sample) {
  const { colors } = preset;
  const outerRole = colors.overcoat ? "overcoat" : colors.coat ? "coat" : "undercoat";
  const outerRgb = hexToRgb(colors[outerRole]);
  const populations = sample.populations || { main: 0.7, secondary: 0.2, dark: 0.1 };

  let distance;
  if (colors.overcoat && colors.undercoat) {
    distance =
      0.7 * colorDistance(sample.main, outerRgb) +
      0.3 * colorDistance(sample.secondary, hexToRgb(colors.undercoat));
  } else {
    distance =
      populations.main * colorDistance(sample.main, outerRgb) +
      populations.secondary * colorDistance(sample.secondary, outerRgb) +
      populations.dark * colorDistance(sample.dark, outerRgb);
  }

  return distance;
}

// Picks the breed preset whose colors are the closest overall match to the
// photo's sampled main/secondary/dark fur clusters. Falls back to the
// breed's first ("default") preset when there's no usable sample.
export function findClosestBreedPreset(breedName, sample) {
  const presets = BREED_COLOR_PRESETS[breedName];
  if (!presets || presets.length === 0) {
    return null;
  }
  if (!sample || !sample.main) {
    return presets[0];
  }

  return presets.reduce((best, preset) =>
    distanceToPreset(preset, sample) < distanceToPreset(best, sample) ? preset : best
  );
}
