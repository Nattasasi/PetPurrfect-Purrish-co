import { getFirestoreDb } from "../config/firebaseAdmin.js";
import { env } from "../config/env.js";

const VALID_PLATFORMS = new Set(["facebook", "x", "instagram", "native", "copy"]);

// Records that a user shared their result on a platform. This is the top of
// the acquisition funnel: share -> landing -> quiz start.
export async function recordShareEvent(payload = {}) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, recorded: false };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, recorded: false };

  const platform = VALID_PLATFORMS.has(payload.platform) ? payload.platform : "unknown";
  await db.collection(env.firebase.shareEventsCollection).add({
    type: "share",
    resultId: payload.resultId || null,
    platform,
    createdAt: new Date()
  });
  return { enabled: true, recorded: true, store: "firebase" };
}

// Records that a NEW visitor arrived via a shared link (utm_source present).
// Comparing landings vs shares per platform gives the viral coefficient.
export async function recordLandingEvent(payload = {}) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, recorded: false };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, recorded: false };

  await db.collection(env.firebase.shareEventsCollection).add({
    type: "landing",
    resultId: payload.resultId || null,
    utmSource: typeof payload.utmSource === "string" ? payload.utmSource.slice(0, 64) : null,
    utmMedium: typeof payload.utmMedium === "string" ? payload.utmMedium.slice(0, 64) : null,
    utmCampaign: typeof payload.utmCampaign === "string" ? payload.utmCampaign.slice(0, 64) : null,
    createdAt: new Date()
  });
  return { enabled: true, recorded: true, store: "firebase" };
}

// Per-platform funnel summary: shares, landings, and landing-per-share ratio.
export async function getShareAnalytics() {
  if (env.dataStore !== "firebase") {
    return { enabled: false, platforms: [], totals: { shares: 0, landings: 0 } };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, platforms: [], totals: { shares: 0, landings: 0 } };

  const snapshot = await db.collection(env.firebase.shareEventsCollection)
    .select("type", "platform", "utmSource")
    .get();
  const shares = new Map();
  const landings = new Map();
  let totalShares = 0;
  let totalLandings = 0;

  snapshot.forEach((item) => {
    const event = item.data();
    if (event.type === "share") {
      shares.set(event.platform, (shares.get(event.platform) || 0) + 1);
      totalShares += 1;
    }
    if (event.type === "landing") {
      landings.set(event.utmSource, (landings.get(event.utmSource) || 0) + 1);
      totalLandings += 1;
    }
  });

  const platforms = [...shares.entries()]
    .map(([platform, count]) => {
      const landingCount = landings.get(platform) || 0;
      return {
        platform,
        shares: count,
        landings: landingCount,
        landingRate: Number((landingCount / count).toFixed(3))
      };
    })
    .sort((a, b) => b.shares - a.shares);

  return {
    enabled: true,
    platforms,
    totals: { shares: totalShares, landings: totalLandings },
    store: "firebase"
  };
}
