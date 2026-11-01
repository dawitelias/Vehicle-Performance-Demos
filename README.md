# Vehicle Performance Demos

Interactive lessons on car performance, built on the real numbers of one car: a 2024 Nissan Z Performance with the six-speed manual, in Ikazuchi Yellow.

Live: https://vehicle-performance-demos.vercel.app

## Demos

- `/torque-vs-horsepower` — five chapters: read the dyno sheet, gears multiply torque, the 50 to 80 highway pass, five engines in one Z, and a sandbox you can drive with sound and haptics.

## Run it

```sh
npm install
npm run dev        # local dev server
npm test           # 88 vitest checks on the physics against published figures
npm run build      # typecheck + production build to dist/
```

## Layout

| Path | What |
| --- | --- |
| `src/sim/` | Pure-TypeScript longitudinal simulator and vehicle data. Every number has a source comment; `src/sim/README.md` documents the model and tuned constants. |
| `src/audio/` | Procedural V6 twin-turbo engine sound (WebAudio). |
| `src/haptics/` | Vibration API on Android, the switch-control trick on iOS. |
| `src/ui/` | Contour-line Z, ring tach, curve chart, refracted numerals, control bars. |
| `src/demo/torque/` | The chapters. |
| `src/pages/` | Hub and demo pages. |
| `public/fonts/` | Self-hosted Archivo variable font. |

## The 3D model

`public/models/z.glb` is the [2020 Nissan Z Proto concept](https://sketchfab.com/3d-models/2020-nissan-z-proto-concept-03606ad387374824af0df58b6ca5f574) from Sketchfab, used under the licence stated on that page, run through `gltf-transform optimize --compress meshopt` (9.9 MB to 2.2 MB, 188k triangles). `src/ui/ZScene.tsx` replaces its materials with a near-black body carrying a yellow fresnel rim, draws crease edges as lines pushed above white so bloom catches them, splits the merged wheel mesh into four by position so each spins on its own hub and slides out for the exploded hero, and runs bloom, chromatic aberration, film grain and a vignette as post-processing passes. `src/ui/zSprite.ts` renders the same model side-on once per page load for the race diagrams. If WebGL is missing the hand-drawn contour Z in `ZContour.tsx` takes over.

## Deploying

The site is a static Vite build with an SPA rewrite in `vercel.json`. Import the repo in Vercel (framework: Vite) and every push deploys.
