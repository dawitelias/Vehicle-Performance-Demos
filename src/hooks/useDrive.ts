import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRun, type RunState } from '../sim/longitudinal'
import type { Vehicle } from '../sim/vehicles'
import type { CurveMode } from '../sim/engine'
import { mphFromMps } from '../sim/units'

/**
 * A car you drive in real time: hold the throttle, hold the brake, tap to
 * shift. Fixed 5 ms physics steps inside each animation frame. With both
 * pedals released the engine brakes the car down to idle speed in the current
 * gear; below that the clutch is treated as pressed and the car coasts.
 */
export interface DriveEvents {
  onShift?: (gear: number) => void
  onLimiter?: () => void
  onLaunch?: () => void
}

export interface DriveOptions {
  curveMode?: CurveMode
  autoShift?: boolean
  startGear?: number
  startSpeedMps?: number
}

export interface Drive {
  state: RunState
  mph: number
  /** longitudinal acceleration in g (negative when slowing) */
  g: number
  holding: boolean
  braking: boolean
  hold: () => void
  release: () => void
  brake: () => void
  releaseBrake: () => void
  shiftUp: () => void
  shiftDown: () => void
  reset: () => void
  /** 0–60 mph time of the current run, s */
  zeroToSixty: number | null
}

const DT = 0.005

export function useDrive(vehicle: Vehicle, opts: DriveOptions, events: DriveEvents = {}): Drive {
  const { curveMode = 'rated', autoShift = false, startGear = 1, startSpeedMps = 0 } = opts
  const run = useMemo(
    () => createRun(vehicle, { dt: DT, dyno: curveMode, shiftStrategy: autoShift ? 'auto' : 'hold', shiftRpm: 'optimal', startGear, startSpeedMps }),
    [vehicle, curveMode, autoShift, startGear, startSpeedMps],
  )
  const [state, setState] = useState<RunState>(() => ({ ...run.state }))
  const [holding, setHolding] = useState(false)
  const [braking, setBraking] = useState(false)
  const [zeroToSixty, setZeroToSixty] = useState<number | null>(null)
  const holdRef = useRef(false)
  const brakeRef = useRef(false)
  const pendingUp = useRef(false)
  const pendingDown = useRef(false)
  const raf = useRef(0)
  const last = useRef(0)
  const acc = useRef(0)
  const launchT = useRef<number | null>(null)
  const wasLimiter = useRef(false)
  const lastGear = useRef(run.state.gear)
  const ev = useRef(events)
  ev.current = events

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const frame = useCallback(
    (now: number) => {
      const wall = Math.min(0.06, (now - last.current) / 1000 || 0)
      last.current = now
      acc.current += wall
      while (acc.current >= DT) {
        acc.current -= DT
        const s = run.state
        const thr = holdRef.current ? 1 : 0
        if (thr > 0 && s.v < 0.1 && launchT.current === null) {
          launchT.current = s.t
          ev.current.onLaunch?.()
        }
        run.step(DT, { throttle: thr, brake: brakeRef.current ? 1 : 0, shiftUp: pendingUp.current, shiftDown: pendingDown.current })
        pendingUp.current = false
        pendingDown.current = false
        if (s.gear !== lastGear.current) {
          lastGear.current = s.gear
          ev.current.onShift?.(s.gear)
        }
        if (s.onLimiter && !wasLimiter.current) ev.current.onLimiter?.()
        wasLimiter.current = s.onLimiter
        if (launchT.current !== null && mphFromMps(s.v) >= 60) {
          const t0 = launchT.current
          setZeroToSixty((z) => z ?? s.t - t0)
        }
      }
      setState({ ...run.state })
      const s = run.state
      if (!holdRef.current && !s.shifting && s.v < 0.05) {
        stop()
        return
      }
      raf.current = requestAnimationFrame(frame)
    },
    [run, stop],
  )

  const start = useCallback(() => {
    if (raf.current) return
    last.current = performance.now()
    raf.current = requestAnimationFrame(frame)
  }, [frame])

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
  const brake = useCallback(() => {
    brakeRef.current = true
    setBraking(true)
    start()
  }, [start])
  const releaseBrake = useCallback(() => {
    brakeRef.current = false
    setBraking(false)
  }, [])
  const shiftUp = useCallback(() => {
    pendingUp.current = true
    start()
  }, [start])
  const shiftDown = useCallback(() => {
    pendingDown.current = true
    start()
  }, [start])
  const reset = useCallback(() => {
    stop()
    run.reset()
    holdRef.current = false
    brakeRef.current = false
    setHolding(false)
    setBraking(false)
    launchT.current = null
    lastGear.current = run.state.gear
    wasLimiter.current = false
    setZeroToSixty(null)
    setState({ ...run.state })
  }, [run, stop])

  useEffect(() => {
    reset()
  }, [reset])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return { state, mph: mphFromMps(state.v), g: state.a / 9.80665, holding, braking, hold, release, brake, releaseBrake, shiftUp, shiftDown, reset, zeroToSixty }
}
