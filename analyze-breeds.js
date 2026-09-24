const XLSX = require('xlsx');

const WORKBOOK_PATH = './apps/web/public/pet_breeds_COMPLETE_1.xlsx';
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

// Parse breeds with same logic as backend
const breeds = rows
  .filter((row) => row.breed_name && row.species)
  .map((row) => {
    const energy = numberInRange(row.energy_level_norm ?? Number(row.energy_level) / 5);
    const affection = numberInRange(row.affection_level_norm ?? Number(row.affection_level) / 5);
    const socialNeeds = numberInRange(row.social_needs_norm ?? Number(row.social_needs) / 5);
    const adaptability = numberInRange(row.adaptability_norm ?? Number(row.adaptability) / 5);
    const intelligence = numberInRange(row.intelligence_norm ?? Number(row.intelligence) / 5);

    return {
      name: row.breed_name,
      species: String(row.species).toLowerCase(),
      traits: {
        energy: energy ?? 0.5,
        sociability: socialNeeds ?? affection ?? 0.5,
        independence: 1 - ((socialNeeds ?? 0.5) * 0.7 + (affection ?? 0.5) * 0.3),
        routine: 1 - (adaptability ?? 0.5),
        trainability: intelligence ?? 0.5
      }
    };
  });

console.log('═══════════════════════════════════════════════════════════');
console.log('         BREED PROFILE AUDIT & TRAIT DISTRIBUTION');
console.log('═══════════════════════════════════════════════════════════\n');

// Overview
console.log(`Total Breeds: ${breeds.length}`);
const speciesCounts = {};
breeds.forEach((b) => {
  speciesCounts[b.species] = (speciesCounts[b.species] || 0) + 1;
});
console.log('\nSpecies Distribution:');
Object.entries(speciesCounts).forEach(([species, count]) => {
  console.log(`  ${species}: ${count}`);
});

// Trait statistics
const TRAITS = ['energy', 'sociability', 'independence', 'routine', 'trainability'];

console.log('\n\n─── TRAIT VALUE DISTRIBUTIONS ───\n');

TRAITS.forEach((trait) => {
  const values = breeds.map((b) => b.traits[trait]).filter((v) => v !== null && v !== undefined);
  const sorted = values.sort((a, b) => a - b);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  // Quartile distribution
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];

  // Distribution bins (0-0.2, 0.2-0.4, etc)
  const bins = [0, 0, 0, 0, 0];
  values.forEach((v) => {
    const binIdx = Math.floor(v * 5);
    bins[Math.min(binIdx, 4)]++;
  });

  console.log(`${trait.toUpperCase()}`);
  console.log(`  Min: ${min.toFixed(3)}, Max: ${max.toFixed(3)}, Mean: ${mean.toFixed(3)}, Median: ${median.toFixed(3)}`);
  console.log(`  Q1: ${q1.toFixed(3)}, Q3: ${q3.toFixed(3)} (IQR: ${(q3 - q1).toFixed(3)})`);
  console.log(
    `  Distribution: [0-0.2]: ${bins[0]}, [0.2-0.4]: ${bins[1]}, [0.4-0.6]: ${bins[2]}, [0.6-0.8]: ${bins[3]}, [0.8-1.0]: ${bins[4]}`
  );
  console.log('');
});

// Trait correlation (cluster analysis)
console.log('\n─── SIMILARITY CLUSTERING ANALYSIS ───\n');

function euclideanDistance(traits1, traits2) {
  return Math.sqrt(
    TRAITS.reduce((sum, trait) => {
      const diff = (traits1[trait] || 0.5) - (traits2[trait] || 0.5);
      return sum + diff * diff;
    }, 0)
  );
}

// Find breeds that are most similar
const similarities = [];
for (let i = 0; i < breeds.length; i++) {
  for (let j = i + 1; j < breeds.length; j++) {
    const dist = euclideanDistance(breeds[i].traits, breeds[j].traits);
    similarities.push({ breed1: breeds[i], breed2: breeds[j], distance: dist });
  }
}

similarities.sort((a, b) => a.distance - b.distance);

console.log('Most SIMILAR breed pairs (lowest distance = most similar):');
similarities.slice(0, 10).forEach(({ breed1, breed2, distance }, idx) => {
  console.log(`  ${idx + 1}. Distance ${distance.toFixed(3)}: ${breed1.name} ↔ ${breed2.name}`);
});

console.log('\nMost DIFFERENT breed pairs (highest distance):');
similarities.slice(-10).forEach(({ breed1, breed2, distance }, idx) => {
  console.log(`  ${idx + 1}. Distance ${distance.toFixed(3)}: ${breed1.name} ↔ ${breed2.name}`);
});

// Distance distribution
const distances = similarities.map((s) => s.distance);
const distMean = distances.reduce((a, b) => a + b, 0) / distances.length;
const distMedian = distances.sort((a, b) => a - b)[Math.floor(distances.length / 2)];

console.log(
  `\nAverage similarity (distance): ${distMean.toFixed(3)} | Median: ${distMedian.toFixed(3)}`
);
console.log(
  `  (Lower = more similar breeds exist; Higher = breeds are more differentiated)`
);

// Quadrant analysis - how many breeds fit each combination
console.log('\n\n─── TRAIT COMBINATION COVERAGE ───\n');

// Split into high/low for energy and sociability
const quadrants = [
  { name: 'High Energy, High Sociability', filter: (t) => t.energy > 0.5 && t.sociability > 0.5 },
  { name: 'High Energy, Low Sociability', filter: (t) => t.energy > 0.5 && t.sociability <= 0.5 },
  { name: 'Low Energy, High Sociability', filter: (t) => t.energy <= 0.5 && t.sociability > 0.5 },
  { name: 'Low Energy, Low Sociability', filter: (t) => t.energy <= 0.5 && t.sociability <= 0.5 }
];

quadrants.forEach(({ name, filter }) => {
  const count = breeds.filter((b) => filter(b.traits)).length;
  const pct = ((count / breeds.length) * 100).toFixed(1);
  console.log(`  ${name}: ${count} breeds (${pct}%)`);
});

// Variance check - find outliers
console.log('\n\n─── BREED PROFILE VARIANCE ───\n');

const traitVariances = {};
TRAITS.forEach((trait) => {
  const values = breeds.map((b) => b.traits[trait]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  traitVariances[trait] = { mean, variance, stdDev };
});

console.log('Trait Variance (Higher = more differentiation):');
Object.entries(traitVariances).forEach(([trait, { mean, stdDev }]) => {
  console.log(`  ${trait}: StdDev: ${stdDev.toFixed(3)}, Mean: ${mean.toFixed(3)}`);
});

const avgVariance = Object.values(traitVariances).reduce((sum, v) => sum + v.stdDev, 0) / TRAITS.length;
console.log(`\nAverage StdDev across all traits: ${avgVariance.toFixed(3)}`);
console.log(`  (< 0.15 = Low variance, breeds cluster together)`);
console.log(`  (> 0.20 = Good variance, breeds are well-distributed)`);

// Recommend min profile count
console.log('\n\n─── RECOMMENDATIONS ───\n');
const profilesNeeded = Math.ceil(Math.sqrt(breeds.length));
console.log(`Based on ${breeds.length} breeds and ${TRAITS.length} traits:`);
console.log(
  `  Minimum unique profiles for good coverage: ~${profilesNeeded} (currently using 12)`
);
console.log(`  Recommended for matching precision: 30-40 profiles`);
console.log(`  Current coverage: ${((12 / breeds.length) * 100).toFixed(1)}% of available breeds`);
