import { useEffect, useRef, useState } from 'react'
import { ZContour } from '../../ui/ZContour'
import { ZScene, hasWebGL } from '../../ui/ZScene'
import { useNarrow } from '../../hooks/useNarrow'

const LABELS: { text: string; at: [number, number, number]; color?: string }[] = [
  { text: 'VR30DDTT, 3.0-litre twin-turbo V6', at: [0.3, 1.8, 1.5], color: '#d9a441' },
  { text: 'Six-speed manual, 3.538 final drive', at: [0.4, -0.45, -0.2] },
  { text: '275/35R19 rear, 784 turns a mile', at: [-2.7, 0.2, -1.5] },
]

/**
 * The exploded view is driven by scrolling: assembled while the hero sits under
 * the headline, pulled apart as the reader scrolls it upward. The wheels idle
 * slowly the whole time.
 */
function useExplode(ref: { current: HTMLElement | null }) {
  const [t, setT] = useState(0)
  const [angle, setAngle] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const measure = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when the scene's top is at 70% of the viewport height, 1 when it reaches 15%
      const p = (vh * 0.7 - r.top) / (vh * 0.55)
      setT(Math.min(1, Math.max(0, p)))
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    if (!reduce) {
      let last = performance.now()
      const tick = (now: number) => {
        const dt = (now - last) / 1000
        last = now
        setAngle((a) => a + dt * 0.5)
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      cancelAnimationFrame(raf.current)
    }
  }, [ref])
  return { t, angle }
}

export function Hero() {
  const [webgl] = useState(() => hasWebGL())
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>(700)
  const { t, angle } = useExplode(wrapRef)
  const drawing = <ZContour wheelAngle={angle} exploded={t} className="hero-car-svg" />
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
      <div className="hero-car" ref={wrapRef}>{webgl ? <ZScene view="hero" wheelAngle={angle} exploded={t} labels={narrow ? undefined : LABELS} className="hero-scene" fallback={drawing} /> : drawing}</div>
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
