import { useCallback, useEffect, useRef, useState } from 'react'
import { createBoostState, engineTorque, stepBoost, torqueAt, resolveCurve, type Engine, type CurveMode } from '../sim/engine'
import { hpFromTorqueRpm, nmFromLbft, radPerSecFromRpm, rpmFromRadPerSec } from '../sim/units'

/**
 * A free-revving engine for the chapters that only care about the engine,
 * not the car. The crank spins against an effective inertia chosen so a
 * full-throttle sweep from 1,000 rpm to the limiter takes a few seconds
 * (roughly the feel of second gear), and a speed-proportional friction term
 * so a closed throttle brings the revs back down in two or three seconds.
 * Torque, turbo lag and the soft limiter come from the real engine model.
 */
export interface FreeRevState {
  rpm: number
  throttle: number
  tq: number
  hp: number
  boost: number
  onLimiter: boolean
}

export interface FreeRev extends FreeRevState {
  hold: () => void
  release: () => void
  setRpm: (rpm: number) => void
  holding: boolean
}

const EFFECTIVE_INERTIA = 2.0 // kg·m²
const FRICTION_NM_PER_RPM = 0.04
const MIN_RPM = 1000

export function useFreeRev(engine: Engine, curveMode: CurveMode = 'rated', initialRpm = 3200): FreeRev {
  const [state, setState] = useState<FreeRevState>(() => snap(engine, curveMode, initialRpm, 0, 0))
  const [holding, setHolding] = useState(false)
  const rpmRef = useRef(initialRpm)
  const holdRef = useRef(false)
  const boostRef = useRef(createBoostState(0))
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const activeRef = useRef(false)

  const loop = useCallback(
    (t: number) => {
      const dt = Math.min(0.05, (t - lastRef.current) / 1000 || 0)
      lastRef.current = t
      const thr = holdRef.current ? 1 : 0
      const rpm = rpmRef.current
      stepBoost(engine, boostRef.current, thr, dt)
      const tqNet = engineTorque(engine, rpm, thr, { curveMode, boost: boostRef.current })
      const friction = FRICTION_NM_PER_RPM * rpm
      const alpha = (nmFromLbft(tqNet) - friction) / EFFECTIVE_INERTIA
      let w = radPerSecFromRpm(rpm) + alpha * dt
      let next = rpmFromRadPerSec(w)
      if (next < MIN_RPM) next = MIN_RPM
      if (next > engine.limiterRpm + 60) next = engine.limiterRpm + 60
      rpmRef.current = next
      setState(snap(engine, curveMode, next, thr, boostRef.current.boost))
      const settled = !holdRef.current && next <= MIN_RPM + 0.5
      if (settled) {
        activeRef.current = false
        rafRef.current = 0
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    },
    [engine, curveMode],
  )

  const start = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const hold = useCallback(() => {
    holdRef.current = true
    setHolding(true)
    start()
  }, [start])

  const release = useCallback(() => {
    holdRef.current = false
    setHolding(false)
    start()
  }, [start])

  const setRpm = useCallback(
    (rpm: number) => {
      rpmRef.current = Math.max(MIN_RPM, Math.min(engine.limiterRpm, rpm))
      boostRef.current.boost = 1
      setState(snap(engine, curveMode, rpmRef.current, holdRef.current ? 1 : 0, 1))
    },
    [engine, curveMode],
  )

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return { ...state, hold, release, setRpm, holding }
}

function snap(engine: Engine, curveMode: CurveMode, rpm: number, throttle: number, boost: number): FreeRevState {
  const curve = resolveCurve(engine, curveMode)
  const tq = torqueAt(curve, rpm)
  return { rpm, throttle, tq, hp: hpFromTorqueRpm(tq, rpm), boost, onLimiter: rpm >= engine.limiterRpm - 100 }
}
