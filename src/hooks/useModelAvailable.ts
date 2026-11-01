import { useEffect, useState } from 'react'

/**
 * True once a 3D model is known to exist at `url`. The SPA rewrite answers
 * every missing path with index.html, so a 200 alone is not enough; the
 * response has to be a binary, not HTML.
 */
export function useModelAvailable(url = '/models/z.glb'): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(url, { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') ?? ''
        const len = Number(r.headers.get('content-length') ?? 0)
        if (!cancelled) setOk(r.ok && !ct.includes('text/html') && (len === 0 || len > 10_000))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [url])
  return ok
}
