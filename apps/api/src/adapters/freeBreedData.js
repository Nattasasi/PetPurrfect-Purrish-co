const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const RESCUE_GROUPS_URL = "https://api.rescuegroups.org/v5/public/animals/search/available/";
const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rate";
const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

const COUNTRY_CURRENCY = {
  AU: "AUD", CA: "CAD", GB: "GBP", IN: "INR", JP: "JPY", MY: "MYR",
  NZ: "NZD", PH: "PHP", SG: "SGD", TH: "THB", US: "USD", VN: "VND"
};

const TIME_ZONE_COUNTRY = {
  "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Kolkata": "IN",
  "Asia/Kuala_Lumpur": "MY", "Asia/Manila": "PH", "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP", "Australia/Sydney": "AU", "Europe/London": "GB",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Toronto": "CA", "Pacific/Auckland": "NZ"
};

function clean(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function timezoneLocation(timeZone) {
  const city = clean(timeZone).split("/").pop();
  return city ? city.replaceAll("_", " ") : "";
}

export function resolveRegionalContext(options = {}) {
  const locale = clean(options.locale, 40);
  const timeZone = clean(options.timeZone, 80);
  const localeCountry = locale.match(/[-_]([A-Za-z]{2})(?:$|-)/)?.[1]?.toUpperCase() || "";
  const country = TIME_ZONE_COUNTRY[timeZone] || localeCountry;

  return {
    location: clean(options.location) || timezoneLocation(timeZone),
    country,
    currency: clean(options.currency, 3).toUpperCase() || COUNTRY_CURRENCY[country] || "",
    language: locale.split(/[-_]/)[0]?.toLowerCase() || "en",
    locale,
    timeZone
  };
}

function searchUrl(query) {
  return `https://search.brave.com/search?${new URLSearchParams({ q: query })}`;
}

function sourceList(items) {
  return items
    .map((item) => ({ title: clean(item?.title, 140), url: validUrl(item?.url) }))
    .filter((item) => item.title && item.url)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 5);
}

async function fetchWithTimeout(url, options, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBraveResults(name, region, fetchImpl) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  const query = [`"${name}"`, "adoption rescue shelter price", region.location].filter(Boolean).join(" ");
  const body = {
    q: query,
    count: 8,
    safesearch: "strict",
    search_lang: region.language
  };
  if (region.country) body.country = region.country;

  try {
    const response = await fetchWithTimeout(BRAVE_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Subscription-Token": apiKey
      },
      body: JSON.stringify(body)
    }, fetchImpl);
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.web?.results) ? payload.web.results : [];
  } catch {
    return [];
  }
}

function relatedIncluded(payload, animal, type) {
  const relationshipData = animal?.relationships?.[type]?.data;
  const related = Array.isArray(relationshipData)
    ? relationshipData
    : (relationshipData ? [relationshipData] : []);
  const ids = new Set(related.map((item) => String(item.id)));
  return (payload?.included || []).filter((item) => item.type === type && ids.has(String(item.id)));
}

function rescueListing(payload, animal) {
  const attributes = animal?.attributes || {};
  const locations = relatedIncluded(payload, animal, "locations");
  const organizations = relatedIncluded(payload, animal, "orgs");
  const location = locations[0]?.attributes || {};
  const organization = organizations[0]?.attributes || {};
  return {
    title: clean(`${attributes.name || "Adoptable pet"} — ${organization.name || attributes.breedString || "RescueGroups"}`),
    url: validUrl(attributes.url || organization.adoptionUrl || organization.url),
    fee: clean(attributes.adoptionFeeString, 80) || null,
    location: clean(location.citystate || [location.city, location.state, location.country].filter(Boolean).join(", "))
  };
}

function locationMatches(listing, requestedLocation) {
  if (!requestedLocation) return true;
  const requested = requestedLocation.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2);
  const actual = listing.location.toLowerCase();
  return requested.some((part) => actual.includes(part));
}

async function fetchRescueGroups(name, region, fetchImpl) {
  const apiKey = process.env.RESCUEGROUPS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetchWithTimeout(`${RESCUE_GROUPS_URL}?limit=10&include=locations,orgs`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: apiKey
      },
      body: JSON.stringify({
        data: {
          filters: [{ fieldName: "animals.breedString", operation: "contains", criteria: name }]
        }
      })
    }, fetchImpl);
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload?.data || [])
      .map((animal) => rescueListing(payload, animal))
      .filter((listing) => listing.url && locationMatches(listing, region.location))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function fetchFreeBreedData(name, options = {}, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const region = resolveRegionalContext(options);
  const cacheKey = [name, region.location, region.country, region.currency].join("|").toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.value;

  const [rescueListings, braveResults] = await Promise.all([
    fetchRescueGroups(name, region, fetchImpl),
    fetchBraveResults(name, region, fetchImpl)
  ]);
  const adoptionPattern = /adopt|rescue|shelter|rehom/i;
  const braveAdoption = braveResults.find((item) => adoptionPattern.test(`${item.title} ${item.description} ${item.url}`));
  const adoptionQuery = [name, "adoption rescue", region.location].filter(Boolean).join(" ");
  const priceQuery = [name, "price", region.location, region.currency].filter(Boolean).join(" ");
  const rescue = rescueListings[0];
  const adoptionUrl = rescue?.url || validUrl(braveAdoption?.url) || searchUrl(adoptionQuery);
  const sources = sourceList([
    ...rescueListings,
    ...braveResults.slice(0, 5)
  ]);

  const value = {
    region,
    adoption: {
      available: rescue ? true : null,
      url: adoptionUrl,
      message: rescue
        ? `A current listing was found${rescue.fee ? `; listed fee: ${rescue.fee}` : ""}.`
        : `Search current shelters and rescues${region.location ? ` near ${region.location}` : ""}.`,
      location: rescue?.location || region.location || null,
      provider: rescue ? "RescueGroups" : (braveAdoption ? "Brave Search" : "search-link")
    },
    priceResearchUrl: searchUrl(priceQuery),
    sources,
    source: rescue ? "rescuegroups" : (braveResults.length ? "brave-search" : "search-link")
  };
  cache.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}

export async function convertPriceRange(price, requestedCurrency, dependencies = {}) {
  if (!price || !requestedCurrency || !price.currency) return null;
  const from = clean(price.currency, 3).toUpperCase();
  const to = clean(requestedCurrency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
  if (from === to) return { ...price, currency: to };

  const rateKey = `rate|${from}|${to}`;
  const cached = cache.get(rateKey);
  let rate = cached && Date.now() - cached.createdAt < CACHE_TTL_MS ? cached.value : null;
  if (!rate) {
    try {
      const fetchImpl = dependencies.fetchImpl || fetch;
      const response = await fetchWithTimeout(`${FRANKFURTER_URL}/${from}/${to}`, {}, fetchImpl);
      if (!response.ok) return null;
      const payload = await response.json();
      rate = Number(payload?.rate);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      cache.set(rateKey, { createdAt: Date.now(), value: rate });
    } catch {
      return null;
    }
  }

  const convert = (amount) => Number.isFinite(amount) ? Math.round(amount * rate) : null;
  return {
    min: convert(price.min),
    max: convert(price.max),
    currency: to,
    source: `${price.source || "external-provider"};frankfurter`
  };
}
