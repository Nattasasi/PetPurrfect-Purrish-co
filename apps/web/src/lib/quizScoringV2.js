/**
 * UPDATED QUIZ SCORING LOGIC
 * 
 * Key Changes:
 * - Trait names updated (stranger_friendly replaces independence)
 * - Cluster-based matching instead of direct profile matching
 * - All 486 breeds available via clusters
 * - Better trait normalization for new 16-question quiz
 */

const TRAIT_KEYS = [
  'energy',
  'sociability',
  'stranger_friendly',
  'routine',
  'trainability'
];

function emptyTraitMap(seed = 0) {
  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = seed;
    return acc;
  }, {});
}

/**
 * Score quiz answers and compute normalized trait profile
 * Updated to work with redesigned 16-question quiz and new trait names
 */
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

  // Normalization formula: centers at 0.5 and scales by maxAbs
  const normalized = emptyTraitMap(0.5);
  TRAIT_KEYS.forEach((key) => {
    const cap = maxAbs[key] || 1;
    const value = (raw[key] + cap) / (2 * cap);
    normalized[key] = Math.min(1, Math.max(0, Number(value.toFixed(3))));
  });

  const topTraits = [...TRAIT_KEYS]
    .sort((a, b) => {
      // For stranger_friendly, we want to capture both extremes
      // So we score by distance from 0.5
      const aDist = Math.abs(normalized[a] - 0.5);
      const bDist = Math.abs(normalized[b] - 0.5);
      return bDist - aDist;
    })
    .slice(0, 3)
    .map((key) => ({ key, value: normalized[key] }));

  return {
    raw,
    normalized,
    topTraits
  };
}

/**
 * Find best matching cluster and return a random breed from it
 */
export function recommendPetFromCluster(normalizedTraits, clusters, allBreeds) {
  if (!clusters || clusters.length === 0) {
    return null;
  }

  // Find cluster centroid closest to user traits
  let bestCluster = clusters[0];
  let minDistance = Infinity;

  for (const cluster of clusters) {
    const distance = TRAIT_KEYS.reduce((sum, key) => {
      const diff = (normalizedTraits[key] || 0.5) - (cluster.centroid[key] || 0.5);
      return sum + diff * diff;
    }, 0);

    if (distance < minDistance) {
      minDistance = distance;
      bestCluster = cluster;
    }
  }

  // Get random breed from the matching cluster
  const memberIds = bestCluster.memberIds || [];
  if (memberIds.length === 0) {
    return null;
  }

  const randomId = memberIds[Math.floor(Math.random() * memberIds.length)];
  const breed = allBreeds.find((b) => b.id === randomId);

  // Calculate confidence based on distance
  const maxDistance = Math.sqrt(TRAIT_KEYS.length);
  const confidence = Math.max(0, 1 - Math.sqrt(minDistance) / maxDistance);

  return {
    ...breed,
    confidence: Number(confidence.toFixed(3))
  };
}

/**
 * Recommend a pet based on normalized traits
 * Returns the cluster's representative breed for display
 */
export function getRecommendedBreedProfile(normalizedTraits, clusters) {
  if (!clusters || clusters.length === 0) {
    return null;
  }

  let bestCluster = clusters[0];
  let minDistance = Infinity;

  for (const cluster of clusters) {
    const distance = TRAIT_KEYS.reduce((sum, key) => {
      const diff = (normalizedTraits[key] || 0.5) - (cluster.centroid[key] || 0.5);
      return sum + diff * diff;
    }, 0);

    if (distance < minDistance) {
      minDistance = distance;
      bestCluster = cluster;
    }
  }

  const maxDistance = Math.sqrt(TRAIT_KEYS.length);
  const confidence = Math.max(0, 1 - Math.sqrt(minDistance) / maxDistance);

  return {
    cluster: bestCluster,
    confidence: Number(confidence.toFixed(3)),
    distance: Math.sqrt(minDistance)
  };
}
