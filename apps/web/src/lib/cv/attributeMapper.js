export function mapAttributesToStickerLayers(attributes = {}) {
  const furColors = {
    golden: { base: "#f7c36a", accent: "#e58d46", ear: "#d48b42" },
    ginger: { base: "#ee8f5a", accent: "#dd6f44", ear: "#c95d35" },
    charcoal: { base: "#5f6d7c", accent: "#3b4a58", ear: "#2e3947" },
    silver: { base: "#c8d2dd", accent: "#9aa8bb", ear: "#7d8ca4" },
    mint: { base: "#8ed8c1", accent: "#5bb9a6", ear: "#3e9b86" }
  };

  const fur = furColors[attributes.furColor] || furColors.golden;
  const earStyle = attributes.earStyle || "floppy";
  const faceShape = attributes.faceShape || "round";

  return {
    baseLayer: `sticker-base-${faceShape}`,
    colorOverlay: fur.base,
    accentColor: fur.accent,
    earColor: fur.ear,
    earStyle,
    faceShape,
    featureMap: {
      eye: "round",
      muzzle: faceShape === "long" ? "long" : "oval",
      ear: earStyle
    }
  };
}
