import { getMongoDb } from "../config/mongo.js";

const collectionName = () =>
  process.env.MONGODB_SHARE_EVENTS_COLLECTION || "share_events";

const VALID_PLATFORMS = new Set(["facebook", "x", "instagram", "native", "copy"]);

// Records that a user shared their result on a platform. This is the top of
// the acquisition funnel: share -> landing -> quiz start.
export async function recordShareEvent(payload = {}) {
  const db = await getMongoDb();

  if (!db) {
    return { enabled: false, recorded: false };
  }

  const platform = VALID_PLATFORMS.has(payload.platform) ? payload.platform : "unknown";

  await db.collection(collectionName()).insertOne({
    type: "share",
    resultId: payload.resultId || null,
    platform,
    createdAt: new Date()
  });

  return { enabled: true, recorded: true };
}

// Records that a NEW visitor arrived via a shared link (utm_source present).
// Comparing landings vs shares per platform gives the viral coefficient.
export async function recordLandingEvent(payload = {}) {
  const db = await getMongoDb();

  if (!db) {
    return { enabled: false, recorded: false };
  }

  await db.collection(collectionName()).insertOne({
    type: "landing",
    resultId: payload.resultId || null,
    utmSource: typeof payload.utmSource === "string" ? payload.utmSource.slice(0, 64) : null,
    utmMedium: typeof payload.utmMedium === "string" ? payload.utmMedium.slice(0, 64) : null,
    utmCampaign: typeof payload.utmCampaign === "string" ? payload.utmCampaign.slice(0, 64) : null,
    createdAt: new Date()
  });

  return { enabled: true, recorded: true };
}

// Per-platform funnel summary: shares, landings, and landing-per-share ratio.
export async function getShareAnalytics() {
  const db = await getMongoDb();

  if (!db) {
    return { enabled: false, platforms: [], totals: { shares: 0, landings: 0 } };
  }

  const sharesByPlatform = await db
    .collection(collectionName())
    .aggregate([
      { $match: { type: "share" } },
      { $group: { _id: "$platform", count: { $sum: 1 } } }
    ])
    .toArray();

  const landingsBySource = await db
    .collection(collectionName())
    .aggregate([
      { $match: { type: "landing" } },
      { $group: { _id: "$utmSource", count: { $sum: 1 } } }
    ])
    .toArray();

  const landingMap = new Map(landingsBySource.map((row) => [row._id, row.count]));
  const platforms = sharesByPlatform
    .map((row) => {
      // utm_source matches the platform label for the three web intents;
      // "copy" landings arrive with utm_source=copy.
      const landings = landingMap.get(row._id) || 0;
      return {
        platform: row._id,
        shares: row.count,
        landings,
        landingRate: row.count > 0 ? Number((landings / row.count).toFixed(3)) : 0
      };
    })
    .sort((a, b) => b.shares - a.shares);

  const totals = {
    shares: sharesByPlatform.reduce((sum, row) => sum + row.count, 0),
    landings: landingsBySource.reduce((sum, row) => sum + row.count, 0)
  };

  return { enabled: true, platforms, totals };
}
