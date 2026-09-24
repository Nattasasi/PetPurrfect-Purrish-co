import { fetchPetKnowledge } from "../adapters/externalPetApi.js";
import XLSX from "xlsx";

import { fileURLToPath } from "node:url";

/**
 * In-memory cache of pet breeds retrieved from Ninja API.
 * Populated on server startup for use as the knowledge base for matching.
 */
let cachedBreeds = [];
let isLoading = false;
let lastLoadError = null;
let loadPromise = null;

const WORKBOOK_PATH = fileURLToPath(
  new URL("../../../web/public/pet_breeds_COMPLETE_1.xlsx", import.meta.url)
);

function numberInRange(value, minimum = 0, maximum = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseWorkbookKnowledgeBase() {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });

  return rows
    .filter((row) => row.breed_name && row.species)
    .map((row) => {
      const energy = numberInRange(row.energy_level_norm ?? Number(row.energy_level) / 5);
      const affection = numberInRange(row.affection_level_norm ?? Number(row.affection_level) / 5);
      const socialNeeds = numberInRange(row.social_needs_norm ?? Number(row.social_needs) / 5);
      const adaptability = numberInRange(row.adaptability_norm ?? Number(row.adaptability) / 5);
      const intelligence = numberInRange(row.intelligence_norm ?? Number(row.intelligence) / 5);

      return {
        id: slugify(row.breed_name),
        name: row.breed_name,
        petType: String(row.species).toLowerCase(),
        summary: row.description || `${row.breed_name}: ${row.personality_traits || "breed profile"}.`,
        personalityTraits: row.personality_traits || "",
        lifestyle: {
          adaptability,
          familyCompatibility: numberInRange(Number(row.family_compatibility_score) / 100),
          urbanFriendly: numberInRange(row.urban_friendly_norm ?? Number(row.urban_friendly) / 5),
          exerciseMinutesDaily: numberInRange(row["Avg exercise_minutes_daily"], 0, 500),
          groomingHoursMonthly: numberInRange(row["Avg grooming_hours_monthly"], 0, 100),
          socialInteractionHoursDaily: numberInRange(row["Avg social_interaction_hours_daily"], 0, 24),
          monthlyCost: numberInRange(row["Avg total_monthly_cost_inr"], 0, 100000)
        },
        source: "local-workbook",
        raw: row,
        traits: {
          energy: energy ?? 0.5,
          sociability: socialNeeds ?? affection ?? 0.5,
          // The workbook has no direct stranger-friendly score. Lower social needs
          // and lower affection requirements are the least invasive proxy.
          stranger_friendly: 1 - ((socialNeeds ?? 0.5) * 0.7 + (affection ?? 0.5) * 0.3),
          // Adaptable breeds generally need less environmental predictability.
          routine: 1 - (adaptability ?? 0.5),
          trainability: intelligence ?? 0.5
        }
      };
    });
}

/**
 * Fallback breed profiles for when Ninja API is unavailable.
 * These are used if the knowledge base fails to load.
 */
const FALLBACK_PROFILES = [
  {
    id: "golden_retriever",
    name: "Golden Retriever",
    petType: "dog",
    summary: "Friendly, social, and well-suited to active owners.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.85, sociability: 0.9, stranger_friendly: 0.35, routine: 0.6, trainability: 0.9 }
  },
  {
    id: "labrador_retriever",
    name: "Labrador Retriever",
    petType: "dog",
    summary: "Warm, upbeat, and happiest when life is active and social.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.8, sociability: 0.85, stranger_friendly: 0.4, routine: 0.55, trainability: 0.85 }
  },
  {
    id: "corgi",
    name: "Corgi",
    petType: "dog",
    summary: "Cheerful, people-loving, and better with structure than chaos.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.75, sociability: 0.8, stranger_friendly: 0.45, routine: 0.7, trainability: 0.75 }
  },
  {
    id: "poodle",
    name: "Poodle",
    petType: "dog",
    summary: "Smart, adaptable, and quick to pick up on your rhythms.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.65, sociability: 0.8, stranger_friendly: 0.45, routine: 0.65, trainability: 0.95 }
  },
  {
    id: "shiba_inu",
    name: "Shiba Inu",
    petType: "dog",
    summary: "Independent, alert, and confident with a balanced routine.",
    imageUrl: "/images/product6.jpg",
    traits: { energy: 0.65, sociability: 0.45, stranger_friendly: 0.85, routine: 0.6, trainability: 0.5 }
  },
  {
    id: "husky",
    name: "Husky",
    petType: "dog",
    summary: "Energetic, bold, and happiest when life has room to roam.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.95, sociability: 0.55, stranger_friendly: 0.8, routine: 0.35, trainability: 0.45 }
  },
  {
    id: "ragdoll_cat",
    name: "Ragdoll Cat",
    petType: "cat",
    summary: "Calm, affectionate, and ideal for relaxed households.",
    imageUrl: "/images/product4.jpg",
    traits: { energy: 0.35, sociability: 0.8, stranger_friendly: 0.5, routine: 0.65, trainability: 0.5 }
  },
  {
    id: "siamese_cat",
    name: "Siamese Cat",
    petType: "cat",
    summary: "Expressive, social, and always ready to be part of the moment.",
    imageUrl: "/images/product4.jpg",
    traits: { energy: 0.7, sociability: 0.85, stranger_friendly: 0.4, routine: 0.5, trainability: 0.6 }
  },
  {
    id: "persian_cat",
    name: "Persian Cat",
    petType: "cat",
    summary: "Soft-spoken, low-key, and happiest in a calm, comfy setting.",
    imageUrl: "/images/product4.jpg",
    traits: { energy: 0.25, sociability: 0.4, stranger_friendly: 0.7, routine: 0.75, trainability: 0.35 }
  },
  {
    id: "border_collie",
    name: "Border Collie",
    petType: "dog",
    summary: "Highly trainable and built for active, structured lifestyles.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.95, sociability: 0.7, stranger_friendly: 0.4, routine: 0.8, trainability: 0.95 }
  },
  {
    id: "british_shorthair",
    name: "British Shorthair",
    petType: "cat",
    summary: "Independent, steady, and comfortable with routine.",
    imageUrl: "/images/product4.jpg",
    traits: { energy: 0.3, sociability: 0.45, stranger_friendly: 0.8, routine: 0.7, trainability: 0.45 }
  },
  {
    id: "dachshund",
    name: "Dachshund",
    petType: "dog",
    summary: "Curious, self-directed, and happiest with a familiar routine.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.55, sociability: 0.55, stranger_friendly: 0.7, routine: 0.75, trainability: 0.4 }
  }
];

