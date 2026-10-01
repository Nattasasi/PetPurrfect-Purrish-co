import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { createCustomerAuth } from "../apps/web/src/lib/customerAuth.js";

test("customer authentication lifecycle uses only the local Firebase Auth emulator", async (t) => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assert.match(host || "", /^(127\.0\.0\.1|localhost):\d+$/, "Run with the local Auth emulator; never production.");
  const projectId = "demo-purrishco";
  const baseUrl = `http://${host}`;
  const config = { apiKey: "demo-api-key", projectId };
  const customerApp = initializeApp(config, `customer-test-${randomUUID()}`);
  const adminApp = initializeApp(config, `admin-test-${randomUUID()}`);
  t.after(async () => {
    await deleteApp(customerApp);
    await deleteApp(adminApp);
  });
  const customerAuth = initializeAuth(customerApp, { persistence: inMemoryPersistence });
  const adminAuth = initializeAuth(adminApp, { persistence: inMemoryPersistence });
  connectAuthEmulator(customerAuth, baseUrl, { disableWarnings: true });
  connectAuthEmulator(adminAuth, baseUrl, { disableWarnings: true });
  const customer = createCustomerAuth(customerAuth);
  const admin = createCustomerAuth(adminAuth);
  const email = `customer-${randomUUID()}@example.test`;
  const password = "  pet-password-123  ";
  const adminUser = await admin.signUp({ email: `admin-${randomUUID()}@example.test`, password });

  assert.equal(await customer.getIdToken(), null);
  await assert.rejects(customer.sendVerificationEmail(), { code: "auth/sign-in-required" });
  await assert.rejects(customer.signUp({ email: "", password }), { code: "auth/invalid-email" });
  await assert.rejects(customer.signUp({ email, password: "" }), { code: "auth/missing-password" });
  await assert.rejects(customer.signUp({ email, password: "short" }), { code: "auth/weak-password" });

  let latestUser;
  const unsubscribe = customer.subscribe((user) => { latestUser = user; });
  t.after(unsubscribe);
  const user = await customer.signUp({ email: ` ${email} `, password });
  assert.equal(user.email, email);
  assert.equal(user.emailVerified, false);
  assert.ok(Object.isFrozen(user));
  assert.deepEqual(Object.keys(user).sort(), ["displayName", "email", "emailVerified", "photoURL", "uid"]);
  assert.equal(adminAuth.currentUser.uid, adminUser.uid, "customer sign-up does not replace the admin session");
  await assert.rejects(customer.signUp({ email, password }), { code: "auth/email-already-in-use" });

  const token = await customer.getIdToken();
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  assert.equal(claims.sub, user.uid);
  assert.equal(claims.aud, projectId);
  assert.equal(claims.admin, undefined);
  assert.equal(claims.role, undefined);

  async function oobCode(requestType) {
    const response = await fetch(`${baseUrl}/emulator/v1/projects/${projectId}/oobCodes`);
    assert.equal(response.ok, true);
    const { oobCodes } = await response.json();
    const code = oobCodes.findLast((item) => item.email === email && item.requestType === requestType);
    assert.ok(code, `emulator recorded ${requestType}`);
    return code.oobCode;
  }
  async function applyCode(endpoint, body) {
    const response = await fetch(`${baseUrl}/identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=demo-api-key`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    assert.equal(response.ok, true, await response.text());
  }

  await customer.sendVerificationEmail();
  await applyCode("update", { oobCode: await oobCode("VERIFY_EMAIL") });
  const verifiedUser = await customer.refreshUser();
  assert.equal(verifiedUser.emailVerified, true);
  await new Promise(setImmediate);
  assert.equal(latestUser.emailVerified, true);

  await customer.signOut();
  assert.equal(await customer.getIdToken(), null);
  assert.equal(await customer.refreshUser(), null);
  assert.equal(adminAuth.currentUser.uid, adminUser.uid, "customer sign-out does not sign out the admin");
  await assert.rejects(customer.signIn({ email, password: "wrong-password" }));
  assert.equal((await customer.signIn({ email, password })).uid, user.uid);
  await customer.signOut();

  await customer.sendPasswordReset(email);
  await customer.sendPasswordReset(`unknown-${randomUUID()}@example.test`);
  const newPassword = "replacement-password-456";
  await applyCode("resetPassword", { oobCode: await oobCode("PASSWORD_RESET"), newPassword });
  await assert.rejects(customer.signIn({ email, password }));
  assert.equal((await customer.signIn({ email, password: newPassword })).uid, user.uid);
});
