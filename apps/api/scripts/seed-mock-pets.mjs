// Seeds demo pets and reminders for one user: node scripts/seed-mock-pets.mjs <email>
// Needs admin credentials, e.g. FIREBASE_USE_APPLICATION_DEFAULT=true after `gcloud auth application-default login`.
import { getAuth } from "firebase-admin/auth";
import { getFirestoreDb } from "../src/config/firebaseAdmin.js";
import { getQuizProfiles } from "../src/services/breedProfileService.js";
import { createPet, createReminder, listPets } from "../src/services/petService.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/seed-mock-pets.mjs <email>");
  process.exit(1);
}
if (!getFirestoreDb()) {
  console.error("No admin credentials found. Set FIREBASE_USE_APPLICATION_DEFAULT=true (and run gcloud auth application-default login) or provide FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.");
  process.exit(1);
}

const { uid } = await getAuth().getUserByEmail(email);
const { breeds } = await getQuizProfiles();
const find = (species, name) => breeds.find((breed) => breed.petType === species && breed.name.toLowerCase() === name.toLowerCase());
const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const yearsAgo = (years) => new Date(Date.now() - years * 365.25 * 86400000).toISOString().slice(0, 10);

const existing = new Set((await listPets(uid)).map((pet) => pet.name));
const mocks = [
  { name: "Mochi", species: "dog", breed: "Shiba Inu", birthDate: yearsAgo(3), weightKg: 10.5,
    reminders: [["vaccine", "Annual vaccines", daysFromNow(20), "yearly"], ["grooming", "Brush and bath", daysFromNow(5), "monthly"]] },
  { name: "Luna", species: "cat", breed: "Ragdoll", birthDate: yearsAgo(1.5), weightKg: 5.2,
    reminders: [["flea_tick", "Flea and tick prevention", daysFromNow(2), "monthly"], ["vet", "Dental check-up", daysFromNow(45), "none"]] },
  { name: "Biscuit", species: "dog", breed: "Pembroke Welsh Corgi", birthDate: yearsAgo(0.4), weightKg: 6.8,
    reminders: [["vaccine", "Puppy vaccine booster", daysFromNow(10), "monthly"], ["deworming", "Deworming", daysFromNow(10), "monthly"]] }
];

for (const mock of mocks) {
  if (existing.has(mock.name)) {
    console.log(`Skipping ${mock.name} (already exists)`);
    continue;
  }
  const breed = find(mock.species, mock.breed);
  if (!breed) console.warn(`Breed "${mock.breed}" not found; saving ${mock.name} without a breed`);
  const pet = await createPet(uid, { name: mock.name, species: mock.species, breedId: breed?.id ?? null, birthDate: mock.birthDate, weightKg: mock.weightKg });
  for (const [type, title, dueDate, repeat] of mock.reminders) {
    await createReminder(uid, { petId: pet.id, type, title, dueDate, repeat });
  }
  console.log(`Added ${mock.name}`);
}
process.exit(0);
