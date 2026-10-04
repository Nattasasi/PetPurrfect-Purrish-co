import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCareConsiderations,
  getQuizProfiles,
  normalizeCareNote
} from "../src/services/breedProfileService.js";

test("workbook care costs are structured and removed from prose", async () => {
  const profiles = await getQuizProfiles();
  const breed = profiles.breeds.find((item) => item.id === "valley_bulldog");

  assert.ok(breed);
  assert.deepEqual(breed.breedInfo.estimatedMonthlyCareCost, {
    min: 10800,
    max: 10800,
    currency: "INR",
    period: "month",
    source: "local-breed-workbook"
  });
  assert.doesNotMatch(breed.breedInfo.healthNote, /₹|grooming costs/i);
  assert.deepEqual(
    breed.breedInfo.careConsiderations.map((item) => item.category),
    ["Health", "Grooming", "Lifestyle"]
  );
});

test("care-note normalization removes embedded currency without cutting prose", () => {
  const note = "Health warning. Factor in ongoing grooming costs (₹1,500-3,000/month). Lifestyle guidance.";
  assert.equal(normalizeCareNote(note), "Health warning. Lifestyle guidance.");
  assert.equal(buildCareConsiderations(note).length, 1);
});
