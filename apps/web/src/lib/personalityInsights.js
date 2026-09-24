// Translates raw trait scores and match confidence into friendly, personalized
// copy so quiz results read like a personality read-out instead of a scoring
// report (no trait keys, percentages, or data-source labels shown to users).

const TRAIT_COPY = {
  energy: {
    high: { adjective: "energetic", sentence: "You're full of energy and love staying active." },
    mid: { adjective: "balanced", sentence: "You enjoy a healthy mix of activity and downtime." },
    low: { adjective: "laid-back", sentence: "You prefer a calm, relaxed pace to your day." }
  },
  sociability: {
    high: { adjective: "outgoing", sentence: "You're very social and recharge by being around others." },
    mid: { adjective: "easygoing", sentence: "You're comfortable both socializing and enjoying quiet time." },
    low: { adjective: "reserved", sentence: "You value your alone time and a peaceful environment." }
  },
  stranger_friendly: {
    high: { adjective: "independent", sentence: "You're independent and confident making decisions on your own." },
    mid: { adjective: "adaptable", sentence: "You like a balance of independence and guidance." },
    low: { adjective: "team-oriented", sentence: "You appreciate close companionship and clear guidance." }
  },
  routine: {
    high: { adjective: "organized", sentence: "You thrive on structure and a predictable routine." },
    mid: { adjective: "flexible", sentence: "You adapt well to both routine and spontaneity." },
    low: { adjective: "spontaneous", sentence: "You love spontaneity and dislike rigid schedules." }
  },
  trainability: {
    high: { adjective: "quick-learning", sentence: "You're a fast learner who enjoys following through on plans." },
    mid: { adjective: "curious", sentence: "You're open to learning new things at your own pace." },
    low: { adjective: "free-spirited", sentence: "You prefer figuring things out your own way." }
  }
};

function traitLevel(value) {
  if (value >= 0.66) return "high";
  if (value <= 0.34) return "low";
  return "mid";
}

export function describeTrait(key, value) {
  const copy = TRAIT_COPY[key]?.[traitLevel(value)];
  return copy?.sentence || "";
}

export function traitAdjective(key, value) {
  const copy = TRAIT_COPY[key]?.[traitLevel(value)];
  return copy?.adjective || "";
}

// Builds a short, personalized paragraph out of the user's strongest traits
// instead of exposing raw trait names and numeric scores.
export function buildPersonalitySummary(topTraits = []) {
  if (topTraits.length === 0) {
    return "Your answers point to a wonderfully balanced personality.";
  }

  const adjectives = topTraits
    .map((trait) => traitAdjective(trait.key, trait.value))
    .filter(Boolean);

  const intro = adjectives.length > 0
    ? `Based on your answers, you come across as ${formatList(adjectives)}.`
    : "Based on your answers, here's what stood out about you.";

  const sentences = topTraits
    .map((trait) => describeTrait(trait.key, trait.value))
    .filter(Boolean);

  return [intro, ...sentences].join(" ");
}

function formatList(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Converts a 0-1 match confidence score into a friendly, non-technical phrase.
export function matchStrengthLabel(confidence = 0) {
  if (confidence >= 0.8) return "an excellent match";
  if (confidence >= 0.6) return "a strong match";
  if (confidence >= 0.4) return "a solid match";
  return "an interesting match worth exploring";
}
