const TRAIT_KEYS = [
  "energy",
  "sociability",
  "independence",
  "routine",
  "trainability"
];

const PET_PROFILES = [
  {
    id: "golden_retriever",
    name: "Golden Retriever",
    summary: "Friendly, trainable, and thrives on social interaction.",
    target: { energy: 0.75, sociability: 0.9, independence: 0.35, routine: 0.6, trainability: 0.9 }
  },
  {
    id: "shiba_inu",
    name: "Shiba Inu",
    summary: "Independent and alert with balanced activity needs.",
    target: { energy: 0.6, sociability: 0.45, independence: 0.85, routine: 0.6, trainability: 0.5 }
  },
  {
    id: "ragdoll_cat",
    name: "Ragdoll Cat",
    summary: "Calm, affectionate, and suitable for relaxed lifestyles.",
    target: { energy: 0.35, sociability: 0.75, independence: 0.5, routine: 0.65, trainability: 0.5 }
  },
  {
    id: "border_collie",
    name: "Border Collie",
    summary: "Highly energetic and excels with structure and training.",
    target: { energy: 0.95, sociability: 0.65, independence: 0.4, routine: 0.8, trainability: 0.95 }
  },
  {
    id: "british_shorthair",
    name: "British Shorthair",
    summary: "Independent, steady, and comfortable with routine.",
    target: { energy: 0.3, sociability: 0.45, independence: 0.8, routine: 0.7, trainability: 0.45 }
  }
];

function emptyTraitMap(seed = 0) {
  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = seed;
    return acc;
  }, {});
}

export function scoreQuiz(questions, answersByQuestionId) {
  const raw = emptyTraitMap(0);
  const maxAbs = emptyTraitMap(0);

  questions.forEach((question) => {
    TRAIT_KEYS.forEach((key) => {
      const optionMax = Math.max(
        ...question.options.map((option) => Math.abs(option.traits?.[key] ?? 0)),
        0
      );
      maxAbs[key] += optionMax;
    });

    const selectedValue = answersByQuestionId[question.id];
    const selectedOption = question.options.find(
      (option) => option.value === selectedValue
    );

    if (!selectedOption) {
      return;
    }

    TRAIT_KEYS.forEach((key) => {
      raw[key] += selectedOption.traits?.[key] ?? 0;
    });
  });

  const normalized = emptyTraitMap(0.5);
  TRAIT_KEYS.forEach((key) => {
    const cap = maxAbs[key] || 1;
    const value = (raw[key] + cap) / (2 * cap);
    normalized[key] = Math.min(1, Math.max(0, Number(value.toFixed(3))));
  });

  const recommendation = recommendPet(normalized);

  const topTraits = [...TRAIT_KEYS]
    .sort((a, b) => normalized[b] - normalized[a])
    .slice(0, 3)
    .map((key) => ({ key, value: normalized[key] }));

  return {
    raw,
    normalized,
    topTraits,
    recommendation
  };
}

export function recommendPet(normalizedTraits) {
  let best = null;

  PET_PROFILES.forEach((profile) => {
    const distance = TRAIT_KEYS.reduce((sum, key) => {
      return sum + Math.abs((normalizedTraits[key] ?? 0.5) - profile.target[key]);
    }, 0);

    const maxDistance = TRAIT_KEYS.length;
    const confidence = Math.max(0, 1 - distance / maxDistance);

    if (!best || distance < best.distance) {
      best = {
        id: profile.id,
        name: profile.name,
        summary: profile.summary,
        confidence: Number(confidence.toFixed(3)),
        distance
      };
    }
  });

  return best;
}
