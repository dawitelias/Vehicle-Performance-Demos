import { useEffect, useState } from 'react'
import { zSprite } from '../ui/zSprite'

/** The side-on sprite of the real model as a data URL, or null until it exists. */
export function useZSprite(): string | null {
  const [href, setHref] = useState<string | null>(null)
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
