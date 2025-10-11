# Swift Frontend Integration — macOS Assistant
This document aligns the Swift UI with our local backend services. It inventories current Swift features, maps them to backend endpoints, and lists concrete fixes to eliminate mismatches.
## Current Swift Features (observed)
- Backend integration service with async calls

  - Base URL via `ProcessInfo.processInfo.environment["API_BASE_URL"]`

  - Image analysis: `sendImageForAnalysis(_:)`

  - Image generation: `generateImage(prompt:refine:)`

  - Visual reasoning: `performVisualReasoning(image:question:)`

  - Image refinement: `refineImage(_:strength:)`

- Feature file: `UniversalAICompanionPackage/Sources/UniversalAICompanionFeature/BackendIntegration.swift:1`
## Backend Services and Expected Shapes
Rust Vision Service (`crates/vision-service/src/main.rs`):

- POST `/vision/analyze` — VisionRequest

  - `{ image: <base64 or URL>, prompt?: string, model?: string, max_tokens?: number, temperature?: number }`

- POST `/vision/ocr` — OCRRequest

  - `{ image: <base64 or URL>, languages?: string[] }`

- POST `/vision/generate` — ImageGenerationRequest

  - `{ prompt: string, negative_prompt?: string, width?: number, height?: number, steps?: number, guidance_scale?: number, seed?: number }`

- GET `/vision/result/:id`, POST `/vision/upload` (multipart)

- Health: GET `/health`
Note: No `/vision/refine` or `/vision/reason` endpoints presently.
## Mismatches to Fix
1) Analyze payload naming

- Swift sends `{ imageBase64, options: { ... } }`

- Backend expects `{ image, prompt?, model?, max_tokens?, temperature? }`
2) Generate payload structure

- Swift sends `{ prompt, parameters: { width, height, steps, guidance }, refine: { enabled, strength, backend } }`

- Backend expects flat fields (no nested `parameters` or `refine` keys)
3) Missing endpoints in backend

- Swift calls `/vision/refine` and `/vision/reason`; backend does not implement these routes.
## Action Plan
A. Short term (align Swift to existing backend)

- Analyze

  - Change body to `{ image: base64String, prompt: optionalPrompt }`

  - Endpoint: `POST /vision/analyze`

- Generate

  - Flatten body: `{ prompt, width, height, steps, guidance_scale }`

  - Endpoint: `POST /vision/generate`

- OCR (optional UI hook)

  - Add call for `POST /vision/ocr` with `{ image, languages? }`

- Remove/disable `refine` and `reason` buttons until implemented server-side, or gate with feature flags

- Set `API_BASE_URL` to local vision service (`http://localhost:3033`)
B. Medium term (add backend routes to match UX)

- Implement `/vision/refine` route (wraps generation with `init_image` semantics or uses an actual refiner)

- Implement `/vision/reason` (caption + VQA pipeline; can call analyze + LLM to answer questions)

- Add streaming for long running ops (SSE) to show progress in UI
## Example Swift Payload Shapes (aligned)
- Analyze

```json

{

  "image": "<base64>",

  "prompt": "Describe the scene"

}

```
- Generate

```json

{

  "prompt": "A serene lakeside at sunset",

  "width": 512,

  "height": 512,

  "steps": 30,

  "guidance_scale": 7.5

}

```
- OCR

```json

{

  "image": "<base64>",

  "languages": ["en"]

}

```
## Base URL Configuration
- Development: Set `API_BASE_URL=http://localhost:3033`

- Optional: Provide a Debug menu or Settings UI to change base URL

- Consider using `UserDefaults` fallback when env var not set
## Future: Chat + Tools + Memory
- Chat (SSE): UI should connect to `assistantd` `/chat/stream` endpoint and stream tokens via `URLSession` bytes API

- Tools: add UI affordances to capture tool requests (file search/edit preview, shell results)

- Memory: show session history and allow search results from vector store (Weaviate/pgvector), with source links
## QA Checklist (Swift)
- [ ] Update analyze/generate requests to match backend shapes

- [ ] Disable (or feature-gate) refine/reason until routes exist

- [ ] Set `API_BASE_URL` to local service and verify network calls

- [ ] Add OCR button to call `/vision/ocr`

- [ ] Health check ping to `/health` (status banner)

- [ ] Streaming test page (for future chat SSE)
## Open Questions
- Should refine be integrated as an init-image generation mode or as a separate service?

- For reasoning, do we prefer LMM (local) or a staged vision->LLM approach first?
---
Owners: Swift UI + Backend teams. Please keep this doc in sync as routes evolve.
## Assistant Daemon Endpoints (Chat + RAG)
- POST `/chat` — `{ messages: [{role, content}], model? }` → `{ content, model, provider }`

- POST `/chat/stream` — SSE events: `token` (partial content), `done`

- POST `/memory/search` — `{ query, k?, semantic_weight? }` → results with `{ id, table_name, title?, content, combined_score }`

- POST `/rag/r1` — `{ query, k?, model? }` → `{ answer, model, provider, citations: [...] }`

- GET `/health`
Base URLs:

- Vision: `http://localhost:3033`

- Chat/RAG: `http://localhost:3030`
