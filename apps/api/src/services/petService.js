import { randomUUID } from "node:crypto";
import { getFirestoreDb } from "../config/firebaseAdmin.js";
import { getQuizProfiles } from "./breedProfileService.js";

const SPECIES = ["dog", "cat"];
const REMINDER_TYPES = ["vaccine", "vet", "grooming", "flea_tick", "deworming", "medication", "custom"];
const REPEATS = ["none", "monthly", "yearly"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PETS = 10;
const MAX_REMINDERS = 100;

class ValidationError extends Error {}
export const isValidationError = (error) => error instanceof ValidationError;

function fail(message) {
  throw new ValidationError(message);
}

function db() {
  const instance = getFirestoreDb();
  if (!instance) throw new Error("storage_unavailable");
  return instance;
}

const petsRef = (uid) => db().collection("users").doc(uid).collection("pets");
const remindersRef = (uid) => db().collection("users").doc(uid).collection("reminders");

function cleanText(value, max, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} is required`);
  return value.trim().slice(0, max);
}

function cleanDate(value, label, required) {
  if (value === null || value === undefined || value === "") {
    if (required) fail(`${label} is required`);
    return null;
  }
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) fail(`${label} must be YYYY-MM-DD`);
  return value;
}

async function validatePet(body) {
  const species = body?.species;
  if (!SPECIES.includes(species)) fail("species must be dog or cat");
  let breedId = null;
  if (body.breedId) {
    const { breeds } = await getQuizProfiles();
    const breed = breeds.find((item) => item.id === body.breedId);
    if (!breed || breed.petType !== species) fail("breed does not match species");
    breedId = breed.id;
  }
  let weightKg = null;
  if (body.weightKg !== null && body.weightKg !== undefined && body.weightKg !== "") {
    weightKg = Number(body.weightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 150) fail("weightKg is invalid");
  }
  const birthDate = cleanDate(body.birthDate, "birthDate", false);
  if (birthDate && Date.parse(birthDate) > Date.now()) fail("birthDate cannot be in the future");
  return { name: cleanText(body.name, 60, "name"), species, breedId, birthDate, weightKg };
}

function validateReminder(body) {
  if (!REMINDER_TYPES.includes(body?.type)) fail("invalid reminder type");
  const repeat = body.repeat ?? "none";
  if (!REPEATS.includes(repeat)) fail("invalid repeat");
  return {
    petId: cleanText(body.petId, 64, "petId"),
    type: body.type,
    title: cleanText(body.title, 100, "title"),
    dueDate: cleanDate(body.dueDate, "dueDate", true),
    repeat,
    notifyEmail: body.notifyEmail !== false,
    done: false
  };
}

const withId = (doc) => ({ id: doc.id, ...doc.data() });

export async function listPets(uid) {
  const snap = await petsRef(uid).limit(MAX_PETS).get();
  return snap.docs.map(withId);
}

export async function createPet(uid, body) {
  const data = await validatePet(body);
  if ((await petsRef(uid).limit(MAX_PETS).get()).size >= MAX_PETS) fail("pet limit reached");
  const ref = petsRef(uid).doc(randomUUID());
  await ref.set({ ...data, createdAt: new Date() });
  return { id: ref.id, ...data };
}

export async function updatePet(uid, id, body) {
  const ref = petsRef(uid).doc(id);
  if (!(await ref.get()).exists) return null;
  const data = await validatePet(body);
  await ref.update({ ...data, updatedAt: new Date() });
  return { id, ...data };
}

export async function deletePet(uid, id) {
  const ref = petsRef(uid).doc(id);
  if (!(await ref.get()).exists) return false;
  const linked = await remindersRef(uid).where("petId", "==", id).get();
  const batch = db().batch();
  linked.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();
  return true;
}

export async function listReminders(uid) {
  const snap = await remindersRef(uid).limit(MAX_REMINDERS).get();
  return snap.docs.map(withId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function createReminder(uid, body) {
  const data = validateReminder(body);
  if (!(await petsRef(uid).doc(data.petId).get()).exists) fail("pet not found");
  if ((await remindersRef(uid).limit(MAX_REMINDERS).get()).size >= MAX_REMINDERS) fail("reminder limit reached");
  const ref = remindersRef(uid).doc(randomUUID());
  await ref.set({ ...data, createdAt: new Date() });
  return { id: ref.id, ...data };
}

function addInterval(date, repeat) {
  const next = new Date(`${date}T00:00:00Z`);
  if (repeat === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

// Marking a repeating reminder done rolls it to the next due date instead of closing it.
export async function completeReminder(uid, id) {
  const ref = remindersRef(uid).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const { repeat, dueDate } = snap.data();
  const update = repeat === "none" ? { done: true } : { dueDate: addInterval(dueDate, repeat), lastSentAt: null };
  await ref.update(update);
  return { id, ...snap.data(), ...update };
}

export async function deleteReminder(uid, id) {
  const ref = remindersRef(uid).doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.delete();
  return true;
}

export function lifeStage(birthDate, species) {
  if (!birthDate) return "adult";
  const years = (Date.now() - Date.parse(birthDate)) / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return species === "dog" ? "puppy" : "kitten";
  return years >= (species === "dog" ? 7 : 10) ? "senior" : "adult";
}

function inDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// General guidance only; not veterinary advice.
const STAGE_PRESETS = {
  puppy: [
    { type: "vaccine", title: "Puppy vaccine booster", repeat: "monthly", days: 14 },
    { type: "deworming", title: "Deworming", repeat: "monthly", days: 14 }
  ],
  kitten: [
    { type: "vaccine", title: "Kitten vaccine booster", repeat: "monthly", days: 14 },
    { type: "deworming", title: "Deworming", repeat: "monthly", days: 14 }
  ],
  adult: [{ type: "vaccine", title: "Annual vaccines", repeat: "yearly", days: 30 }],
  senior: [
    { type: "vet", title: "Senior health check-up", repeat: "yearly", days: 30 },
    { type: "vaccine", title: "Annual vaccines", repeat: "yearly", days: 30 }
  ]
};

export function reminderPresets(pet) {
  const stage = lifeStage(pet.birthDate, pet.species);
  const presets = [...STAGE_PRESETS[stage], { type: "flea_tick", title: "Flea and tick prevention", repeat: "monthly", days: 30 }];
  return presets.map(({ days, ...preset }) => ({ ...preset, dueDate: inDays(days) }));
}

export async function suggestionsForPet(pet) {
  const stage = lifeStage(pet.birthDate, pet.species);
  const cards = [];
  const breed = pet.breedId ? (await getQuizProfiles()).breeds.find((item) => item.id === pet.breedId) : null;
  const info = breed?.breedInfo;

  if (info?.exerciseMinutesDaily) {
    cards.push({ id: "exercise", category: "Exercise", title: "Daily exercise", body: `${breed.name}s typically need about ${Math.round(info.exerciseMinutesDaily)} minutes of activity a day.` });
  }
  if (info?.groomingHoursMonthly) {
    cards.push({
      id: "grooming",
      category: "Grooming",
      title: "Grooming routine",
      body: `Plan for roughly ${Number(info.groomingHoursMonthly).toFixed(1)} hours of grooming a month.`,
      reminder: { type: "grooming", title: `Groom ${pet.name}`, repeat: "monthly", dueDate: inDays(14) }
    });
  }
  (info?.careConsiderations || []).slice(0, 3).forEach((item, index) => {
    cards.push({ id: `care-${index}`, category: item.category, title: item.category, body: item.text });
  });
  if (stage === "puppy" || stage === "kitten") {
    cards.push({ id: "stage", category: "Life stage", title: "Growing up", body: "Young pets need a vaccine series and regular deworming. Ask your vet for a schedule." });
  } else if (stage === "senior") {
    cards.push({ id: "stage", category: "Life stage", title: "Senior care", body: "Twice-yearly check-ups help catch joint, dental and weight changes early." });
  }
  if (!breed) {
    cards.push({ id: "breed", category: "Breed", title: "Add a breed", body: "Choose a breed on this pet to get breed-specific care tips." });
  }
  return cards;
}

const stickersRef = (uid) => db().collection("users").doc(uid).collection("stickers");
const MAX_STICKERS = 50;

export async function listStickers(uid) {
  const snap = await stickersRef(uid).limit(MAX_STICKERS).get();
  return snap.docs
    .map((doc) => {
      const { createdAt, ...rest } = doc.data();
      return { id: doc.id, ...rest, createdAt: createdAt?.toDate?.().toISOString?.() || null };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// The image itself is uploaded to Storage by the client; only its path is trusted here.
export async function createSticker(uid, body) {
  const id = randomUUID();
  const storagePath = cleanText(body?.storagePath, 200, "storagePath");
  if (!new RegExp(`^users/${uid}/stickers/[A-Za-z0-9._-]+$`).test(storagePath)) fail("invalid storagePath");
  if ((await stickersRef(uid).limit(MAX_STICKERS).get()).size >= MAX_STICKERS) fail("sticker limit reached");
  const data = { breed: cleanText(body.breed, 80, "breed"), storagePath, createdAt: new Date() };
  await stickersRef(uid).doc(id).set(data);
  return { id, breed: data.breed, storagePath };
}

export async function deleteSticker(uid, id) {
  const ref = stickersRef(uid).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.delete();
  return snap.data().storagePath;
}
