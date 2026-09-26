# medify.Rx — Agent Guide

Read this first. It's the fast path to understanding the stack so you can be productive without spelunking.

medify.Rx is a **prescription-clarity** project: point a phone at a prescription label and it highlights the important fields live, taps explain them in plain language, and a web app maps drug–drug interactions. It's a hackathon-grade monorepo — synthetic patient data only, **not** HIPAA compliant.

## Stack at a glance

npm **workspaces** monorepo. Requires **Node 20+**. TypeScript everywhere.

| Workspace | Path | Stack | What it is |
|---|---|---|---|
| `@medifyrx/mobile` | `apps/mobile` | Expo / React Native, expo-router | iOS app: live camera highlighter (on-device ML Kit OCR), tap-to-explain + TTS, basic profile |
| `@medifyrx/web` | `apps/web` | Vite + React 19, three.js (WebGL + WebXR) | **medify.Rx** site: Compremedic (plain-language label reader + TTS), Prescriptive (profile editor, RxNorm autocomplete, interaction tree), Medictionary (`/api/chat` assistant), sign-in |
| `@medifyrx/server` | `apps/server` | Express + MongoDB (Mongoose), JWT, Zod | REST API: RxNorm/openFDA lookups, interaction checks, explanations, accounts |
| `@medifyrx/shared` | `packages/shared` | Plain TypeScript | Shared types, glossary, critical-field parser, API client — imported by all three |

`packages/shared` is the source of truth for cross-cutting logic. Change shared types there, not in copies. It exports from `types`, `glossary`, `criticalParser`, `api` (see `packages/shared/src/index.ts`).

## Commands (run from repo root)

```bash
npm install            # installs every workspace
npm run dev            # server (:4000) + web (:5173) together, via concurrently
npm run dev:server     # API only  (tsx watch)
npm run dev:web        # web only   (Vite)
npm run dev:mobile     # Expo dev server (needs a dev build on a physical iPhone)
npm run typecheck      # tsc across all workspaces — run this before considering work done
```

There is no test runner or linter wired up yet; `typecheck` is the verification gate.

## Environment setup

Each app reads a `.env` (git-ignored). Templates are committed as `.env.example` — copy them:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example    apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

- `apps/server/.env` — `PORT`, `MONGODB_URI` (**optional**; blank = guest mode, only login/save disabled), `JWT_SECRET` (set a long random string), `CORS_ORIGINS`, `AI_API_KEY` (optional; a Google Gemini API key, needed for the chat assistant and AI explanations).
- `apps/web/.env` — `VITE_API_URL` (default `http://localhost:4000`).
- `apps/mobile/.env` — `EXPO_PUBLIC_API_URL` must be your computer's **LAN IP** (not `localhost`) so the iPhone can reach the API on the same Wi-Fi. Find it: `ipconfig getifaddr en0`.

## API surface

Base: `http://localhost:4000`. Routes are wired in `apps/server/src/app.ts`; each lives in `apps/server/src/routes/`.

```
GET    /api/health
GET    /api/drugs/search?q=<name>       RxNorm → ingredient + RxCUI
POST   /api/interactions/check          profile → nodes + sourced edges (guest OK)
POST   /api/explain                     glossary first, AI last
POST   /api/translate                   plain-language/translated rewrite; protected values masked + restored (guest OK)
POST   /api/chat                        medication Q&A, streams SSE; stateless (guest OK, 503 without AI_API_KEY)
POST   /api/auth/register | /login      → JWT
GET    /api/profile                     (auth) saved profile
PUT    /api/profile                     (auth) save — only after explicit opt-in
DELETE /api/profile                     (auth) wipe saved health info
POST   /api/documents                   (auth) save a Compremedic photo (base64) + plain-language text
GET    /api/documents                   (auth) list the user's saved documents, newest first
DELETE /api/documents/:id               (auth) delete one saved document (photo + text)
```

Note: `/api/documents` is mounted with its own 15mb JSON parser (photos are base64); every other route keeps the deliberate 200kb limit. Documents are keyed by `userId` and stored in Mongo — see `models/MedDocument.ts`, `routes/documents.ts`.

Server layout: `routes/` (HTTP) → `services/` (`rxnorm.ts`, `openfda.ts`, `interactionResolver.ts`, `ai.ts`, `chat.ts`, `translate.ts`) → `models/` (Mongoose). `middleware/auth.ts` guards authed routes; `schemas.ts` + `middleware/validate.ts` do Zod validation.

## How the mobile highlighter works

