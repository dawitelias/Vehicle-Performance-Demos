import { useEffect, useRef, useState, type RefObject } from 'react'

/** True when the referenced element is narrower than `px`. For picking a phone-sized SVG drawing. */
export function useNarrow<T extends Element>(px = 560): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < px))
    ro.observe(el)
    return () => ro.disconnect()
  }, [px])
  return [ref, narrow]
}
