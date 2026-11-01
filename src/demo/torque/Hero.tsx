import { useEffect, useRef, useState } from 'react'
import { ZContour } from '../../ui/ZContour'

export function Hero() {
  const [angle, setAngle] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let last = performance.now()
    const tick = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      setAngle((a) => a + dt * 0.6)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
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
      <div className="hero-car">
        <ZContour wheelAngle={angle} className="hero-car-svg" />
      </div>
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
