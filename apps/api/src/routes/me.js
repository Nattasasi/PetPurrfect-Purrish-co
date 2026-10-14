import { Router } from "express";
import { requireCustomer } from "../middleware/requireCustomer.js";
import { getEmailReminders, setEmailReminders } from "../services/reminderEmailService.js";
import { claimQuizResult, listOwnedQuizResults } from "../services/quizResultRepository.js";
import {
  completeReminder,
  createPet,
  createSticker,
  deleteSticker,
  listStickers,
  createReminder,
  deletePet,
  deleteReminder,
  isValidationError,
  listPets,
  listReminders,
  reminderPresets,
  suggestionsForPet,
  updatePet
} from "../services/petService.js";

const router = Router();
router.use(requireCustomer);

const handle = (fn, failure) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ error: "invalid_request", message: error.message });
    res.status(500).json({ error: failure });
  }
};

const notFound = (res) => res.status(404).json({ error: "not_found" });

router.get("/results", handle(async (req, res) => {
  res.json({ results: await listOwnedQuizResults(req.uid) });
}, "results_fetch_failed"));

router.post("/results/:id/claim", handle(async (req, res) => {
  const outcome = await claimQuizResult(req.params.id, req.uid, req.body?.sessionId);
  if (!outcome.ok) return res.status(outcome.status).json({ error: outcome.error });
  res.json({ claimed: true });
}, "claim_failed"));

router.get("/pets", handle(async (req, res) => res.json({ pets: await listPets(req.uid) }), "pets_fetch_failed"));
router.post("/pets", handle(async (req, res) => res.status(201).json({ pet: await createPet(req.uid, req.body) }), "pet_save_failed"));
router.put("/pets/:id", handle(async (req, res) => {
  const pet = await updatePet(req.uid, req.params.id, req.body);
  return pet ? res.json({ pet }) : notFound(res);
}, "pet_save_failed"));
router.delete("/pets/:id", handle(async (req, res) => {
  return (await deletePet(req.uid, req.params.id)) ? res.status(204).end() : notFound(res);
}, "pet_delete_failed"));

async function findPet(req) {
  return (await listPets(req.uid)).find((pet) => pet.id === req.params.id);
}

router.get("/pets/:id/presets", handle(async (req, res) => {
  const pet = await findPet(req);
  return pet ? res.json({ presets: reminderPresets(pet) }) : notFound(res);
}, "presets_failed"));
router.get("/pets/:id/suggestions", handle(async (req, res) => {
  const pet = await findPet(req);
  return pet ? res.json({ suggestions: await suggestionsForPet(pet) }) : notFound(res);
}, "suggestions_failed"));

router.get("/reminders", handle(async (req, res) => res.json({ reminders: await listReminders(req.uid) }), "reminders_fetch_failed"));
router.post("/reminders", handle(async (req, res) => res.status(201).json({ reminder: await createReminder(req.uid, req.body) }), "reminder_save_failed"));
router.post("/reminders/:id/complete", handle(async (req, res) => {
  const reminder = await completeReminder(req.uid, req.params.id);
  return reminder ? res.json({ reminder }) : notFound(res);
}, "reminder_save_failed"));
router.delete("/reminders/:id", handle(async (req, res) => {
  return (await deleteReminder(req.uid, req.params.id)) ? res.status(204).end() : notFound(res);
}, "reminder_delete_failed"));

router.get("/stickers", handle(async (req, res) => res.json({ stickers: await listStickers(req.uid) }), "stickers_fetch_failed"));
router.post("/stickers", handle(async (req, res) => res.status(201).json({ sticker: await createSticker(req.uid, req.body) }), "sticker_save_failed"));
router.delete("/stickers/:id", handle(async (req, res) => {
  const storagePath = await deleteSticker(req.uid, req.params.id);
  return storagePath ? res.json({ storagePath }) : notFound(res);
}, "sticker_delete_failed"));

router.get("/preferences", handle(async (req, res) => res.json({ emailReminders: await getEmailReminders(req.uid) }), "preferences_failed"));
router.put("/preferences", handle(async (req, res) => {
  if (typeof req.body?.emailReminders !== "boolean") return res.status(400).json({ error: "invalid_request" });
  await setEmailReminders(req.uid, req.body.emailReminders);
  res.json({ emailReminders: req.body.emailReminders });
}, "preferences_failed"));

export default router;
