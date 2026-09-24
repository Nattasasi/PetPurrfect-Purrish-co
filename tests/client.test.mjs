import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startCustomerTracking, trackEvent, connectContactForm, isShopeeLink } from "../js/ingestion-client.mjs";

const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise(setImmediate); };
function browser(t, html = "", url = "https://site.test/") {
  const dom = new JSDOM(html, { url });
  for (const key of ["window", "document", "location", "sessionStorage", "FormData"]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  t.after(() => dom.window.close());
  return dom.window;
}

test("one session across React effect setup/cleanup, rerenders, static-to-React navigation and reload", async (t) => {
  const window = browser(t);
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ recorded: true }) };
  });
  let stop = startCustomerTracking();
  stop();
  stop = startCustomerTracking();
  await settle();
  stop();
  window.history.replaceState({}, "", "/quiz");
  stop = startCustomerTracking();
  await settle();
  stop();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, "browser_session");
  // A genuinely new session has empty sessionStorage.
  window.sessionStorage.clear();
  stop = startCustomerTracking();
  await settle();
  stop();
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].eventId, requests[1].eventId);
});

test("admin pages and unavailable sessionStorage do not emit visitor events", async (t) => {
  browser(t, "", "https://site.test/admin/login.html");
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  startCustomerTracking()();
  await settle();
  assert.equal(fetch.mock.callCount(), 0);
  window.history.replaceState({}, "", "/");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
  startCustomerTracking()();
  await settle();
  assert.equal(fetch.mock.callCount(), 0);
});

test("analytics retries reuse one ID, never throw, and send only type and ID", async (t) => {
  browser(t);
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    assert.equal(options.keepalive, true);
    if (requests.length === 1) throw new Error("offline");
    return { ok: true, json: async () => ({ recorded: true }) };
  });
  assert.equal(await trackEvent("sticker_generation"), true);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(Object.keys(requests[0]).sort(), ["eventId", "type"]);
});

test("Shopee matcher excludes lookalikes; delegated click keeps native navigation and ignores synthetic events", async (t) => {
  browser(t, '<a href="https://shopee.co.th/purrishandco">Shop</a>');
  assert.equal(isShopeeLink("https://shopee.co.th/shop"), true);
  for (const url of ["https://shopee.co.th.evil.test", "https://evil.test/shopee.co.th", "javascript:alert(1)"]) {
    assert.equal(isShopeeLink(url), false);
  }
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ recorded: true }) };
  });
  const original = document.addEventListener.bind(document);
  let click;
  t.mock.method(document, "addEventListener", (type, listener) => {
    if (type === "click") click = listener;
    original(type, listener);
  });
  const stop = startCustomerTracking();
  await settle();
  const event = { target: document.querySelector("a"), type: "click", isTrusted: false,
    preventDefault: () => assert.fail("must preserve navigation") };
  click(event);
  click({ ...event, isTrusted: true });
  await settle();
  stop();
  assert.equal(requests.filter((item) => item.type === "shop_redirect").length, 1);
});

const formHtml = `<form><input name="name" value="Test Visitor" required minlength="2" maxlength="100">
<input name="email" type="email" value="test@example.com" required maxlength="150">
<input name="subject" value="Hello"><textarea name="message" required>Hello there</textarea>
<button type="submit">Send</button><p role="status"></p></form>`;

test("contact form prevents duplicates, waits for save, locks fields, and retries the same submission after failure", async (t) => {
  const window = browser(t, formHtml);
  const form = document.querySelector("form");
  const status = form.querySelector('[role="status"]');
  const requests = [];
  let respond;
  t.mock.method(globalThis, "fetch", (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Promise((resolve) => { respond = resolve; });
  });
  const stop = connectContactForm(form);
  const submit = () => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  submit(); submit();
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(status.textContent, "Sending…");
  assert.equal(form.querySelector("button").disabled, true);
  assert.equal(form.querySelector("input").disabled, true);
  respond({ ok: false, status: 503 });
  await settle();
  assert.match(status.textContent, /Could not save/);
  assert.equal(form.querySelector("button").disabled, false);
  submit();
  await settle();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].submissionId, requests[1].submissionId);
  respond({ ok: true, json: async () => ({ saved: true }) });
  await settle();
  assert.match(status.textContent, /Message sent successfully/);
  stop();
});

test("contact retry after remount keeps its ID without storing contact details", async (t) => {
  const window = browser(t, formHtml);
  const form = document.querySelector("form");
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: false, status: 503 };
  });
  let stop = connectContactForm(form);
  form.dispatchEvent(new window.Event("submit", { cancelable: true }));
  await settle();
  stop();
  stop = connectContactForm(form);
  form.dispatchEvent(new window.Event("submit", { cancelable: true }));
  await settle();
  stop();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].submissionId, requests[1].submissionId);
  const stored = window.sessionStorage.getItem("purrishco.contact.submission.v1");
  assert.ok(!stored.includes("test@example.com"));
  assert.ok(!stored.includes("Hello"));
});

test("contact rejects whitespace and invalid email without sending or showing success", (t) => {
  const window = browser(t, formHtml);
  const form = document.querySelector("form");
  const fetch = t.mock.method(globalThis, "fetch", async () => assert.fail("invalid message sent"));
  const stop = connectContactForm(form);
  form.elements.name.value = "  ";
  form.dispatchEvent(new window.Event("submit", { cancelable: true }));
  assert.match(form.querySelector('[role="status"]').textContent, /Name must/);
  form.elements.name.value = "Valid Name";
  form.elements.email.value = "invalid";
  form.dispatchEvent(new window.Event("submit", { cancelable: true }));
  assert.equal(fetch.mock.callCount(), 0);
  stop();
});