/**
 * Load the local workbook as the primary knowledge base. Ninja API remains a
 * fallback for environments where the workbook is unavailable.
 */
export function loadKnowledgeBase() {
  if (cachedBreeds.length > 0) {
    return Promise.resolve(cachedBreeds);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = loadKnowledgeBaseInternal();
  return loadPromise.finally(() => {
    loadPromise = null;
  });
}

async function loadKnowledgeBaseInternal() {
  isLoading = true;
  lastLoadError = null;

  try {
    console.log("[KB] Loading local breed workbook...");
    const localBreeds = parseWorkbookKnowledgeBase();

    if (localBreeds.length > 0) {
      cachedBreeds = localBreeds;
      isLoading = false;
      console.log(`[KB] Loaded ${cachedBreeds.length} breeds from local workbook`);
      return cachedBreeds;
    }

    throw new Error("local_workbook_has_no_breed_records");
  } catch (error) {
    lastLoadError = error?.message || String(error);
    console.warn(`[KB] Local workbook unavailable: ${lastLoadError}`);
    console.log("[KB] Falling back to Ninja API breed queries...");
  }

  try {

    // Fetch a diverse set of common breeds
    const breedQueries = [
      "golden retriever",
      "labrador retriever",
      "german shepherd",
      "bulldog",
      "poodle",
      "beagle",
      "dachshund",
      "husky",
      "corgi",
      "border collie",
      "shiba inu",
      "boxer",
      "ragdoll",
      "siamese",
      "persian",
      "maine coon",
      "bengal",
      "british shorthair"
    ];

    const breedPromises = breedQueries.map((query) =>
      fetchPetKnowledge(query)
        .then((result) => result.records || [])
        .catch((error) => {
          console.warn(`[KB] Failed to fetch ${query}:`, error);
          return [];
        })
    );

    const allResults = await Promise.all(breedPromises);
    const flattened = allResults.flat();

    // Deduplicate by name (case-insensitive)
    const seen = new Set();
    const deduped = flattened.filter((breed) => {
      const key = breed.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cachedBreeds = deduped.length > 0 ? deduped : FALLBACK_PROFILES;

    console.log(`[KB] Successfully loaded ${cachedBreeds.length} breeds from Ninja API`);
    return cachedBreeds;
  } catch (error) {
    lastLoadError = error?.message || String(error);
    console.error("[KB] Failed to load knowledge base:", lastLoadError);
    console.log(`[KB] Falling back to ${FALLBACK_PROFILES.length} built-in profiles`);
    cachedBreeds = FALLBACK_PROFILES;
    return cachedBreeds;
  } finally {
    isLoading = false;
  }
}

/**
 * Get the current knowledge base (cached breeds or fallback).
 * If not yet loaded, returns fallback profiles immediately.
 */
export function getKnowledgeBase() {
  return cachedBreeds.length > 0 ? cachedBreeds : FALLBACK_PROFILES;
}

/**
 * Get metadata about the knowledge base (for debugging/monitoring).
 */
export function getKnowledgeBaseMetadata() {
  return {
    breedCount: cachedBreeds.length,
    isLoaded: cachedBreeds.length > 0,
    isLoading,
    lastError: lastLoadError,
    source: cachedBreeds[0]?.source || (cachedBreeds.length > 0 ? "ninja-api" : "fallback")
  };
}

/**
 * Force reload the knowledge base (e.g., for testing or manual refresh).
 */
export async function reloadKnowledgeBase() {
  cachedBreeds = [];
  lastLoadError = null;
  return loadKnowledgeBase();
}
