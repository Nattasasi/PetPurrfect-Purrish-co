import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_QUESTIONS = JSON.parse(
  readFileSync(path.join(__dirname, "../data/quizQuestions.json"), "utf-8")
);

const TRAIT_KEYS = ["energy", "sociability", "independence", "routine", "trainability"];
const OLLAMA_TIMEOUT_MS = 60000;
const STATIC_QUESTION_COUNT = 5;
const ADAPTIVE_QUESTION_COUNT = 15;
const STATIC_QUESTIONS = ALL_QUESTIONS.slice(0, STATIC_QUESTION_COUNT);

function describeStaticAnswers(staticAnswers = []) {
  if (staticAnswers.length === 0) return "No initial answers were provided.";
  return staticAnswers.map((answer) => {
    const question = STATIC_QUESTIONS.find((item) => item.id === answer.questionId);
    const option = question?.options.find((item) => item.value === answer.value);
    return `- "${question?.text || answer.questionId}" -> "${option?.label || answer.value}"`;
  }).join("\n");
}

function buildPrompt(staticAnswers, previousResult, previousQuestionTexts = [], questionCount) {
  const traitContext = previousResult
    ? `The same user previously took this quiz and matched with "${previousResult.matchName || "an unknown pet"}". Their previous trait profile was ${JSON.stringify(previousResult.traits || {})}. Create fresh scenarios.`
    : "This is the user's first time taking the quiz, so use varied, everyday scenarios.";
  const previousQuestionContext = previousQuestionTexts.length > 0
    ? `Do not repeat or closely paraphrase these earlier questions:\n${previousQuestionTexts.map((text) => `- ${text}`).join("\n")}`
    : "There are no earlier generated questions to avoid.";

  return `You generate a novel personality quiz that infers the user's personality from everyday human-life choices.

${traitContext}

The user answered these initial questions:
${describeStaticAnswers(staticAnswers)}

${previousQuestionContext}

Generate exactly ${questionCount} new question object${questionCount === 1 ? "" : "s"} in this exact JSON shape: {"questions":[{"text":"...","options":[{"value":"a","label":"...","traits":{"energy":0,"sociability":0,"independence":0,"routine":0,"trainability":0}}]}]}. Ask about the user's routines, reactions, priorities, social situations, decisions, preferences, or imaginative everyday scenarios. Never ask about breeds, species, animals, pets, pet ownership, grooming, feeding, training, animal behavior, or knowledge of animal care. Do not mention dogs, cats, or any other animal anywhere in question text or option labels. Prioritize surprising, varied, and memorable questions over precise matching accuracy. Every question must test a distinct scenario; do not repeat the same scenario, wording, or underlying choice. Each question needs exactly 4 options, and each option needs trait numbers from -2 to 2 for energy, sociability, independence, routine, and trainability. Output only raw JSON.`;
}

async function callOllama(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const url = `${env.ollama.baseUrl.replace(/\/$/, "")}/api/generate`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.ollama.model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.7, num_ctx: env.ollama.contextLength, num_predict: 1200 }
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`ollama_http_${response.status}`);
    const payload = await response.json();
    if (!payload?.response?.trim()) throw new Error("ollama_empty_response");
    return payload.response;
  } finally {
    clearTimeout(timeout);
  }
}

function extractQuestionArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (Array.isArray(parsed?.data)) return parsed.data;
  throw new Error("unexpected_llm_response_shape");
}

function sanitizeTraits(traits) {
  return TRAIT_KEYS.reduce((result, key) => {
    const value = Number(traits?.[key]);
    result[key] = Number.isFinite(value) ? Math.max(-2, Math.min(2, value)) : 0;
    return result;
  }, {});
}

function shuffleOptions(options) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeQuestionText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsAnimalReference(text) {
  return /\b(animal|animals|pet|pets|dog|dogs|cat|cats|breed|breeds|puppy|kitten|groom|grooming|feed|feeding|train|training|vet|veterinarian)\b/i.test(text);
}

function validateQuestions(rawQuestions, questionCount, questionOffset) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length !== questionCount) throw new Error("invalid_question_count");
  const seenQuestionTexts = new Set();
  return rawQuestions.map((question, questionIndex) => {
    const questionText = question?.text || question?.question || question?.prompt;
    if (!question || typeof questionText !== "string" || !questionText.trim()) throw new Error("invalid_question_text");
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error("invalid_question_options");
    const normalizedText = normalizeQuestionText(questionText);
    if (seenQuestionTexts.has(normalizedText)) throw new Error("duplicate_question_text");
    if (containsAnimalReference(questionText)) throw new Error("animal_reference_in_question");
    seenQuestionTexts.add(normalizedText);
    const options = question.options.map((option, optionIndex) => {
      if (!option || typeof option.label !== "string" || !option.label.trim()) throw new Error("invalid_option_label");
      if (containsAnimalReference(option.label)) throw new Error("animal_reference_in_option");
      return {
        value: String(option.value || `opt${questionIndex + 1}_${optionIndex + 1}`),
        label: option.label.trim(),
        traits: sanitizeTraits(option.traits)
      };
    });
    return { id: `adaptive-q${questionOffset + questionIndex + 1}`, text: questionText.trim(), type: "single", options: shuffleOptions(options) };
  });
}

export function getStaticQuestions() {
  return STATIC_QUESTIONS;
}

export async function generateAdaptiveQuestions(
  staticAnswers,
  previousResult,
  previousQuestionTexts = [],
  questionCount = ADAPTIVE_QUESTION_COUNT,
  questionOffset = 0
) {
  const prompt = buildPrompt(staticAnswers, previousResult, previousQuestionTexts, questionCount);
  const raw = await callOllama(prompt);
  const questions = validateQuestions(extractQuestionArray(JSON.parse(raw)), questionCount, questionOffset);
  return { source: "ollama", model: env.ollama.model, questions };
}
