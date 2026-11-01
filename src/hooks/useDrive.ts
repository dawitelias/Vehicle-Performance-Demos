import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRun, type RunState } from '../sim/longitudinal'
import type { Vehicle } from '../sim/vehicles'
import type { CurveMode } from '../sim/engine'
import { mphFromMps } from '../sim/units'

/**
 * A car you drive in real time: hold the throttle, tap the paddles. Fixed
 * 5 ms physics steps inside each animation frame. Reports shift and limiter
 * events for sound and haptics.
 */
export interface DriveEvents {
  onShift?: (gear: number) => void
  onLimiter?: () => void
  onLaunch?: () => void
}

export interface Drive {
  state: RunState
  mph: number
  holding: boolean
  hold: () => void
  release: () => void
  shiftUp: () => void
  shiftDown: () => void
  reset: () => void
  /** best 0–60 seen since the last reset, s */
  zeroToSixty: number | null
}

const DT = 0.005

export function useDrive(vehicle: Vehicle, opts: { curveMode?: CurveMode; autoShift?: boolean }, events: DriveEvents = {}): Drive {
  const run = useMemo(() => createRun(vehicle, { dt: DT, dyno: opts.curveMode ?? 'rated', shiftStrategy: opts.autoShift ? 'auto' : 'hold', shiftRpm: 'optimal' }), [vehicle, opts.curveMode, opts.autoShift])
  const [state, setState] = useState<RunState>(() => ({ ...run.state }))
  const [holding, setHolding] = useState(false)
  const [zeroToSixty, setZeroToSixty] = useState<number | null>(null)
  const holdRef = useRef(false)
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
        run.step(DT, { throttle: thr, shiftUp: pendingUp.current, shiftDown: pendingDown.current })
        pendingUp.current = false
        pendingDown.current = false
        if (s.gear !== lastGear.current) {
          lastGear.current = s.gear
          ev.current.onShift?.(s.gear)
        }
        if (s.onLimiter && !wasLimiter.current) ev.current.onLimiter?.()
        wasLimiter.current = s.onLimiter
        if (launchT.current !== null && mphFromMps(s.v) >= 60) {
          setZeroToSixty((z) => z ?? s.t - launchT.current!)
        }
      }
      setState({ ...run.state })
      const s = run.state
      const idle = !holdRef.current && s.v < 0.05 && !s.shifting
      if (idle) {
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
    setHolding(false)
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

  return { state, mph: mphFromMps(state.v), holding, hold, release, shiftUp, shiftDown, reset, zeroToSixty }
}
