import { saveQuizResult } from "./quizResultRepository.js";
import { fetchPetKnowledge } from "../adapters/externalPetApi.js";
import { fetchBreedImageUrl } from "../adapters/petImageApi.js";
import { env } from "../config/env.js";
import { getKnowledgeBase, loadKnowledgeBase } from "./petKnowledgeBase.js";

const TRAIT_KEYS = ["energy", "sociability", "independence", "routine", "trainability"];
const OLLAMA_TIMEOUT_MS = 300000;
const GROUNDING_CANDIDATE_COUNT = 3;
const MAX_SHARE_CAPTIONS = 3;
const MAX_SHARE_CAPTION_LENGTH = 180;

function scoreCandidate(traits, candidate) {
  const distance = TRAIT_KEYS.reduce((sum, key) => {
    const traitValue = traits[key] ?? 0.5;
    const targetValue = candidate.traits?.[key] ?? 0.5;
    return sum + Math.abs(traitValue - targetValue);
  }, 0);

  const confidence = Math.max(0, 1 - distance / TRAIT_KEYS.length);

  return {
    ...candidate,
    confidence: Number(confidence.toFixed(3)),
    distance
  };
}

function rankCandidates(traits, candidates) {
  const scored = candidates.map((candidate) => scoreCandidate(traits, candidate));
  scored.sort((a, b) => a.distance - b.distance);
  const kb = getKnowledgeBase();
  return scored.length > 0 ? scored : [scoreCandidate(traits, kb[0])];
}

// Builds a prompt that only lets Gemini generate text grounded in the profiles already retrieved above.
function buildGroundedPrompt(traits, rankedCandidates) {
  const context = rankedCandidates
    .map((candidate, index) => `${index + 1}. ${candidate.name} — traits: ${JSON.stringify(candidate.traits)}. Summary: ${candidate.summary}`)
    .join("\n");

  return `You are a pet-matching assistant. Only use the retrieved profiles below as factual ground truth — do not invent breed facts.

Retrieved profiles:
${context}

User's quiz trait profile: ${JSON.stringify(traits)}

Write a 2-3 sentence explanation of why "${rankedCandidates[0].name}" is the best match for this user, grounded strictly in the retrieved profile data above. Do not mention the other candidates.`;
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
        options: {
          temperature: 0.4,
          num_ctx: env.ollama.contextLength,
          num_predict: 300
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`ollama_http_${response.status}`);
    }

    const payload = await response.json();
    const text = payload?.response;

    if (!text || !text.trim()) {
      throw new Error("ollama_empty_response");
    }

    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function generateGroundedSummary(traits, rankedCandidates) {
  try {
    const prompt = buildGroundedPrompt(traits, rankedCandidates);
    return await callOllama(prompt);
  } catch (error) {
    return null;
  }
}

function buildPersonalityPrompt(traits, topTraits = [], selected) {
  return `You are writing a warm, concise personality insight for a pet matching quiz.

User trait scores (0 to 1): ${JSON.stringify(traits)}
Strongest traits: ${JSON.stringify(topTraits)}
Matched pet profile: ${selected.name} — ${selected.summary}

Write 2-4 natural sentences directly to the user. Explain their personality and lifestyle in friendly language, then connect it briefly to why this pet could fit them. Use only the trait scores and retrieved profile above. Do not mention scores, algorithms, AI, prompts, retrieval, or data sources. Do not claim certainty or invent facts. Return plain text only. `;
}

async function generatePersonalitySummary(traits, topTraits, selected) {
  try {
    return await callOllama(buildPersonalityPrompt(traits, topTraits, selected));
  } catch (error) {
    return null;
  }
}

function buildShareCaptionFallback(selected, context = "pet personality quiz") {
  if (context.includes("sticker")) {
    return [
      `My pet just got turned into a ${selected.name} sticker by Purrish&Co. 🐾 Create yours and share it!`,
      `I made a custom ${selected.name} sticker with Purrish&Co.! What would your pet look like?`,
      `Would your pet get the same result? Try the Purrish&Co. sticker maker and find out! ✨`
    ];
  }

  return [
    `My Purrish&Co. quiz says I'm a match for a ${selected.name} 🐾 What pet matches you?`,
    `Apparently, my personality matches a ${selected.name}. Take the Purrish&Co. quiz and find yours!`,
    `Would you get the same result? Discover your person-pet match with Purrish&Co. ✨`
  ];
}

function buildShareCaptionPrompt(selected, traits, context = "pet personality quiz result") {
  return `Create exactly 3 short social media captions for a ${context}.

Trusted facts:
- Matched pet: ${selected.name}
- User traits: ${JSON.stringify(traits)}
- Product: Purrish&Co. person-pet quiz

Rules:
- Return JSON only in this exact shape: {"captions":["caption 1","caption 2","caption 3"]}
- Each caption must be 80 words or fewer and ${MAX_SHARE_CAPTION_LENGTH} characters or fewer.
- Make each caption distinct, friendly, and invite another person to take the quiz.
- Do not invent pet facts, discounts, prizes, or claims about accuracy.
- Emojis are optional.`;
}

