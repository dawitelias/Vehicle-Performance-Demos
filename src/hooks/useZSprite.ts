import { useEffect, useState } from 'react'
import { zSprite, type ZSprite } from '../ui/zSprite'

/** Side-on renders of the real model, or null until they exist (or if WebGL is unavailable). */
export function useZSprite(): ZSprite | null {
  const [href, setHref] = useState<ZSprite | null>(null)
  useEffect(() => {
    let live = true
    zSprite().then((d) => {
      if (live) setHref(d)
    })
    return () => {
      live = false
    }
  }, [])
  return href
}
