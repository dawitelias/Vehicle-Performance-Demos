# Vehicle Performance Demos

Interactive lessons on car performance, built on the real numbers of one car: a 2024 Nissan Z Performance with the six-speed manual, in Ikazuchi Yellow.

Live: https://vehicle-performance-demos.vercel.app

## Demos

- `/torque-vs-horsepower`: a long-form article that builds torque and horsepower from a wrench up to the car on the road, with interactive 3D figures and charts.

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
| `src/article/` | The article: text, the figure shell and sliders, and one file per figure in `figures/`. |
| `src/article/gl/` | Shared WebGL pieces: studio environment, glowing arrows, the car loader. |
| `src/ui/` | The hub's 3D scene and the drawn fallback used without WebGL. |
| `src/pages/` | The hub page. |
| `public/fonts/` | Self-hosted Archivo variable font. |

## The 3D model

`public/models/z.glb` is [2020 Nissan Z Proto Concept](https://sketchfab.com/3d-models/2020-nissan-z-proto-concept-03606ad387374824af0df58b6ca5f574) by [Ddiaz Design](https://sketchfab.com/ddiaz-design), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The licence allows non-commercial use only, and adapted versions of the model must carry the same licence. The model was run through `gltf-transform optimize --compress meshopt` (9.9 MB to 2.2 MB, 188k triangles). `public/models/z-lite.glb` is the same model simplified to 57k triangles for the race figures. The model keeps its own materials, with the paint replaced by a clear-coated Ikazuchi yellow; the merged wheel mesh is split into four so each wheel turns on its own axle. Each figure has its own WebGL canvas inside the page, mounted only while it is within about a screen of the viewport, so the 3D scrolls exactly with the text and only a few GPU contexts are live at once.

## Deploying

The site is a static Vite build with an SPA rewrite in `vercel.json`. Import the repo in Vercel (framework: Vite) and every push deploys.