```
every ~800ms: low-res still → ML Kit OCR (on device) → words + boxes
  → parseCriticalFields (shared, no AI) → map to screen coords → BoxTracker smoothing
  → HighlightLayer → tap → ExplanationSheet (original text always shown)
  → ArPanels: glass panels anchored beside the paper (union of OCR boxes)
      live:   Key details — sign here / when / dosage
      frozen: Original | Plain words side by side, TTS for both, language toggle (/api/translate)
```

The parser also tags `signature` (signature lines, "X ____") and `timing` (dates, clock times, "at bedtime"). The AI rewrite never sees protected values: `packages/shared/src/protect.ts` swaps them for `[[n]]` placeholders and rejects output that drops/duplicates one or adds digits; the client falls back to the glossary-only version.

Key files: `apps/mobile/src/scan/{useOcrLoop,coordinateMap,boxTracker}.ts`, `HighlightLayer.tsx`, `ArPanels.tsx`, `ExplanationSheet.tsx`, and `packages/shared/src/criticalParser.ts`. If highlights look offset, check `coordinateMap.ts` first (preview is cover-scaled; ML Kit boxes come back in the raw landscape sensor buffer and are rotated upright via EXIF orientation in `rawBoxToUpright`). Photos are discarded right after OCR.

## Conventions & gotchas

- **Privacy first.** Request bodies carry health info — the server deliberately does **not** log them (see comment in `app.ts`). Keep it that way. Profile is only persisted after explicit user opt-in. The **Scan** tab still discards photos right after OCR (nothing leaves the device). The **Compremedic** tab is the one exception: a signed-in user can explicitly save a captured photo + its plain-language text to their account (`/api/documents`), and delete it anytime.
- **Server is ESM.** Route/service imports use `.js` extensions in TS source (e.g. `./routes/auth.js`). Match that style.
- **React is pinned** to 19.2.3 via root `overrides` — don't fight it in a workspace.
- **Mobile can't use Expo Go.** ML Kit OCR is a native module, so it needs a **development build** on a **physical iPhone** (camera doesn't work in the simulator). See README for the Xcode / EAS paths.
- **Sourcing matters.** Interaction explanations should trace to a real label (DailyMed/openFDA). Demo edges live in `apps/server/src/data/demoRelationships.ts`. Never present unsourced claims as authoritative; `NO_RESULT_DISCLAIMER` in shared is the required hedge.
- **Don't claim medical/HIPAA compliance.** Synthetic data only.

## Where to look first

- Cross-app types or parsing → `packages/shared/src/`
- API behavior → `apps/server/src/routes/` then `services/`
- Web UI → `apps/web/src/`: hash routes in `router.ts`, one folder per page (`home/`, `compremedic/`, `prescriptive/`, `medictionary/`, `auth/`), tree in `graph/`. Styling: `design.css` is the medify.Rx design system (neumorphic tokens and components, ported verbatim), `styles.css` holds app-specific additions. Icons and logo are an SVG sprite in `index.html`, used via `<Icon name="…">`.
- Web Compremedic → `apps/web/src/compremedic/`: `extractText.ts` reads photos (Tesseract OCR), PDFs (pdf.js text layer, OCR fallback for scans) and .docx (mammoth) in the browser, so files never leave the device. `simplify.ts` calls `/api/translate` (protected AI rewrite) and falls back to the glossary per chunk. `transcript.ts` splits text into words (one clickable button and one audio position each). `useSpeech.ts` speaks sentence-sized chunks with Web Speech so the audio can seek and scrub.
- Web Prescriptive → `apps/web/src/prescriptive/`: `treeScene.ts` is the three.js engine (orbs, cables, picking, camera focus, WebXR `immersive-ar` with hit-test surface placement). `TreeViewer.tsx` is the React HUD (3D / Camera / AR switch, pair popup), and `status.ts` maps statuses to red/yellow/green. The page calls `/api/interactions/check` with `includeRelated: true` so the server also returns things to avoid or pair that aren't in the profile (the phone app doesn't send it). With that flag the server also reads each medicine's openFDA label (`services/labelFoods.ts`): a food becomes a red node only when a label sentence names it next to avoid-language ("do not", "avoid", "should not"…). That exact sentence is the edge's `sourceText`, and it overrides a curated `drug-food` rule for the same pair. The entrance (big title on white → sideways sweep → frame animation → pill glides onto the center node) uses frames `0001.png`…`0183.png` in `apps/web/public/prescriptive-intro/`. Run `python apps/web/scripts/optimize-intro-frames.py` to make the `.webp` copies the page actually loads (~13 MB vs ~258 MB). Timings and the pill's measured position/angle are in `introConfig.ts`.
- Camera/OCR/highlighting → `apps/mobile/src/scan/`

The `README.md` has demo run-throughs, the iOS build walkthrough, and the pre-demo TODO list.
