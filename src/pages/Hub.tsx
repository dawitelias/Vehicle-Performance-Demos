import { useEffect, useRef, useState } from 'react'
import { Link } from '../app/router'
import { ZContour } from '../ui/ZContour'
import { ZScene, hasWebGL } from '../ui/ZScene'
import './Hub.css'

const demos = [
  {
    to: '/torque-vs-horsepower',
    title: 'Torque and horsepower',
    line: 'What each number measures, and when each one decides how your car accelerates.',
    status: 'Long read with interactive figures',
  },
]

export function Hub() {
  const [angle, setAngle] = useState(0)
  const [webgl] = useState(() => hasWebGL())
  const raf = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
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
    <main className="page">
      <header className="wrap nav">
        <span className="brand">Vehicle Performance Demos</span>
        <span>2024 Nissan Z, 6MT</span>
      </header>
      <section className="wrap hub-hero">
        <h1 className="display display-l">Vehicle performance, worked out on a 2024 Nissan Z</h1>
        <p className="lede measure">Interactive articles on how cars accelerate, using the published figures for a Nissan Z Performance with the six-speed manual.</p>
      </section>
      <div className="hub-car">
        {webgl ? <ZScene view="hero" wheelAngle={angle} className="hub-scene" fallback={<ZContour wheelAngle={angle} className="hub-car-svg" />} /> : <ZContour wheelAngle={angle} className="hub-car-svg" />}
      </div>
      <section className="wrap hub-list">
        {demos.map((d) => (
          <Link key={d.to} to={d.to} className="hub-item">
            <span className="hub-item-title display display-m">{d.title}</span>
            <span className="hub-item-line body">{d.line}</span>
            <span className="hub-item-status small">{d.status}</span>
            <span className="hub-item-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
        <hr className="rule" />
        <p className="small hub-foot">More articles will follow. They all use the same engine, gearbox and tyre data, so their numbers agree with each other.</p>
      </section>
    </main>
  )
}
