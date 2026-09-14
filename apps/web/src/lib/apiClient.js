const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function postJson(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(message);
  }

  return res.json();
}

export async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

const SESSION_ID_KEY = "purrishco.session.id";

export function createSessionId() {
  try {
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return id;
  } catch {
    return `session-${Date.now()}`;
  }
}

// Fetches a sanitized public quiz result for shared links (/quiz/result/:id).
// Returns null when the result no longer exists or persistence is disabled.
export async function getPublicQuizResult(id) {
  try {
    const res = await fetch(`${API_BASE}/api/quiz/results/${encodeURIComponent(id)}`);
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    return body?.result || null;
  } catch {
    return null;
  }
}

// Records that the current user shared their result on a platform. Never
// throws — analytics must not block the share action itself.
export async function trackShareEvent(resultId, platform) {
  if (!resultId) {
    return;
  }
  try {
    await fetch(`${API_BASE}/api/quiz/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId, platform })
    });
  } catch {
    // Ignore analytics failures.
  }
}

// Records that this session arrived via a shared link (UTM attribution).
export async function trackLandingEvent(payload) {
  try {
    await fetch(`${API_BASE}/api/quiz/landing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // Ignore analytics failures.
  }
}

export async function getShareAnalytics() {
  return getJson("/api/quiz/share/analytics");
}

export async function generateStickerCaptions(breed, attributes) {
  const response = await postJson("/api/sticker/caption", { breed, attributes });
  return Array.isArray(response.captions) ? response.captions : [];
}

// Debug-only helper: fetches a real breed photo so the quiz debug result
// doesn't have to rely on the static SVG placeholder.
export async function getDebugBreedImage(breed, petType) {
  try {
    const params = new URLSearchParams({ breed, petType });
    const body = await getJson(`/api/quiz/debug/breed-image?${params.toString()}`);
    return body?.imageUrl || null;
  } catch {
    return null;
  }
}

// Debug-only helper: persists the randomized debug result through the same
// backend save path a real quiz submission uses, instead of only rendering
// a client-side object.
export async function saveDebugQuizResult(payload) {
  return postJson("/api/quiz/debug/save-result", payload);
}

