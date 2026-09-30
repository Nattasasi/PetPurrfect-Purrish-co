import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../apps/web/src/auth/AuthProvider.js";
import { customerAuthError } from "../apps/web/src/lib/customerAuth.js";

const account = Object.freeze({ uid: "customer-1", email: "pet@example.test", emailVerified: false });

async function renderAuth(t, service, { strict = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://customer.test/" });
  const originals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  }
  let auth;
  function Consumer() {
    auth = useAuth();
    return createElement("p", null, "Public quiz remains available");
  }
  const root = createRoot(document.getElementById("root"));
  let tree = createElement(AuthProvider, { service }, createElement(Consumer));
  if (strict) tree = createElement(React.StrictMode, null, tree);
  await act(async () => root.render(tree));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    }
  });
  return { get auth() { return auth; }, root, dom };
}

function fakeService(overrides = {}) {
  const subscriptions = [];
  return {
    subscriptions,
    subscribe(onChange, onError) {
      const subscription = { onChange, onError, stopped: false };
      subscriptions.push(subscription);
      return () => { subscription.stopped = true; };
    },
    ...overrides
  };
}

test("public children render while session restores and after authentication fails", async (t) => {
  const service = fakeService();
  const view = await renderAuth(t, service);
  assert.equal(view.auth.loading, true);
  assert.match(document.body.textContent, /Public quiz remains available/);
  await act(async () => service.subscriptions[0].onChange(account));
  assert.equal(view.auth.user, account);
  assert.equal(view.auth.loading, false);
  await act(async () => service.subscriptions[0].onError({ code: "auth/network-request-failed" }));
  assert.equal(view.auth.user, null);
  assert.equal(view.auth.loading, false);
  assert.match(view.auth.error.message, /connection/);
  assert.match(document.body.textContent, /Public quiz remains available/);
});

test("an initialization failure leaves public features usable", async (t) => {
  const view = await renderAuth(t, { subscribe() { throw new Error("internal configuration detail"); } });
  assert.equal(view.auth.loading, false);
  assert.equal(view.auth.error.code, "auth/unavailable");
  assert.doesNotMatch(view.auth.error.message, /internal configuration/);
  assert.match(document.body.textContent, /Public quiz remains available/);
});

test("StrictMode cleans up subscriptions and ignores callbacks from previous mounts", async (t) => {
  const service = fakeService();
  const view = await renderAuth(t, service, { strict: true });
  assert.equal(service.subscriptions.length, 2);
  assert.equal(service.subscriptions[0].stopped, true);
  assert.equal(service.subscriptions[1].stopped, false);
  await act(async () => service.subscriptions[1].onChange(account));
  await act(async () => service.subscriptions[0].onChange(null));
  assert.equal(view.auth.user, account);
  await act(async () => view.root.unmount());
  assert.equal(service.subscriptions[1].stopped, true);
});

test("duplicate account actions are blocked; failed sign-in resets pending and allows retry", async (t) => {
  let rejectSignIn;
  let calls = 0;
  const service = fakeService({ signIn: () => {
    calls += 1;
    return new Promise((_resolve, reject) => { rejectSignIn = reject; });
  } });
  const view = await renderAuth(t, service);
  await act(async () => service.subscriptions[0].onChange(null));
  let rejected;
  await act(async () => {
    rejected = assert.rejects(view.auth.signIn({ email: "pet@example.test", password: "incorrect" }), { code: "auth/invalid-credential" });
  });
  assert.equal(view.auth.pending, true);
  await assert.rejects(view.auth.signIn({ email: "pet@example.test", password: "incorrect" }), { code: "auth/operation-in-progress" });
  assert.equal(calls, 1);
  await act(async () => {
    rejectSignIn({ code: "auth/invalid-credential", message: "raw server details" });
    await rejected;
  });
  assert.equal(view.auth.pending, false);
  assert.equal(view.auth.error.message, "The email or password is incorrect.");
  service.signIn = async () => {
    service.subscriptions[0].onChange(account);
    return account;
  };
  await act(async () => assert.equal(await view.auth.signIn({ email: account.email, password: "valid-password" }), account));
  assert.equal(view.auth.error, null);
  assert.equal(view.auth.user, account);
});

test("sign-out updates the shared session and token access does not clear form errors", async (t) => {
  const service = fakeService({
    signOut: async () => service.subscriptions[0].onChange(null),
    sendPasswordReset: async () => { throw { code: "auth/network-request-failed" }; },
    getIdToken: async () => "test-token"
  });
  const view = await renderAuth(t, service);
  await act(async () => service.subscriptions[0].onChange(account));
  await act(async () => assert.rejects(view.auth.sendPasswordReset(account.email), { code: "auth/network-request-failed" }));
  const previousError = view.auth.error;
  assert.equal(await view.auth.getIdToken(), "test-token");
  assert.equal(view.auth.error, previousError);
  await act(async () => view.auth.signOut());
  assert.equal(view.auth.user, null);
  assert.equal(view.auth.error, null);
  assert.equal(view.auth.pending, false);
});

test("error messages hide raw provider details and use consistent invalid-login wording", () => {
  assert.equal(customerAuthError({ code: "auth/user-not-found" }).message, customerAuthError({ code: "auth/wrong-password" }).message);
  assert.doesNotMatch(customerAuthError({ message: "secret provider detail" }).message, /secret/);
});
