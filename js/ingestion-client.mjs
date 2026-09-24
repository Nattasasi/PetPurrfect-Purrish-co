// Shared by static pages and React. No Firebase credentials or customer data
// belong in analytics payloads. Production requests stay on the Hosting origin.
const localStatic = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
  && ["5500", "8000"].includes(globalThis.location?.port);
export const API_BASE = localStatic ? "http://localhost:3001" : "";

export function newEventId() {
  return crypto.randomUUID();
}

export async function ingest(path, payload, { keepalive = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE}/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error(response.status === 429
        ? "Too many attempts. Please wait before trying again."
        : "Could not save. Please try again.");
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function trackEvent(type, eventId) {
  try {
    const payload = { type, eventId: eventId || newEventId() };
    // A retry always reuses its ID. The server's atomic create is authoritative.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await ingest("analytics/events", payload, { keepalive: true });
        return result?.recorded === true;
      } catch (error) {
        if (error.status && error.status < 500) return false;
      }
    }
  } catch { /* Analytics must never interrupt a customer action. */ }
  return false;
}

const SESSION_KEY = "purrishco.analytics.browser-session.v1";
let sessionFlight;
function trackBrowserSession() {
  if (sessionFlight) return sessionFlight;
  try {
    let eventId = sessionStorage.getItem(SESSION_KEY);
    if (!eventId) {
      eventId = newEventId();
      sessionStorage.setItem(SESSION_KEY, eventId);
    }
    if (sessionStorage.getItem(`${SESSION_KEY}.saved`) === eventId) return;
    sessionFlight = trackEvent("browser_session", eventId).then((saved) => {
      if (saved) {
        try { sessionStorage.setItem(`${SESSION_KEY}.saved`, eventId); } catch { /* optional */ }
      }
    }).finally(() => { sessionFlight = null; });
    return sessionFlight;
  } catch {
    // Skip when sessionStorage is unavailable rather than overcount every load.
  }
}

export function isShopeeLink(href, origin) {
  try {
    const url = new URL(href, origin);
    return url.protocol === "https:" && /(^|\.)shopee\.co\.th$/.test(url.hostname);
  } catch { return false; }
}

export function startCustomerTracking() {
  const isAdmin = () => /^\/admin(?:\/|$)/.test(location.pathname);
  if (!isAdmin()) void trackBrowserSession();
  const click = (event) => {
    if (isAdmin() || !event.isTrusted || event.defaultPrevented) return;
    if (event.type === "auxclick" && event.button !== 1) return;
    const anchor = event.target.closest?.("a[href]");
    if (anchor && isShopeeLink(anchor.href, location.origin)) {
      void trackEvent("shop_redirect");
    }
  };
  const online = () => { if (!isAdmin()) void trackBrowserSession(); };
  document.addEventListener("click", click);
  document.addEventListener("auxclick", click);
  window.addEventListener("online", online);
  return () => {
    document.removeEventListener("click", click);
    document.removeEventListener("auxclick", click);
    window.removeEventListener("online", online);
  };
}

export function validateMessage(fields) {
  if (fields.name.length < 2 || fields.name.length > 100) return "Name must be 2–100 characters.";
  if (fields.email.length < 5 || fields.email.length > 150
    || !/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(fields.email)) return "Enter a valid email address (up to 150 characters).";
  if (fields.subject.length > 150) return "Subject must be at most 150 characters.";
  if (fields.message.length < 1 || fields.message.length > 2000) return "Message must be 1–2000 characters.";
  return "";
}

async function contactSubmissionId(signature) {
  const id = newEventId();
  try {
    // Persist only a digest and random ID, not the message or contact details.
    // This also deduplicates retries after switching between the two forms.
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
    const digest = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const key = "purrishco.contact.submission.v1";
    const previous = JSON.parse(sessionStorage.getItem(key) || "null");
    if (previous?.digest === digest && typeof previous.id === "string") return previous.id;
    sessionStorage.setItem(key, JSON.stringify({ digest, id }));
  } catch { /* The mounted form still keeps an in-memory retry ID. */ }
  return id;
}

// Bind explicitly to the contact form; also used by React with effect cleanup.
export function connectContactForm(form) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  button.disabled = false;
  let pending = false;
  let submission = null;
  let alive = true;
  const handler = async (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const fields = Object.fromEntries(["name", "email", "subject", "message"]
      .map((key) => [key, String(new FormData(form).get(key) || "").trim()]));
    const error = validateMessage(fields);
    if (error) { status.textContent = error; return; }
    pending = true;
    button.disabled = true;
    const inputs = [...form.querySelectorAll("input, textarea")];
    inputs.forEach((input) => { input.disabled = true; });
    form.setAttribute("aria-busy", "true");
    status.textContent = "Sending…";
    const signature = JSON.stringify(fields);
    try {
      if (!submission || submission.signature !== signature) {
        submission = { signature, submissionId: await contactSubmissionId(signature) };
      }
      const result = await ingest("messages", { ...fields, submissionId: submission.submissionId });
      if (result?.saved !== true) throw new Error("Could not confirm the save. Please try again.");
      if (!alive) return;
      status.textContent = "Message sent successfully. Thank you!";
      form.reset();
      submission = null;
    } catch (error) {
      if (alive) status.textContent = error.message || "Could not save. Please try again.";
      // Preserve the ID for a retry after an ambiguous network failure.
    } finally {
      pending = false;
      if (alive) {
        button.disabled = false;
        inputs.forEach((input) => { input.disabled = false; });
        form.setAttribute("aria-busy", "false");
      }
    }
  };
  form.addEventListener("submit", handler);
  return () => { alive = false; form.removeEventListener("submit", handler); };
}
