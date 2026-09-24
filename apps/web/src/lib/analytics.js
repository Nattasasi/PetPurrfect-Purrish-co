/**
 * Modern business analytics library - session-based (no user sign-in required)
 * Provides:
 * - Session ID generation and persistence
 * - Device/context detection
 * - Standardized event schema
 * - Funnel event tracking
 */

const SESSION_ID_KEY = "purrishco.session.id";
const SESSION_CREATED_KEY = "purrishco.session.created";

/**
 * Get or create a session ID (stored in localStorage, persists across pages)
 */
export function getSessionId() {
  try {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(SESSION_ID_KEY, sessionId);
      localStorage.setItem(SESSION_CREATED_KEY, new Date().toISOString());
    }
    return sessionId;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * Get session creation time
 */
export function getSessionCreatedAt() {
  try {
    return localStorage.getItem(SESSION_CREATED_KEY) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Detect device and browser context
 */
export function getDeviceContext() {
  const ua = navigator.userAgent.toLowerCase();
  
  // Device type detection
  let deviceType = "desktop";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua)) {
    deviceType = /iphone|ipod|ipad/.test(ua) ? "ios" : "android";
  }

  // Browser detection
  let browser = "unknown";
  if (/edg/.test(ua)) browser = "edge";
  else if (/chrome/.test(ua)) browser = "chrome";
  else if (/safari/.test(ua)) browser = "safari";
  else if (/firefox/.test(ua)) browser = "firefox";

  // OS detection
  let os = "unknown";
  if (/windows/.test(ua)) os = "windows";
  else if (/macintosh|mac os x/.test(ua)) os = "macos";
  else if (/linux/.test(ua)) os = "linux";
  else if (/iphone|ipod|ipad/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";

  return {
    deviceType,
    browser,
    os,
    userAgent: ua
  };
}

/**
 * Build standardized event payload
 * @param {string} eventType - Type of event (view_quiz, start_quiz, complete_quiz, share_result, etc.)
 * @param {object} properties - Custom event-specific properties
 * @returns {object} Standardized event payload
 */
export function buildEventPayload(eventType, properties = {}) {
  return {
    eventId: crypto.randomUUID?.() || `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
    context: getDeviceContext(),
    properties: {
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || null,
      currentUrl: window.location.href,
      ...properties
    }
  };
}

/**
 * Track a generic event
 * @param {string} eventType - Type of event
 * @param {object} properties - Event-specific properties
 */
export async function trackEvent(eventType, properties = {}) {
  try {
    const payload = buildEventPayload(eventType, properties);
    // Relative path (matches apiClient.js) so Firebase Hosting's /api rewrite
    // reaches the production API even when VITE_API_BASE_URL isn't set at build
    // time. A localhost fallback here would silently break tracking in prod.
    await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    // Silently fail - analytics should never block user experience
    console.debug("Analytics tracking failed:", error);
  }
}

/**
 * Funnel event: User viewed quiz page
 */
export function trackViewQuiz(quizType = "breed") {
  return trackEvent("view_quiz", { quizType });
}

/**
 * Funnel event: User started quiz (answered first question)
 */
export function trackStartQuiz(quizType = "breed") {
  return trackEvent("start_quiz", { quizType });
}

/**
 * Funnel event: User completed quiz
 */
export function trackCompleteQuiz(resultId, matchName, confidence, quizType = "breed") {
  return trackEvent("complete_quiz", {
    resultId,
    matchName,
    confidence,
    quizType
  });
}

/**
 * Funnel event: User viewed result
 */
export function trackViewResult(resultId, matchName) {
  return trackEvent("view_result", {
    resultId,
    matchName
  });
}

/**
 * Funnel event: User shared result
 */
export function trackShareResult(resultId, platform, matchName = null) {
  return trackEvent("share_result", {
    resultId,
    platform,
    matchName
  });
}

/**
 * Funnel event: User generated sticker
 */
export function trackStickerGeneration(breed, imageUrl = null) {
  return trackEvent("sticker_generation", {
    breed,
    hasImage: !!imageUrl
  });
}

/**
 * Funnel event: User viewed shared link (landing)
 */
export function trackLanding(resultId = null, utmSource = null, utmMedium = null, utmCampaign = null) {
  return trackEvent("landing", {
    resultId,
    utmSource,
    utmMedium,
    utmCampaign,
    source: utmSource || "direct"
  });
}

/**
 * Get current session analytics data
 */
export function getSessionAnalytics() {
  return {
    sessionId: getSessionId(),
    createdAt: getSessionCreatedAt(),
    context: getDeviceContext(),
    currentUrl: window.location.href,
    referrer: document.referrer
  };
}

/**
 * Clear session (logout equivalent for anonymous users)
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(SESSION_CREATED_KEY);
  } catch {
    // Silently fail
  }
}
