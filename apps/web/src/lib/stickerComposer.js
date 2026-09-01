const ASSET_BASE = "/pet_stickers/";

const STICKER_ASSETS = [
  { fileName: "pet_abyssinian.png", breed: "Abyssinian", petType: "cat", traits: ["short", "slender", "pointed", "warm"] },
  { fileName: "pet_americanshorthair.png", breed: "American Shorthair", petType: "cat", traits: ["short", "round", "medium", "classic"] },
  { fileName: "pet_beagle.png", breed: "Beagle", petType: "dog", traits: ["short", "medium", "floppy", "hound"] },
  { fileName: "pet_boxer.png", breed: "Boxer", petType: "dog", traits: ["short", "large", "broad", "upright"] },
  { fileName: "pet_bulldog.png", breed: "Bulldog", petType: "dog", traits: ["short", "medium", "broad", "upright"] },
  { fileName: "pet_chihuahua.png", breed: "Chihuahua", petType: "dog", traits: ["short", "small", "pointed", "upright"] },
  { fileName: "pet_corgi.png", breed: "Corgi", petType: "dog", traits: ["medium", "small", "long", "upright"] },
  { fileName: "pet_dachshund.png", breed: "Dachshund", petType: "dog", traits: ["short", "small", "long", "floppy"] },
  { fileName: "pet_dachshund_black.png", breed: "Dachshund", petType: "dog", traits: ["short", "small", "long", "floppy", "black"] },
  { fileName: "pet_germanshepherd.png", breed: "German Shepherd", petType: "dog", traits: ["medium", "large", "long", "upright"] },
  { fileName: "pet_goldenretreiver.png", breed: "Golden Retriever", petType: "dog", traits: ["long", "large", "broad", "floppy"] },
  { fileName: "pet_husky.png", breed: "Siberian Husky", petType: "dog", traits: ["medium", "large", "pointed", "upright"] }
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

export function composeStickerImage(breed, attributes = {}) {
  const asset = selectStickerAsset(breed, attributes);
  return `${ASSET_BASE}${asset.fileName}`;
}
