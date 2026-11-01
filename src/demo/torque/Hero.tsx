import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ZContour } from '../../ui/ZContour'
import { useModelAvailable } from '../../hooks/useModelAvailable'
import { useNarrow } from '../../hooks/useNarrow'

const ZModel = lazy(() => import('../../ui/ZModel'))

const LABELS = [
  { x: 96, y: 72, text: 'VR30DDTT, 3.0-litre twin-turbo V6', color: '#d9a441' },
  { x: 404, y: 340, text: 'Six-speed manual, 3.538 final drive' },
  { x: 0, y: 600, text: '275/35R19 rear, 784 turns a mile' },
  { x: 770, y: 600, text: 'Four-piston calipers, 355 mm discs' },
]

/** Eases the exploded drawing open after the page settles, then idles the wheels. */
function useExplode() {
  const [t, setT] = useState(0)
  const [angle, setAngle] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setT(1)
      return
    }
    const t0 = performance.now() + 500
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const p = Math.min(1, Math.max(0, (now - t0) / 1800))
      setT(1 - Math.pow(1 - p, 3))
      setAngle((a) => a + dt * 0.35)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  return { t, angle }
}

export function Hero() {
  const { t, angle } = useExplode()
  const has3d = useModelAvailable()
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>(700)
  const drawing = <ZContour wheelAngle={angle} exploded={t} labels={narrow ? undefined : LABELS} className="hero-car-svg" />
  return (
    <section>
      <div className="wrap hero">
        <h1 className="display display-xl">
          Torque and
          <br />
          horsepower.
        </h1>
        <p className="lede measure">One engine. Two numbers. Here is what each one actually does, worked out on the car you drive.</p>
      </div>
      <div className="hero-car" ref={wrapRef}>{has3d ? <Suspense fallback={drawing}><ZModel className="hero-car-3d" /></Suspense> : drawing}</div>
      <div className="wrap hero-facts">
        <div className="hero-fact">
          <span className="num">400</span>
          <span className="small">horsepower at 6,400 rpm</span>
        </div>
        <div className="hero-fact">
          <span className="num">350</span>
          <span className="small">lb-ft from 1,600 to 5,200 rpm</span>
        </div>
        <div className="hero-fact">
          <span className="num">6</span>
          <span className="small">gears, by hand</span>
        </div>
        <div className="hero-fact">
          <span className="num">3,536</span>
          <span className="small">pounds at the kerb</span>
        </div>
      </div>
    </section>
  )
}
