const TRAIT_KEYS = [
  "energy",
  "sociability",
  "stranger_friendly",
  "routine",
  "trainability"
];
// fallback pet profiles for recommendation
const PET_PROFILES = [
  {
    id: "golden_retriever",
    name: "Golden Retriever",
    summary: "Friendly, trainable, and thrives on social interaction.",
    target: { energy: 0.75, sociability: 0.9, stranger_friendly: 0.35, routine: 0.6, trainability: 0.9 }
  },
  {
    id: "labrador_retriever",
    name: "Labrador Retriever",
    summary: "Warm, upbeat, and happiest when life is active and social.",
    target: { energy: 0.8, sociability: 0.85, stranger_friendly: 0.4, routine: 0.55, trainability: 0.85 }
  },
  {
    id: "corgi",
    name: "Corgi",
    summary: "Cheerful, people-loving, and better with structure than chaos.",
    target: { energy: 0.75, sociability: 0.8, stranger_friendly: 0.45, routine: 0.7, trainability: 0.75 }
  },
  {
    id: "poodle",
    name: "Poodle",
    summary: "Smart, adaptable, and quick to pick up on your rhythms.",
    target: { energy: 0.65, sociability: 0.8, stranger_friendly: 0.45, routine: 0.65, trainability: 0.95 }
  },
  {
    id: "shiba_inu",
    name: "Shiba Inu",
    summary: "Independent and alert with balanced activity needs.",
    target: { energy: 0.6, sociability: 0.45, stranger_friendly: 0.85, routine: 0.6, trainability: 0.5 }
  },
  {
    id: "husky",
    name: "Husky",
    summary: "Energetic, bold, and happiest when life has room to roam.",
    target: { energy: 0.95, sociability: 0.55, stranger_friendly: 0.8, routine: 0.35, trainability: 0.45 }
  },
  {
    id: "ragdoll_cat",
    name: "Ragdoll Cat",
    summary: "Calm, affectionate, and suitable for relaxed lifestyles.",
    target: { energy: 0.35, sociability: 0.75, stranger_friendly: 0.5, routine: 0.65, trainability: 0.5 }
  },
  {
    id: "siamese_cat",
    name: "Siamese Cat",
    summary: "Expressive, social, and always ready to be part of the moment.",
    target: { energy: 0.7, sociability: 0.85, stranger_friendly: 0.4, routine: 0.5, trainability: 0.6 }
  },
  {
    id: "persian_cat",
    name: "Persian Cat",
    summary: "Soft-spoken, low-key, and happiest in a calm, comfy setting.",
    target: { energy: 0.25, sociability: 0.4, stranger_friendly: 0.7, routine: 0.75, trainability: 0.35 }
  },
  {
    id: "border_collie",
    name: "Border Collie",
    summary: "Highly energetic and excels with structure and training.",
    target: { energy: 0.95, sociability: 0.65, stranger_friendly: 0.4, routine: 0.8, trainability: 0.95 }
  },
  {
    id: "british_shorthair",
    name: "British Shorthair",
    summary: "Independent, steady, and comfortable with routine.",
    target: { energy: 0.3, sociability: 0.45, stranger_friendly: 0.8, routine: 0.7, trainability: 0.45 }
  },
  {
    id: "dachshund",
    name: "Dachshund",
    summary: "Curious, self-directed, and happiest with a familiar routine.",
    target: { energy: 0.55, sociability: 0.55, stranger_friendly: 0.7, routine: 0.75, trainability: 0.4 }
  }
];

function emptyTraitMap(seed = 0) {
  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = seed;
    return acc;
  }, {});
}

export function scoreQuiz(questions, answersByQuestionId, profileData = null) {
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

  const recommendation = recommendPet(normalized, profileData);

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

export function recommendPet(normalizedTraits, profileData = null) {
  const dynamicBreeds = profileData?.breeds;
  if (Array.isArray(dynamicBreeds) && dynamicBreeds.length > 0) {
    let best = null;
    dynamicBreeds.forEach((profile) => {
      const distance = TRAIT_KEYS.reduce((sum, key) => {
        const target = profile.traits?.[key] ?? 0.5;
        const difference = (normalizedTraits[key] ?? 0.5) - target;
        return sum + difference * difference;
      }, 0);
      const confidence = Math.max(0, 1 - Math.sqrt(distance) / Math.sqrt(TRAIT_KEYS.length));
      if (!best || distance < best.distance) {
        best = {
          ...profile,
          confidence: Number(confidence.toFixed(3)),
          distance
        };
      }
    });
    return best;
  }

  let best = null;

  PET_PROFILES.forEach((profile) => {
    const distance = TRAIT_KEYS.reduce((sum, key) => {
      const target = profile.target[key] ?? 0.5;
      return sum + Math.abs((normalizedTraits[key] ?? 0.5) - target);
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
