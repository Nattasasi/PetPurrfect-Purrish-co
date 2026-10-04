import test from "node:test";
import assert from "node:assert/strict";
import {
  convertPriceRange,
  fetchFreeBreedData,
  resolveRegionalContext
} from "../src/adapters/freeBreedData.js";

test("regional context prefers timezone over a mismatched browser locale", () => {
  assert.deepEqual(resolveRegionalContext({ locale: "en-US", timeZone: "Asia/Bangkok" }), {
    location: "Bangkok",
    country: "TH",
    currency: "THB",
    language: "en",
    locale: "en-US",
    timeZone: "Asia/Bangkok"
  });
});

test("free breed data prefers a matching live rescue listing", async () => {
  const originalBraveKey = process.env.BRAVE_SEARCH_API_KEY;
  const originalRescueKey = process.env.RESCUEGROUPS_API_KEY;
  process.env.BRAVE_SEARCH_API_KEY = "brave-test";
  process.env.RESCUEGROUPS_API_KEY = "rescue-test";

  try {
    const result = await fetchFreeBreedData("Test Retriever Free", {
      timeZone: "Asia/Bangkok",
      locale: "en-US"
    }, {
      fetchImpl: async (url) => {
        if (url.startsWith("https://api.rescuegroups.org")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                type: "animals",
                id: "1",
                attributes: {
                  name: "Sunny",
                  breedString: "Test Retriever Free",
                  adoptionFeeString: "THB 2,000",
                  url: "https://example.org/adopt/sunny"
                },
                relationships: { locations: { data: [{ type: "locations", id: "10" }] } }
              }],
              included: [{
                type: "locations",
                id: "10",
                attributes: { city: "Bangkok", country: "Thailand" }
              }]
            })
          };
        }
        return {
          ok: true,
          json: async () => ({
            web: { results: [{ title: "Breed guide", url: "https://example.com/guide" }] }
          })
        };
      }
    });

    assert.equal(result.region.currency, "THB");
    assert.equal(result.adoption.available, true);
    assert.equal(result.adoption.provider, "RescueGroups");
    assert.equal(result.adoption.url, "https://example.org/adopt/sunny");
    assert.match(result.adoption.message, /THB 2,000/);
    assert.match(result.priceResearchUrl, /search\.brave\.com/);
  } finally {
    if (originalBraveKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = originalBraveKey;
    if (originalRescueKey === undefined) delete process.env.RESCUEGROUPS_API_KEY;
    else process.env.RESCUEGROUPS_API_KEY = originalRescueKey;
  }
});

test("Frankfurter converts a provider price into the requested currency", async () => {
  const converted = await convertPriceRange({
    min: 100,
    max: 200,
    currency: "USD",
    source: "test-provider"
  }, "THB", {
    fetchImpl: async () => ({ ok: true, json: async () => ({ rate: 36.5 }) })
  });

  assert.deepEqual(converted, {
    min: 3650,
    max: 7300,
    currency: "THB",
    source: "test-provider;frankfurter"
  });
});

