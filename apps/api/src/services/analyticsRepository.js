import { getFirestoreDb } from "../config/firebaseAdmin.js";
import { env } from "../config/env.js";

/**
 * Save a standardized analytics event to Firestore
 * Includes session, device context, and event properties
 */
export async function saveAnalyticsEvent(payload = {}) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, saved: false };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, saved: false };

  // Validate required fields
  if (!payload.eventId || !payload.eventType || !payload.sessionId) {
    return { enabled: false, saved: false, reason: "missing_required_fields" };
  }

  const doc = {
    eventId: payload.eventId,
    eventType: payload.eventType,
    sessionId: payload.sessionId,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    context: {
      deviceType: payload.context?.deviceType || "unknown",
      browser: payload.context?.browser || "unknown",
      os: payload.context?.os || "unknown",
      locale: payload.context?.locale || payload.properties?.locale || "unknown"
    },
    properties: payload.properties || {},
    createdAt: new Date()
  };

  try {
    const result = await db.collection(env.firebase.analyticsEventsCollection || "analytics_events").add(doc);
    return { enabled: true, saved: true, id: result.id };
  } catch (error) {
    console.error("Failed to save analytics event:", error);
    return { enabled: true, saved: false, error: error.message };
  }
}

/**
 * Get analytics by event type and time range
 */
export async function getAnalyticsByEventType(eventType, startDate = null, endDate = null) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, events: [] };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, events: [] };

  let query = db.collection(env.firebase.analyticsEventsCollection || "analytics_events")
    .where("eventType", "==", eventType);

  if (startDate) {
    query = query.where("timestamp", ">=", startDate);
  }
  if (endDate) {
    query = query.where("timestamp", "<=", endDate);
  }

  try {
    const snapshot = await query.limit(1000).get();
    const events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { enabled: true, events, count: events.length };
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return { enabled: true, events: [], error: error.message };
  }
}

/**
 * Get funnel metrics: conversion from view → start → complete
 */
export async function getFunnelMetrics(startDate = null, endDate = null) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, funnel: {} };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, funnel: {} };

  try {
    const baseQuery = db.collection(env.firebase.analyticsEventsCollection || "analytics_events");
    
    const getEventCount = async (eventType) => {
      let query = baseQuery.where("eventType", "==", eventType);
      if (startDate) query = query.where("timestamp", ">=", startDate);
      if (endDate) query = query.where("timestamp", "<=", endDate);
      const snapshot = await query.count().get();
      return snapshot.data().count;
    };

    const viewQuiz = await getEventCount("view_quiz");
    const startQuiz = await getEventCount("start_quiz");
    const completeQuiz = await getEventCount("complete_quiz");
    const shareResult = await getEventCount("share_result");

    return {
      enabled: true,
      funnel: {
        view_quiz: viewQuiz,
        start_quiz: startQuiz,
        start_to_view: viewQuiz > 0 ? ((startQuiz / viewQuiz) * 100).toFixed(2) : 0,
        complete_quiz: completeQuiz,
        complete_to_start: startQuiz > 0 ? ((completeQuiz / startQuiz) * 100).toFixed(2) : 0,
        share_result: shareResult,
        share_to_complete: completeQuiz > 0 ? ((shareResult / completeQuiz) * 100).toFixed(2) : 0
      }
    };
  } catch (error) {
    console.error("Failed to calculate funnel metrics:", error);
    return { enabled: true, funnel: {}, error: error.message };
  }
}

/**
 * Get device/browser breakdowns
 */
export async function getDeviceMetrics(startDate = null, endDate = null) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, devices: {}, browsers: {}, os: {} };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, devices: {}, browsers: {}, os: {} };

  try {
    let query = db.collection(env.firebase.analyticsEventsCollection || "analytics_events");
    if (startDate) query = query.where("timestamp", ">=", startDate);
    if (endDate) query = query.where("timestamp", "<=", endDate);

    const snapshot = await query.limit(10000).get();
    const events = snapshot.docs.map(doc => doc.data());

    // Aggregate by device type, browser, OS
    const devices = {};
    const browsers = {};
    const os = {};

    events.forEach(event => {
      const ctx = event.context || {};
      devices[ctx.deviceType || "unknown"] = (devices[ctx.deviceType || "unknown"] || 0) + 1;
      browsers[ctx.browser || "unknown"] = (browsers[ctx.browser || "unknown"] || 0) + 1;
      os[ctx.os || "unknown"] = (os[ctx.os || "unknown"] || 0) + 1;
    });

    return { enabled: true, devices, browsers, os, totalEvents: events.length };
  } catch (error) {
    console.error("Failed to calculate device metrics:", error);
    return { enabled: true, devices: {}, browsers: {}, os: {}, error: error.message };
  }
}

/**
 * Get session-based metrics
 */
export async function getSessionMetrics(startDate = null, endDate = null) {
  if (env.dataStore !== "firebase") {
    return { enabled: false, sessions: 0, avgEventsPerSession: 0 };
  }

  const db = getFirestoreDb();
  if (!db) return { enabled: false, sessions: 0, avgEventsPerSession: 0 };

  try {
    let query = db.collection(env.firebase.analyticsEventsCollection || "analytics_events");
    if (startDate) query = query.where("timestamp", ">=", startDate);
    if (endDate) query = query.where("timestamp", "<=", endDate);

    const snapshot = await query.limit(100000).get();
    const events = snapshot.docs.map(doc => doc.data());

    // Count unique sessions
    const sessionIds = new Set(events.map(e => e.sessionId));
    const uniqueSessions = sessionIds.size;
    const avgEventsPerSession = events.length > 0 ? (events.length / uniqueSessions).toFixed(2) : 0;

    return {
      enabled: true,
      sessions: uniqueSessions,
      totalEvents: events.length,
      avgEventsPerSession
    };
  } catch (error) {
    console.error("Failed to calculate session metrics:", error);
    return { enabled: true, sessions: 0, avgEventsPerSession: 0, error: error.message };
  }
}
