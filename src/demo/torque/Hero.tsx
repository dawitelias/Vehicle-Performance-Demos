import { useEffect, useRef, useState } from 'react'
import { ZContour } from '../../ui/ZContour'
import { ZScene, hasWebGL } from '../../ui/ZScene'

/** Wheels turn slowly, as if the car were rolling at walking pace. */
function useIdleWheels() {
  const [angle, setAngle] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setAngle((a) => a + dt * 0.5)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  return angle
}

export function Hero() {
  const [webgl] = useState(() => hasWebGL())
  const angle = useIdleWheels()
  const drawing = <ZContour wheelAngle={angle} className="hero-car-svg" />
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
      <div className="hero-car">{webgl ? <ZScene view="hero" wheelAngle={angle} className="hero-scene" fallback={drawing} /> : drawing}</div>
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
