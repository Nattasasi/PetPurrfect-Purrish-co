import test from "node:test";
import assert from "node:assert/strict";
import { lifeStage, reminderPresets, suggestionsForPet } from "../src/services/petService.js";

test("lifeStage uses species-specific senior ages", () => {
  const yearsAgo = (years) => new Date(Date.now() - years * 365.25 * 86400000).toISOString().slice(0, 10);
  assert.equal(lifeStage(yearsAgo(0.3), "dog"), "puppy");
  assert.equal(lifeStage(yearsAgo(0.3), "cat"), "kitten");
  assert.equal(lifeStage(yearsAgo(8), "dog"), "senior");
  assert.equal(lifeStage(yearsAgo(8), "cat"), "adult");
  assert.equal(lifeStage(null, "dog"), "adult");
});

test("reminderPresets always include flea and tick prevention", () => {
  const presets = reminderPresets({ species: "dog", birthDate: null });
  assert.ok(presets.some((preset) => preset.type === "flea_tick"));
  assert.ok(presets.every((preset) => /^\d{4}-\d{2}-\d{2}$/.test(preset.dueDate)));
});

test("suggestionsForPet prompts for a breed when none is set", async () => {
  const cards = await suggestionsForPet({ name: "Mo", species: "cat", breedId: null, birthDate: null });
  assert.ok(cards.some((card) => card.id === "breed"));
});

test("suggestionsForPet uses workbook data for a known breed", async () => {
  const cards = await suggestionsForPet({ name: "Rex", species: "dog", breedId: "beagle", birthDate: null });
  assert.ok(cards.some((card) => card.id === "exercise"));
  assert.ok(!cards.some((card) => card.id === "breed"));
});
