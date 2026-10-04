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

test("free breed data uses Brave adoption results without claiming live availability", async () => {
  const originalBraveKey = process.env.BRAVE_SEARCH_API_KEY;
  process.env.BRAVE_SEARCH_API_KEY = "brave-test";

  try {
    const result = await fetchFreeBreedData("Test Retriever Free", {
      timeZone: "Asia/Bangkok",
      locale: "en-US"
    }, {
      fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            web: {
              results: [{
                title: "Test Retriever adoption in Bangkok",
                description: "Search local shelters",
                url: "https://example.org/adopt/test-retriever"
              }]
            }
          })
        })
    });

    assert.equal(result.region.currency, "THB");
    assert.equal(result.adoption.available, null);
    assert.equal(result.adoption.provider, "Brave Search");
    assert.equal(result.adoption.url, "https://example.org/adopt/test-retriever");
    assert.match(result.adoption.message, /near Bangkok/);
    assert.equal(result.source, "brave-search");
    assert.match(result.priceResearchUrl, /search\.brave\.com/);
  } finally {
    if (originalBraveKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = originalBraveKey;
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
