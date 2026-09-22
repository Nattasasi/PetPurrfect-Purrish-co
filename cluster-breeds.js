const XLSX = require('xlsx');

const WORKBOOK_PATH = './apps/web/public/pet_breeds_COMPLETE_1 - Copy.xlsx';
const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });

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
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * NEW TRAIT: friendliness_to_strangers
 * Replaces the broken "independence" trait
 * Higher = more friendly to strangers, Lower = aloof/reserved
 */
function parseBreeds() {
  return rows
    .filter((row) => row.breed_name && row.species)
    .map((row) => {
      const energy = numberInRange(row.energy_level_norm ?? Number(row.energy_level) / 5);
      const affection = numberInRange(row.affection_level_norm ?? Number(row.affection_level) / 5);
      const socialNeeds = numberInRange(row.social_needs_norm ?? Number(row.social_needs) / 5);
      const adaptability = numberInRange(row.adaptability_norm ?? Number(row.adaptability) / 5);
      const intelligence = numberInRange(row.intelligence_norm ?? Number(row.intelligence) / 5);
      // NEW: Use stranger_friendly_norm directly (better represents aloofness/openness to new people)
      const strangerFriendly = numberInRange(row.stranger_friendly_norm);

      return {
        id: slugify(row.breed_name),
        name: row.breed_name,
        petType: String(row.species).toLowerCase(),
        summary: row.description || `${row.breed_name}: ${row.personality_traits || 'breed profile'}.`,
        personalityTraits: row.personality_traits || '',
        source: 'excel-workbook',
        traits: {
          energy: energy ?? 0.5,
          sociability: socialNeeds ?? affection ?? 0.5,
          // CHANGED FROM independence: now using stranger_friendly (more meaningful)
          stranger_friendly: strangerFriendly ?? 0.5,
          routine: 1 - (adaptability ?? 0.5),
          trainability: intelligence ?? 0.5
        }
      };
    });
}

/**
 * Euclidean distance between two trait vectors
 */
function distance(traits1, traits2) {
  const keys = ['energy', 'sociability', 'stranger_friendly', 'routine', 'trainability'];
  return Math.sqrt(
    keys.reduce((sum, key) => {
      const diff = (traits1[key] || 0.5) - (traits2[key] || 0.5);
      return sum + diff * diff;
    }, 0)
  );
}

/**
 * K-means clustering to group similar breeds
 * Returns array of clusters, each containing similar breeds
 */
function clusterBreeds(breeds, numClusters = 40) {
  if (breeds.length <= numClusters) {
    // If fewer breeds than clusters, each breed is its own cluster
    return breeds.map((breed) => ({ representative: breed, members: [breed] }));
  }

  const TRAIT_KEYS = ['energy', 'sociability', 'stranger_friendly', 'routine', 'trainability'];

  // Initialize centroids: spread across trait space
  const centroids = [];
  for (let i = 0; i < numClusters; i++) {
    centroids.push({
      energy: Math.random(),
      sociability: Math.random(),
      stranger_friendly: Math.random(),
      routine: Math.random(),
      trainability: Math.random()
    });
  }

  let assignments = new Array(breeds.length).fill(0);
  let converged = false;
  let iterations = 0;
  const maxIterations = 10;

  while (!converged && iterations < maxIterations) {
    // Assign breeds to nearest centroid
    for (let i = 0; i < breeds.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < numClusters; c++) {
        const d = distance(breeds[i].traits, centroids[c]);
        if (d < minDist) {
          minDist = d;
          bestCluster = c;
        }
      }
      assignments[i] = bestCluster;
    }

    // Recalculate centroids
    const newCentroids = centroids.map(() => ({
      energy: 0,
      sociability: 0,
      stranger_friendly: 0,
      routine: 0,
      trainability: 0,
      count: 0
    }));

    for (let i = 0; i < breeds.length; i++) {
      const c = assignments[i];
      newCentroids[c].energy += breeds[i].traits.energy;
      newCentroids[c].sociability += breeds[i].traits.sociability;
      newCentroids[c].stranger_friendly += breeds[i].traits.stranger_friendly;
      newCentroids[c].routine += breeds[i].traits.routine;
      newCentroids[c].trainability += breeds[i].traits.trainability;
      newCentroids[c].count++;
    }

    let changed = false;
    for (let c = 0; c < numClusters; c++) {
      if (newCentroids[c].count === 0) continue;
      const oldCentroid = centroids[c];
      const newCentroid = {
        energy: newCentroids[c].energy / newCentroids[c].count,
        sociability: newCentroids[c].sociability / newCentroids[c].count,
        stranger_friendly: newCentroids[c].stranger_friendly / newCentroids[c].count,
        routine: newCentroids[c].routine / newCentroids[c].count,
        trainability: newCentroids[c].trainability / newCentroids[c].count
      };
      if (distance(oldCentroid, newCentroid) > 0.01) {
        changed = true;
      }
      centroids[c] = newCentroid;
    }

    converged = !changed;
    iterations++;
  }

  // Build clusters
  const clusters = [];
  for (let c = 0; c < numClusters; c++) {
    const members = breeds.filter((_, i) => assignments[i] === c);
    if (members.length > 0) {
      // Pick representative: closest to centroid
      let bestRep = members[0];
      let minDist = distance(members[0].traits, centroids[c]);
      for (const member of members) {
        const d = distance(member.traits, centroids[c]);
        if (d < minDist) {
          minDist = d;
          bestRep = member;
        }
      }
      clusters.push({
        centroid: centroids[c],
        representative: bestRep,
        members
      });
    }
  }

  return clusters;
}

// Main
const breeds = parseBreeds();
const clusters = clusterBreeds(breeds, 40);

console.log(`\n✅ Loaded ${breeds.length} breeds into ${clusters.length} clusters\n`);

// Export for use in API
const output = {
  breeds,
  clusters: clusters.map((c) => ({
    centroid: c.centroid,
    representative: c.representative,
    memberCount: c.members.length,
    members: c.members.map((b) => b.id)
  }))
};

console.log(JSON.stringify(output, null, 2));
