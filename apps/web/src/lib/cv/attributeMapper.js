export function mapAttributesToStickerLayers(attributes = {}) {
  return {
    baseLayer: "base-dog-round",
    colorOverlay: `fur-${attributes.furColor || "default"}`,
    ears: `ears-${attributes.earStyle || "default"}`,
    face: `face-${attributes.faceShape || "default"}`
  };
}
