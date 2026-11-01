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

## Adding a 3D model

Drop a glTF binary at `public/models/z.glb` and the hero switches from the drawn Z to the model, rendered as glowing edges so it matches the line work. Keep it under about 5 MB and 100k triangles for phones; `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt` helps. The only free, licensed model of the new Z found so far is the CC-BY "2023 Nissan 400Z" on Sketchfab.

## Deploying

The site is a static Vite build with an SPA rewrite in `vercel.json`. Import the repo in Vercel (framework: Vite) and every push deploys.
