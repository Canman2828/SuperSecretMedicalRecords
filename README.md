# medify.Rx

Hackathon monorepo: an **iOS app** (live prescription highlighter + profile), a **website** (profile + interaction tree), and one **Express API** they both talk to.

```
medifyrx/
├── apps/
│   ├── mobile/    Expo (React Native) iOS app — camera, on-device OCR, live highlights, TTS
│   ├── web/       Vite + React — profile editor, RxNorm autocomplete, 3D / WebXR interaction tree (three.js)
│   └── server/    Express + MongoDB — RxNorm, openFDA, interactions, explanations, accounts
└── packages/
    └── shared/    Types, glossary, critical-field parser, API client (used by all three)
```

## Quick start

Requires Node 20+.

```bash
npm install                                  # installs every app + package

cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example    apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env # set your computer's LAN IP here

npm run dev                                  # API on :4000 + website on :5173
```

Open http://localhost:5173 → **Load demo patient (Alex)** → **Check relationships**. You should see the tree with three sourced edges.

MongoDB is optional at first. With no `MONGODB_URI`, everything works in guest mode; only login/save is disabled. For a database, either run Mongo locally or use a free MongoDB Atlas cluster.

## Running the iOS app

The live highlighter uses **on-device OCR (ML Kit)**, which is a native module. That means **Expo Go won't work**; you need a *development build* installed on an iPhone (one-time setup, then it hot-reloads like Expo Go).

Pick one:

**A. You have a Mac with Xcode** (fastest)
```bash
cd apps/mobile
npm run ios:device            # plug in iPhone, pick the physical phone from the list
```
First build takes ~5–10 min. After that just run `npm run dev:mobile` from the root.

**B. No Mac** — build in the cloud with EAS (free tier works):
```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas device:create              # register your iPhone
npm run build:ios              # install the build from the link it gives you
npm run dev:mobile             # then scan the QR code
```
EAS needs an Apple Developer account ($99/yr) to install on a physical phone. If nobody on the team has one, go with option A.

**Simulator UI preview (Mac with Xcode):** from the repo root, run `npm run ios:simulator`.
This builds and opens the app in an iPhone simulator. Save UI changes while Metro is
running to see them refresh. The Scan screen links to the sample Preview screen;
the simulator cannot use a live camera.

**Physical iPhone:** from the repo root, run `npm run ios:device`, select your
connected phone, and enable Developer Mode on the phone if prompted. Xcode needs
an Apple account/development team for signing. This build includes the full ML Kit
OCR library. Cloud builds with `npm run build:ios` also retain OCR.

Use these commands when switching between simulator and phone: they reinstall
the correct pods before building. ML Kit's bundled binaries exclude Apple Silicon
simulators, so `react-native.config.js` omits ML Kit only when
`MEDIFYRX_IOS_TARGET=simulator`. The default remains a full phone build. Do not
override excluded architectures or reuse simulator pods for a phone build.

**Test camera scanning on a real iPhone.** Use the simulator for layout and navigation.

Your phone and computer need to be on the same Wi-Fi, and `EXPO_PUBLIC_API_URL` must be your computer's IP (not `localhost`). Hackathon Wi-Fi often blocks device-to-device traffic; if so, run `npx localtunnel --port 4000` or deploy the API and use that URL.

## Who does what

| Feature | Mobile | Web | Server |
|---|---|---|---|
| Live camera highlighting | ✅ | | |
| Tap term → explanation + TTS | ✅ | | `/api/explain` for glossary misses |
| Add scanned med to profile | ✅ | | |
| Profile editor | basic | ✅ full (RxNorm autocomplete) | |
| Interaction tree | cards | ✅ 3D / camera / WebXR tree | `/api/interactions/check` |
| Accounts / save profile | — | ✅ | `/api/auth`, `/api/profile` |

## How the highlighter works

```
every ~800ms: snap low-res still → ML Kit OCR (on device) → words + boxes
   → parseCriticalFields (shared, no AI) → map to screen coords → BoxTracker smoothing
   → HighlightLayer → tap → ExplanationSheet (original text always on top)
```

Key files: `apps/mobile/src/scan/useOcrLoop.ts`, `coordinateMap.ts`, `boxTracker.ts`, and `packages/shared/src/criticalParser.ts`. Photos are deleted right after OCR.

If highlights look offset, check `coordinateMap.ts` first (camera preview is cover-scaled).

## API

```
GET    /api/health
GET    /api/drugs/search?q=lopressor      RxNorm → ingredient + RxCUI
POST   /api/interactions/check            profile → nodes + sourced edges (guest OK)
POST   /api/explain                       glossary first, AI last
POST   /api/auth/register | /login        → JWT
GET    /api/profile                       (auth) saved profile
PUT    /api/profile                       (auth) save, only after explicit opt-in
DELETE /api/profile                       (auth) wipe saved health info
```

## Before the demo — TODO

- [ ] **Verify demo relationships.** `apps/server/src/data/demoRelationships.ts` has three edges with explanations in plain words. Open each label on DailyMed, confirm, and paste the exact label sentence into `sourceText` + the label URL.
- [ ] Grow `packages/shared/src/glossary.ts` toward ~50 terms.
- [ ] Print the sample prescription from the design doc (clean font, good lighting).
- [ ] Phase 6: use `services/openfda.ts` in `interactionResolver.ts` to pull real label text.
- [ ] Phase 8: wire `callModel` in `services/ai.ts` to your AI provider (key stays server-side).
- [ ] Synthetic patient data only. Don't call it HIPAA compliant.

## Scripts (from root)

```bash
npm run dev          # server + web
npm run dev:server
npm run dev:web
npm run dev:mobile   # Expo dev server (needs the dev build on your phone)
npm run typecheck    # all packages
```
