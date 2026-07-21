const DEFAULT_TIMEOUT_MS = 5000;

function normalizeRating(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value > 1 ? value / 5 : value));
  }

  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (["high", "very high", "energetic", "friendly", "trainable", "social"].includes(lowered)) {
      return 0.85;
    }
    if (["medium", "moderate", "balanced", "average"].includes(lowered)) {
      return 0.55;
    }
    if (["low", "calm", "quiet", "independent"].includes(lowered)) {
      return 0.25;
    }
  }

  return null;
}

function collectText(...values) {
  return values.filter(Boolean).join(" ").trim();
}

function toPetRecord(source, index = 0) {
  const id = source.id || source.slug || source.breed || source.name || `pet-${index + 1}`;
  const name = source.name || source.breed || source.title || `Pet ${index + 1}`;
  const summary = collectText(
    source.summary,
    source.description,
    source.temperament,
    source.personality,
    source.notes
  );

  const rawTraits = {
    energy:
      normalizeRating(source.energy ?? source.activity ?? source.activityLevel ?? source.exercise),
    sociability:
      normalizeRating(source.sociability ?? source.friendliness ?? source.affection ?? source.social),
    independence:
      normalizeRating(source.independence ?? source.independent ?? source.selfSufficient),
    routine:
      normalizeRating(source.routine ?? source.predictability ?? source.scheduled ?? source.consistency),
    trainability:
      normalizeRating(source.trainability ?? source.trained ?? source.obedience ?? source.intelligence)
  };

  const traits = Object.fromEntries(
    Object.entries(rawTraits).map(([key, value]) => [key, value ?? 0.5])
  );

  return {
    id,
    name,
    summary: summary || `${name} profile from Ninja API`,
    traits,
    raw: source
  };
}

function extractRecords(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.items || payload.results || payload.data || payload.breeds || payload.pets || [];
}

export function isNinjaApiConfigured() {
  return Boolean(process.env.NINJA_API_BASE_URL);
}

export async function fetchPetKnowledge() {
  const baseUrl = process.env.NINJA_API_BASE_URL;
  const apiPath = process.env.NINJA_API_PATH || "/pets";
  const apiKey = process.env.NINJA_API_KEY;

  if (!baseUrl) {
    return { enabled: false, source: "disabled", records: [] };
  }

  const requestUrl = `${baseUrl.replace(/\/$/, "")}/${apiPath.replace(/^\//, "")}`;
  const headers = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`ninja_api_http_${response.status}`);
    }

    const payload = await response.json();
    const records = extractRecords(payload).map(toPetRecord);

    return {
      enabled: true,
      source: requestUrl,
      records
    };
  } catch (error) {
    return {
      enabled: true,
      source: requestUrl,
      records: [],
      error: error?.name === "AbortError" ? "timeout" : error?.message || "request_failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}
