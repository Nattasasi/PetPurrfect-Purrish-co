# Purrish&Co. MVP Implementation Plan and Context

Date: 2026-07-21

## Confirmed Context and Scope

Project status:
- Current project is a static multi-page website (HTML/CSS/JS) with placeholder AI interactions.
- Team will build a more fleshed out version next.
- No custom AI model training or fine-tuning in this phase.

Required features:
- Personality quiz part
  - 20 questions
  - RAG process results
  - Share result image
- Sticker generator part
  - Image upload
  - Computer vision object identification
  - AI replace and calibrate with pre-illustrated parts
  - Share result image
- Homepage
  - View product information
  - Link to third-party e-commerce web

Chosen implementation decisions:
- Frontend: React + Vite
- Hosting: Node backend hosting
- Quiz count: Exactly 20 questions
- RAG source: External API data
- Share image output: Template-based card with text + avatar
- Vision approach: Browser-side pretrained model (TensorFlow.js/MediaPipe)
- Illustration assets: Not ready yet
- E-commerce links: Per-product links and global CTA
- AI training/fine-tuning: Confirmed out of scope for MVP

## Target MVP Architecture

- React + Vite frontend
- Node + Express backend
- Browser CV inference for sticker flow
- Backend RAG orchestration for quiz results
- Optional database for persistence in a later pass

High-level flow:
1. Frontend collects inputs (quiz answers or pet image).
2. Frontend runs local CV (sticker path) and sends normalized payloads to backend.
3. Backend calls external RAG data sources for quiz grounding and response composition.
4. Frontend renders result screens and exports shareable images.

## Feature Plan

### 1) Personality Quiz

Frontend:
- 20 fixed questions in config JSON.
- Quiz state management with progress and validation.
- Trait vector scoring from answers.
- Result page with recommendation, confidence, and grounded explanation.
- Share image generator (canvas/template card export PNG).

Backend:
- API endpoint to evaluate quiz payload.
- External API retrieval for grounding snippets and recommendation context.
- Confidence normalization and robust fallback behavior when external API fails.

### 2) Sticker Generator

Frontend:
- Image upload and preview (drag/drop + picker).
- Client-side validation (format and size) and optional crop.
- Browser-side CV inference (pretrained model only).
- Rule engine to map detected attributes to illustrated part layers.
- Final composition and share image export.

Backend:
- Optional logging endpoint for generation metadata.
- Optional asset-manifest endpoint with layer compatibility rules.

Note:
- Since illustration assets are not ready yet, start with placeholder part library and deterministic mapping rules.

### 3) Homepage and Product Linking

Frontend:
- Product cards with image, description, price, tags, and external buy links.
- Global CTA to third-party storefront.
- Optional outbound click analytics event hooks.

Backend (optional for MVP):
- Product metadata endpoint if central management is needed.

## Proposed Project Structure

SeniorProject2/
- apps/
  - web/ (React + Vite)
    - src/
      - pages/
        - HomePage
        - QuizPage
        - QuizResultPage
        - StickerPage
      - components/
        - quiz/
        - sticker/
        - share/
        - products/
      - lib/
        - apiClient
        - shareImage
        - cv/
          - inference
          - attributeMapper
      - data/
        - quizQuestions.json
  - api/ (Node + Express)
    - src/
      - routes/
        - quiz
        - rag
        - products
        - sticker
      - services/
        - ragService
        - promptService
        - productService
      - adapters/
        - externalPetApi
      - middleware/
        - rateLimit
        - validate
      - config/
        - env

## API Contract Draft (MVP)

1) POST /api/quiz/evaluate
- Input
  - answers: list of question answer entries
  - traits: normalized trait vector
- Output
  - match: recommended pet profile
  - confidence
  - grounding snippets
  - summary and care tips

2) GET /api/products
- Returns product list with external URLs.

3) GET /api/sticker/assets-manifest (optional)
- Returns available illustration parts and compatibility mapping.

4) POST /api/sticker/compose-preview (optional)
- Resolves final layer manifest from detected attributes and user overrides.

## Data Model Draft (MVP)

- QuizQuestion
  - id, text, type, options, weights
- QuizResult
  - sessionId, traitVector, matchId, confidence, createdAt
- PetProfileSnippet
  - source, profileId, traits, snippetText
- StickerGeneration
  - sessionId, detectedAttributes, selectedLayers, exportedAt
- Product
  - id, name, description, price, imageUrl, externalUrl, tags, active

## Milestone Sequence

Milestone 1: Foundation
- Create React + Vite frontend and Express backend structure.
- Migrate current static pages into componentized routes.
- Add product data and homepage linking.

Milestone 2: Quiz Core
- Implement 20-question flow.
- Add local scoring and deterministic recommendation fallback.
- Build share-result image export.

Milestone 3: RAG Integration
- Integrate backend external data retrieval for grounded quiz results.
- Add confidence scoring and fallback strategy.

Milestone 4: Sticker MVP
- Implement upload/crop/validate.
- Add browser CV inference.
- Compose sticker from placeholder illustrated layers.
- Export shareable result image.

Milestone 5: Small MongoDB Datastore
- Add a small MongoDB database (prefer MongoDB Atlas free/shared tier for MVP).
- Create minimal collections:
  - quiz_results (sessionId, traitVector, matchId, confidence, createdAt)
  - sticker_generations (sessionId, detectedAttributes, selectedLayers, exportedAt)
  - products (optional, only if moving product catalog from static JSON)
- Add backend repository layer and environment-based DB connection config.
- Persist only metadata first (no raw image storage in MVP).
- Add one read endpoint for recent quiz/sticker history (optional feature flag).

Milestone 6: Hardening
- Validation, rate limits, and error handling.
- Accessibility and responsive polish.
- Basic analytics events.

## No-Training AI Strategy

- Quiz intelligence: rule-based trait scoring + external RAG enrichment.
- Sticker intelligence: pretrained browser CV + deterministic part mapping.
- Product experience: curated data and outbound commerce flow.

This phase focuses on orchestration quality, UX quality, and reliability rather than model training.

## Open Clarifications for Execution

Before coding, finalize:
- Backend framework choice confirmation (Express assumed).
- External provider choices for RAG data source.
- Whether user accounts are required in MVP.
- Whether to store generated images or process-and-discard.
- Share targets: download only vs direct social share integrations.
- Visual references for share-card templates and sticker style.
- Priority order if shipping incrementally (quiz first, sticker first, or homepage first).
