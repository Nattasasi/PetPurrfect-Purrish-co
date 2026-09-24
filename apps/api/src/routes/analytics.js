import { Router } from "express";
import {
  saveAnalyticsEvent,
  getAnalyticsByEventType,
  getFunnelMetrics,
  getDeviceMetrics,
  getSessionMetrics
} from "../services/analyticsRepository.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

/**
 * POST /api/analytics/events
 * Track a generic analytics event with session and device context
 */
router.post("/events", async (req, res) => {
  try {
    const payload = {
      eventId: req.body?.eventId,
      eventType: req.body?.eventType,
      sessionId: req.body?.sessionId,
      timestamp: req.body?.timestamp,
      context: req.body?.context,
      properties: req.body?.properties
    };

    const result = await saveAnalyticsEvent(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      saved: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/events/:eventType
 * Get all events of a specific type
 */
router.get("/events/:eventType", requireAdmin, async (req, res) => {
  try {
    const eventType = req.params.eventType;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const result = await getAnalyticsByEventType(eventType, startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      events: [],
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/funnel
 * Get funnel conversion metrics (view → start → complete → share)
 */
router.get("/funnel", requireAdmin, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const result = await getFunnelMetrics(startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      funnel: {},
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/devices
 * Get device, browser, and OS breakdown
 */
router.get("/devices", requireAdmin, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const result = await getDeviceMetrics(startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      devices: {},
      browsers: {},
      os: {},
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/sessions
 * Get session-based metrics
 */
router.get("/sessions", requireAdmin, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const result = await getSessionMetrics(startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      enabled: false,
      sessions: 0,
      avgEventsPerSession: 0,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/overview
 * Get all analytics at once (funnel, device, session metrics)
 */
router.get("/overview", requireAdmin, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    const [funnelResult, deviceResult, sessionResult] = await Promise.all([
      getFunnelMetrics(startDate, endDate),
      getDeviceMetrics(startDate, endDate),
      getSessionMetrics(startDate, endDate)
    ]);

    res.json({
      funnel: funnelResult.funnel,
      devices: deviceResult.devices,
      browsers: deviceResult.browsers,
      os: deviceResult.os,
      sessions: sessionResult.sessions,
      totalEvents: sessionResult.totalEvents,
      avgEventsPerSession: sessionResult.avgEventsPerSession
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
