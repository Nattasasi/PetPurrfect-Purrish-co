import test from "node:test";
import assert from "node:assert/strict";
import { unsubscribeToken, verifyUnsubscribe } from "../src/services/reminderEmailService.js";

process.env.UNSUBSCRIBE_SECRET = "test-secret";

test("unsubscribe tokens verify only for the matching user", () => {
  const token = unsubscribeToken("user-1");
  assert.equal(verifyUnsubscribe("user-1", token), true);
  assert.equal(verifyUnsubscribe("user-2", token), false);
  assert.equal(verifyUnsubscribe("user-1", "bad"), false);
});

test("unsubscribe is rejected when no secret is configured", () => {
  const token = unsubscribeToken("user-1");
  delete process.env.UNSUBSCRIBE_SECRET;
  assert.equal(verifyUnsubscribe("user-1", token), false);
  process.env.UNSUBSCRIBE_SECRET = "test-secret";
});
