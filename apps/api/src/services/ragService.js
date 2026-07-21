import { saveQuizResult } from "./quizResultRepository.js";
import { fetchPetKnowledge } from "../adapters/externalPetApi.js";

const TRAIT_KEYS = ["energy", "sociability", "independence", "routine", "trainability"];

const FALLBACK_PROFILES = [
  {
    id: "golden_retriever",
    name: "Golden Retriever",
    summary: "Friendly, social, and well-suited to active owners.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.85, sociability: 0.9, independence: 0.35, routine: 0.6, trainability: 0.9 }
  },
  {
    id: "shiba_inu",
    name: "Shiba Inu",
    summary: "Independent, alert, and confident with a balanced routine.",
    imageUrl: "/images/product6.jpg",
    traits: { energy: 0.65, sociability: 0.45, independence: 0.85, routine: 0.6, trainability: 0.5 }
  },
  {
    id: "ragdoll_cat",
    name: "Ragdoll Cat",
    summary: "Calm, affectionate, and ideal for relaxed households.",
    imageUrl: "/images/product4.jpg",
    traits: { energy: 0.35, sociability: 0.8, independence: 0.5, routine: 0.65, trainability: 0.5 }
  },
  {
    id: "border_collie",
    name: "Border Collie",
    summary: "Highly trainable and built for active, structured lifestyles.",
    imageUrl: "/images/hero-dog.png",
    traits: { energy: 0.95, sociability: 0.7, independence: 0.4, routine: 0.8, trainability: 0.95 }
  }
];

function scoreCandidate(traits, candidate) {
  const distance = TRAIT_KEYS.reduce((sum, key) => {
    const traitValue = traits[key] ?? 0.5;
    const targetValue = candidate.traits?.[key] ?? 0.5;
    return sum + Math.abs(traitValue - targetValue);
  }, 0);

  const confidence = Math.max(0, 1 - distance / TRAIT_KEYS.length);

  return {
    ...candidate,
    confidence: Number(confidence.toFixed(3)),
    distance
  };
}

function pickBestMatch(traits, candidates) {
  const scored = candidates.map((candidate) => scoreCandidate(traits, candidate));
  scored.sort((a, b) => a.distance - b.distance);
  return scored[0] || scoreCandidate(traits, FALLBACK_PROFILES[0]);
}

function buildGrounding(selected, sourceLabel) {
  return [
    {
      source: sourceLabel,
      snippet: selected.summary
    }
  ];
}

export async function evaluateQuiz(payload = {}) {
  const traits = payload.traits || {};
  const answers = payload.answers || [];

  const knowledge = await fetchPetKnowledge();
  const candidates = knowledge.records.length > 0 ? knowledge.records : FALLBACK_PROFILES;
  const selected = pickBestMatch(traits, candidates);

  const response = {
    provider: knowledge.enabled ? "ninja-api" : "fallback",
    sourceCount: candidates.length,
    match: {
      id: selected.id,
      name: selected.name,
      confidence: selected.confidence,
      imageUrl: selected.imageUrl || null
    },
    grounding: buildGrounding(selected, knowledge.enabled ? knowledge.source : "fallback-profile"),
    summary:
      selected.summary ||
      "This recommendation is computed from your quiz trait profile and external pet data.",
    traits
  };

  let persistence = { enabled: false, saved: false };

  try {
    persistence = await saveQuizResult({
      sessionId: payload.sessionId,
      matchId: response.match.id,
      matchName: response.match.name,
      confidence: response.match.confidence,
      imageUrl: response.match.imageUrl || null,
      source: "api",
      traits,
      topTraits: payload.topTraits || [],
      answers,
      provider: response.provider,
      sourceCount: response.sourceCount,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    persistence = {
      enabled: true,
      saved: false,
      error: error?.message || "persistence_failed"
    };
  }

  return {
    ...response,
    persistence
  };
}
