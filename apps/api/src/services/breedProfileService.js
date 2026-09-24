/**
 * API endpoint: GET /quiz/profiles
 * Returns all 486 breeds organized into clusters
 * 
 * Usage:
 * - Frontend loads this on startup
 * - Quiz scoring matches user traits to cluster centroid
 * - Returns random breed from matching cluster
 */

import XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';

const WORKBOOK_PATH = fileURLToPath(
  new URL('../../../web/public/pet_breeds_COMPLETE_1.xlsx', import.meta.url)
);

export const TRAIT_KEYS = ['energy', 'sociability', 'stranger_friendly', 'routine', 'trainability'];

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

function distance(traits1, traits2) {
  return Math.sqrt(
    TRAIT_KEYS.reduce((sum, key) => {
      const diff = (traits1[key] || 0.5) - (traits2[key] || 0.5);
      return sum + diff * diff;
    }, 0)
  );
}

function clusterBreeds(breeds, numClusters = 40) {
  if (breeds.length <= numClusters) {
    return breeds.map((breed) => ({
      centroid: breed.traits,
      representative: breed,
      members: [breed]
    }));
  }

  // Seed with evenly spaced source breeds so the same workbook always produces
  // the same candidate clusters across server restarts.
  const sortedBreeds = [...breeds].sort((a, b) => a.id.localeCompare(b.id));
  const centroids = Array.from({ length: numClusters }, (_, index) => ({
    ...sortedBreeds[Math.floor(index * sortedBreeds.length / numClusters)].traits
  }));

  let assignments = new Array(breeds.length).fill(0);
  let converged = false;
  let iterations = 0;
  const maxIterations = 10;

  while (!converged && iterations < maxIterations) {
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
      const newCentroid = {
        energy: newCentroids[c].energy / newCentroids[c].count,
        sociability: newCentroids[c].sociability / newCentroids[c].count,
        stranger_friendly: newCentroids[c].stranger_friendly / newCentroids[c].count,
        routine: newCentroids[c].routine / newCentroids[c].count,
        trainability: newCentroids[c].trainability / newCentroids[c].count
      };
      if (distance(centroids[c], newCentroid) > 0.01) {
        changed = true;
      }
      centroids[c] = newCentroid;
    }

    converged = !changed;
    iterations++;
  }

  const clusters = [];
  for (let c = 0; c < numClusters; c++) {
    const members = breeds.filter((_, i) => assignments[i] === c);
    if (members.length > 0) {
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

function parseWorkbookBreeds() {
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
          stranger_friendly: strangerFriendly ?? 0.5,
          routine: 1 - (adaptability ?? 0.5),
          trainability: intelligence ?? 0.5
        }
      };
    });
}

let cachedProfilesData = null;

export async function getQuizProfiles() {
  if (cachedProfilesData) {
    return cachedProfilesData;
  }

  const breeds = parseWorkbookBreeds();
  const clusters = clusterBreeds(breeds, 40);

  cachedProfilesData = {
    timestamp: new Date().toISOString(),
    breedCount: breeds.length,
    clusterCount: clusters.length,
    breeds,
    clusters: clusters.map((c) => ({
      centroid: c.centroid,
      representative: c.representative,
      memberIds: c.members.map((b) => b.id),
      memberCount: c.members.length
    }))
  };

  return cachedProfilesData;
}

/**
 * Find the best matching cluster for user traits
 */
export function findBestCluster(userTraits, clusters) {
  return getTopClusters(userTraits, clusters, 1)[0] || null;
}

export function getTopClusters(userTraits, clusters, limit = 3) {
  if (!Array.isArray(clusters) || clusters.length === 0) {
    return [];
  }

  return clusters
    .map((cluster) => ({
      ...cluster,
      clusterDistance: distance(userTraits, cluster.centroid)
    }))
    .sort((a, b) => a.clusterDistance - b.clusterDistance)
    .slice(0, Math.max(1, limit));
}

function traitVariance(members, trait) {
  if (members.length < 2) return 0;
  const mean = members.reduce((sum, breed) => sum + (breed.traits?.[trait] ?? 0.5), 0) / members.length;
  return members.reduce((sum, breed) => {
    const difference = (breed.traits?.[trait] ?? 0.5) - mean;
    return sum + difference * difference;
  }, 0) / members.length;
}

function optionLabel(trait, value) {
  const labels = {
    energy: ['Quiet pace', 'Balanced pace', 'Active pace', 'Very active pace'],
    sociability: ['Prefers space', 'Selective company', 'Friendly company', 'Constant company'],
    stranger_friendly: ['Reserved with newcomers', 'Cautious at first', 'Usually welcoming', 'Immediately friendly'],
    routine: ['Flexible days', 'Some structure', 'Regular routine', 'Highly structured routine'],
    trainability: ['Learns independently', 'Open to guidance', 'Enjoys learning', 'Thrives on training']
  };
  return labels[trait][value] || `Option ${value + 1}`;
}

export function buildDiscriminatorQuestion(userTraits, candidateClusters, allBreeds = []) {
  const members = candidateClusters.flatMap((cluster) => (
    cluster.members || cluster.memberIds?.map((id) => allBreeds.find((breed) => breed.id === id)).filter(Boolean) || []
  ));
  if (members.length === 0) return null;

  const trait = TRAIT_KEYS
    .map((key) => ({
      key,
      variance: traitVariance(members, key),
      userDistance: Math.abs((userTraits[key] ?? 0.5) - 0.5)
    }))
    .sort((a, b) => (b.variance - a.variance) || (b.userDistance - a.userDistance))[0].key;

  const values = [0.2, 0.4, 0.6, 0.8];
  return {
    id: 'adaptive-q10',
    type: 'single',
    text: `Which description feels most like your preference for ${trait.replace('_', ' ')}?`,
    discriminator: { trait, candidateClusterCount: candidateClusters.length },
    options: values.map((value, index) => ({
      value: `${trait}_${index + 1}`,
      label: optionLabel(trait, index),
      traits: { [trait]: value }
    }))
  };
}

export function rankBreedsInClusters(userTraits, candidateClusters, finalQuestion = null, allBreeds = []) {
  const finalTrait = finalQuestion?.discriminator?.trait;
  const finalWeight = finalTrait ? 0.35 : 0;
  const members = candidateClusters.flatMap((cluster) => (
    cluster.members || cluster.memberIds?.map((id) => allBreeds.find((breed) => breed.id === id)).filter(Boolean) || []
  ));
  const ranked = members.map((breed) => {
    const baseDistance = TRAIT_KEYS.reduce((sum, key) => {
      const difference = (userTraits[key] ?? 0.5) - (breed.traits?.[key] ?? 0.5);
      return sum + difference * difference;
    }, 0);
    const finalDistance = finalTrait
      ? Math.pow((userTraits[finalTrait] ?? 0.5) - (breed.traits?.[finalTrait] ?? 0.5), 2) * finalWeight
      : 0;
    const totalDistance = Math.sqrt(baseDistance + finalDistance);
    return {
      ...breed,
      distance: totalDistance,
      confidence: Number(Math.max(0, 1 - totalDistance / Math.sqrt(TRAIT_KEYS.length)).toFixed(3))
    };
  });

  return ranked.sort((a, b) => a.distance - b.distance);
}

/**
 * Get a random breed from the matching cluster
 */
export function getRandomBreedFromCluster(cluster, allBreeds) {
  const memberIds = cluster.memberIds;
  const randomId = memberIds[Math.floor(Math.random() * memberIds.length)];
  return allBreeds.find((b) => b.id === randomId) || cluster.representative;
}