function parseShareCaptions(raw, fallback) {
  try {
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(jsonText || "{}");
    const captions = Array.isArray(parsed.captions)
      ? parsed.captions
        .filter((caption) => typeof caption === "string")
        .map((caption) => caption.trim())
        .filter((caption) => caption.length > 0 && caption.length <= MAX_SHARE_CAPTION_LENGTH)
        .slice(0, MAX_SHARE_CAPTIONS)
      : [];

    return captions.length === MAX_SHARE_CAPTIONS ? captions : fallback;
  } catch {
    return fallback;
  }
}

export async function generateShareCaptions(selected, traits, context = "pet personality quiz result") {
  const fallback = buildShareCaptionFallback(selected, context);

  try {
    const raw = await callOllama(buildShareCaptionPrompt(selected, traits, context));
    return parseShareCaptions(raw, fallback);
  } catch {
    return fallback;
  }
}

function buildGrounding(selected, sourceLabel) {
  return [
    {
      source: sourceLabel,
      snippet: selected.summary
    }
  ];
}

// FALLBACK_PROFILES sometimes append the species (e.g. "Ragdoll Cat"), which
// external breed APIs don't recognize as a real breed name.
function cleanBreedNameForQuery(name, petType) {
  if (!name || !petType) {
    return name;
  }
  const suffix = new RegExp(`\\s+${petType}$`, "i");
  return name.replace(suffix, "").trim();
}

export async function evaluateQuiz(payload = {}) {
  const traits = payload.traits || {};
  const answers = payload.answers || [];

  // Retrieve: rank the known breed profiles locally (from Ninja API knowledge base),
  // then look up the matched breed by name in the Ninja API to ground the summary in real breed facts.
  const kb = await loadKnowledgeBase();
  const ranked = rankCandidates(traits, kb);
  const selected = ranked[0];
  const queryName = cleanBreedNameForQuery(selected.name, selected.petType);
  const knowledge = await fetchPetKnowledge(queryName);
  // Ninja API does partial name matching, so prefer the exact breed match if present.
  const ninjaRecord =
    knowledge.records.find((record) => record.name.toLowerCase() === queryName.toLowerCase()) ||
    knowledge.records[0] ||
    null;

  const groundingCandidates = ninjaRecord
    ? [{ ...selected, summary: ninjaRecord.summary }, ...ranked.slice(1, GROUNDING_CANDIDATE_COUNT)]
    : ranked.slice(0, GROUNDING_CANDIDATE_COUNT);
  const [groundedSummaryResult, personalitySummaryResult, shareCaptionsResult] = await Promise.all([
    generateGroundedSummary(traits, groundingCandidates),
    generatePersonalitySummary(traits, payload.topTraits || [], selected),
    generateShareCaptions(selected, traits)
  ]);
  const groundedSummary = groundedSummaryResult;
  const personalitySummary = personalitySummaryResult;
  const shareCaptions = shareCaptionsResult;
  const breedImageUrl = await fetchBreedImageUrl(queryName, selected.petType);
  const knowledgeBaseSource = selected.source || "fallback-profile";

  const response = {
    provider: ninjaRecord ? `${knowledgeBaseSource}+ninja-api` : knowledgeBaseSource,
    sourceCount: kb.length,
    match: {
      id: selected.id,
      name: selected.name,
      petType: selected.petType || null,
      confidence: selected.confidence,
      imageUrl: breedImageUrl || selected.imageUrl || null
    },
    grounding: buildGrounding(
      ninjaRecord ? { summary: ninjaRecord.summary } : selected,
      ninjaRecord ? `${knowledgeBaseSource};${knowledge.source}` : knowledgeBaseSource
    ),
    llmProvider: groundedSummary ? "gemini" : "none",
    summary:
      groundedSummary ||
      ninjaRecord?.summary ||
      selected.summary ||
      "This recommendation is computed from your quiz trait profile and external pet data.",
    personalitySummary,
    traits,
    shareCaptions,
    shareCaptionModel: env.ollama.model
  };

  let persistence = { enabled: false, saved: false };

  try {
    persistence = await saveQuizResult({
      sessionId: payload.sessionId,
      matchId: response.match.id,
      matchName: response.match.name,
      confidence: response.match.confidence,
      imageUrl: response.match.imageUrl || null,
      source: "api",
      traits,
      topTraits: payload.topTraits || [],
      answers,
      questionCount: payload.questionCount,
      shareCaptions: response.shareCaptions,
      shareCaptionModel: response.shareCaptionModel,
      provider: response.provider,
      sourceCount: response.sourceCount,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    persistence = {
      enabled: true,
      saved: false,
      error: error?.message || "persistence_failed"
    };
  }

  return {
    ...response,
    persistence
  };
}
