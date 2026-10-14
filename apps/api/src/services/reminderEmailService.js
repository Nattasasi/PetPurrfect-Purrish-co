import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestoreDb } from "../config/firebaseAdmin.js";

const secret = () => process.env.UNSUBSCRIBE_SECRET || "";

export function unsubscribeToken(uid) {
  return createHmac("sha256", secret()).update(uid).digest("hex");
}

export function verifyUnsubscribe(uid, token) {
  if (!secret() || typeof uid !== "string" || typeof token !== "string") return false;
  const expected = Buffer.from(unsubscribeToken(uid));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function setEmailReminders(uid, enabled) {
  await getFirestoreDb().collection("users").doc(uid).set({ emailReminders: enabled, updatedAt: new Date() }, { merge: true });
}

export async function getEmailReminders(uid) {
  const snap = await getFirestoreDb().collection("users").doc(uid).get();
  return snap.get("emailReminders") !== false;
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function sendEmail({ to, subject, html, unsubscribeUrl }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to,
      subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` }
    })
  });
  if (!response.ok) throw new Error(`email_failed_${response.status}`);
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL && secret() && process.env.PUBLIC_API_URL);
}

// Sends one email per user for reminders due today or earlier, once per due date.
export async function sendDueReminders(today = new Date().toISOString().slice(0, 10)) {
  const db = getFirestoreDb();
  const snap = await db.collectionGroup("reminders").where("dueDate", "<=", today).get();
  const byUser = new Map();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.done || data.notifyEmail === false || data.lastSentDueDate === data.dueDate) continue;
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    byUser.set(uid, [...(byUser.get(uid) || []), { doc, data }]);
  }

  let sent = 0;
  let failed = 0;
  for (const [uid, items] of byUser) {
    try {
      if (!(await getEmailReminders(uid))) continue;
      const { email } = await getAuth().getUser(uid);
      if (!email) continue;
      const pets = new Map();
      await Promise.all([...new Set(items.map((item) => item.data.petId))].map(async (petId) => {
        const pet = await db.collection("users").doc(uid).collection("pets").doc(petId).get();
        pets.set(petId, pet.get("name") || "your pet");
      }));
      const unsubscribeUrl = `${process.env.PUBLIC_API_URL}/api/email/unsubscribe?uid=${encodeURIComponent(uid)}&token=${unsubscribeToken(uid)}`;
      const list = items
        .map(({ data }) => `<li>${escapeHtml(data.title)} for ${escapeHtml(pets.get(data.petId))} (due ${escapeHtml(data.dueDate)})</li>`)
        .join("");
      await sendEmail({
        to: email,
        subject: "Pet care reminders from Purrish&Co.",
        html: `<p>These reminders are due:</p><ul>${list}</ul><p><a href="${unsubscribeUrl}">Unsubscribe from reminder emails</a></p>`,
        unsubscribeUrl
      });
      await Promise.all(items.map(({ doc, data }) => doc.ref.update({ lastSentDueDate: data.dueDate })));
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
