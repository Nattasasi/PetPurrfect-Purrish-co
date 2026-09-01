const DEFAULT_TIMEOUT_MS = 5000;

async function fetchJson(url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

let dogBreedListCache = null;

async function getDogBreedList() {
  if (!dogBreedListCache) {
    const data = await fetchJson("https://dog.ceo/api/breeds/list/all");
    dogBreedListCache = data?.message || {};
  }
  return dogBreedListCache;
}

// Dog CEO breed slugs don't follow a fixed word order (e.g. "Golden Retriever" ->
// retriever/golden, but "Shiba Inu" -> shiba, no sub-breed), so look up which word
// is the actual breed key instead of guessing by position.
async function resolveDogSlug(breedName) {
  const words = breedName.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }

  const breedList = await getDogBreedList();

  for (let i = 0; i < words.length; i++) {
    const candidateBreed = words[i];
    if (!(candidateBreed in breedList)) {
      continue;
    }

    const subBreeds = breedList[candidateBreed] || [];
    const remaining = words.filter((_, index) => index !== i);
    const matchedSub = remaining.find((word) => subBreeds.includes(word));

    return { breed: candidateBreed, subBreed: matchedSub || null };
  }

  return { breed: words[words.length - 1], subBreed: null };
}

async function fetchDogImage(breedName) {
  const slug = await resolveDogSlug(breedName);
  if (!slug) {
    return null;
  }

  if (slug.subBreed) {
    const withSubBreed = await fetchJson(`https://dog.ceo/api/breed/${slug.breed}/${slug.subBreed}/images/random`);
    if (withSubBreed?.status === "success") {
      return withSubBreed.message;
    }
  }

  const breedOnly = await fetchJson(`https://dog.ceo/api/breed/${slug.breed}/images/random`);
  return breedOnly?.status === "success" ? breedOnly.message : null;
}

async function fetchCatImage(breedName) {
  const apiKey = process.env.CAT_API_KEY;
  if (!apiKey) {
    return null;
  }

  const headers = { "x-api-key": apiKey };
  const searchUrl = `https://api.thecatapi.com/v1/breeds/search?q=${encodeURIComponent(breedName)}`;
  const breeds = await fetchJson(searchUrl, headers);
  const match = Array.isArray(breeds) ? breeds[0] : null;

  return match?.image?.url || (match?.reference_image_id ? `https://cdn2.thecatapi.com/images/${match.reference_image_id}.jpg` : null);
}

export async function fetchBreedImageUrl(breedName, petType) {
  if (!breedName) {
    return null;
  }

  if (petType === "cat") {
    return fetchCatImage(breedName);
  }

  return fetchDogImage(breedName);
}
