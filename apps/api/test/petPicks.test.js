import test from "node:test";
import assert from "node:assert/strict";
import { buildPickPlan, picksForPet } from "../src/services/petPicksService.js";
import { shopeeSearchUrl } from "../src/adapters/shopeeLinks.js";
import { SEARCH_LINKS } from "../src/data/petPicks.js";

const adult = { species: "dog", birthDate: null, weightKg: 18 };

test("pick plan adds grooming and activity groups from breed data", () => {
  const breed = { name: "Husky", breedInfo: { groomingHoursMonthly: 5, exerciseMinutesDaily: 90 } };
  const ids = buildPickPlan(adult, breed).map((group) => group.id);
  assert.ok(ids.includes("groom"));
  assert.ok(ids.includes("active"));
});

test("pick plan is capped at four groups and has no medication terms", () => {
  const plan = buildPickPlan(adult, { name: "X", breedInfo: { groomingHoursMonthly: 9, exerciseMinutesDaily: 120 } });
  assert.ok(plan.length <= 4);
  assert.ok(plan.every((group) => !/ยา/.test(group.keyword)));
});

test("search URLs encode the keyword", () => {
  assert.match(shopeeSearchUrl("อาหารสุนัข"), /^https:\/\/shopee\.co\.th\/search\?keyword=%E0/);
});

test("a configured affiliate link replaces the plain search URL for its group", async () => {
  const { picks } = await picksForPet({ ...adult, birthDate: null, weightKg: 18, breedId: null });
  assert.equal(picks[0].searchUrl, SEARCH_LINKS["dog:food"]);
});

test("picks give each group a Shopee search link plus the cleanup products", async () => {
  const { picks } = await picksForPet({ ...adult, breedId: null });
  assert.ok(picks.slice(0, -1).every((group) => group.searchUrl.startsWith("http")));
  assert.ok(picks.at(-1).products.every((product) => product.url));
});
