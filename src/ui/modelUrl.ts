/**
 * Where the glTF lives. Normally it ships with the site at /models/z.glb. An
 * inline (git-less) Vercel deployment can't carry a 2 MB binary, and the SPA
 * rewrite would answer that path with index.html, so if the local file isn't a
 * real model we fall back to the committed copy on GitHub.
 */
const LOCAL = '/models/z.glb'
const REMOTE = 'https://raw.githubusercontent.com/dawitelias/Vehicle-Performance-Demos/torque-vs-horsepower/public/models/z.glb'

let promise: Promise<string> | null = null

export function resolveModelUrl(): Promise<string> {
  if (promise) return promise
  promise = fetch(LOCAL, { method: 'HEAD' })
    .then((r) => {
      const ct = r.headers.get('content-type') ?? ''
      return r.ok && !ct.includes('text/html') ? LOCAL : REMOTE
    })
    .catch(() => REMOTE)
  return promise
}
