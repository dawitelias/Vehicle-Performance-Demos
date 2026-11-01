import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRun, type Run, type RunState, type SimOptions } from '../sim/longitudinal'
import type { Vehicle } from '../sim/vehicles'
import { mphFromMps } from '../sim/units'

/**
 * Runs several cars side by side in real time, full throttle, until each
 * reaches `finishMph` (or `finishM` metres). Fixed 5 ms physics steps are
 * taken inside each animation frame so results match the batch simulator.
 */
export interface Racer {
  id: string
  label: string
  vehicle: Vehicle
  options?: SimOptions
}

export interface RacerSnapshot {
  id: string
  label: string
  state: RunState
  mph: number
  finishedAt: number | null
  finishedX: number | null
}

export interface Race {
  racers: RacerSnapshot[]
  t: number
  running: boolean
  done: boolean
  /** Positions (m) and speeds (mph) of every car at the moment the first car finished. */
  atFirstFinish: { t: number; x: number[]; mph: number[] } | null
  start: () => void
  reset: () => void
}

const DT = 0.005

export function useRace(racers: Racer[], opts: { finishMph?: number; finishM?: number; timeScale?: number; maxTimeS?: number }): Race {
  const runs = useMemo(() => racers.map((r) => createRun(r.vehicle, { dt: DT, ...r.options })), [racers])
  const finishedAt = useRef<(number | null)[]>(racers.map(() => null))
  const finishedX = useRef<(number | null)[]>(racers.map(() => null))
  const [snap, setSnap] = useState<RacerSnapshot[]>(() => snapshot(racers, runs, finishedAt.current, finishedX.current))
  const [t, setT] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [atFirstFinish, setAtFirstFinish] = useState<Race['atFirstFinish']>(null)
  const firstFinishRef = useRef<Race['atFirstFinish']>(null)
  const raf = useRef(0)
  const last = useRef(0)
  const acc = useRef(0)
  const tRef = useRef(0)
  const timeScale = opts.timeScale ?? 1
  const maxT = opts.maxTimeS ?? 30

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    runs.forEach((r) => r.reset())
    finishedAt.current = racers.map(() => null)
    finishedX.current = racers.map(() => null)
    acc.current = 0
    tRef.current = 0
    firstFinishRef.current = null
    setAtFirstFinish(null)
    setT(0)
    setDone(false)
    setSnap(snapshot(racers, runs, finishedAt.current, finishedX.current))
  }, [racers, runs, stop])

  const frame = useCallback(
    (now: number) => {
      const wall = Math.min(0.06, (now - last.current) / 1000 || 0) * timeScale
      last.current = now
      acc.current += wall
      let allDone = true
      while (acc.current >= DT) {
        acc.current -= DT
        tRef.current += DT
        runs.forEach((run: Run, i) => {
          const s = run.state
          if (finishedAt.current[i] !== null) {
            // finished: cruise on at constant speed so gaps stay physical
            s.x += s.v * DT
            s.t += DT
            return
          }
          run.step(DT, { throttle: 1 })
          const mph = mphFromMps(s.v)
          const hitSpeed = opts.finishMph !== undefined && mph >= opts.finishMph
          const hitDist = opts.finishM !== undefined && s.x >= opts.finishM
          if (hitSpeed || hitDist || s.t >= maxT) {
            finishedAt.current[i] = tRef.current
            finishedX.current[i] = s.x
            if (!firstFinishRef.current) {
              firstFinishRef.current = { t: tRef.current, x: runs.map((r) => r.state.x), mph: runs.map((r) => mphFromMps(r.state.v)) }
              setAtFirstFinish(firstFinishRef.current)
            }
          }
        })
      }
      runs.forEach((_, i) => {
        if (finishedAt.current[i] === null) allDone = false
      })
      setT(tRef.current)
      setSnap(snapshot(racers, runs, finishedAt.current, finishedX.current))
      if (allDone) {
        setDone(true)
        stop()
        return
      }
      raf.current = requestAnimationFrame(frame)
    },
    [runs, racers, opts.finishMph, opts.finishM, maxT, timeScale, stop],
  )

  const start = useCallback(() => {
    if (raf.current) return
    if (done) reset()
    setRunning(true)
    last.current = performance.now()
    raf.current = requestAnimationFrame(frame)
  }, [frame, done, reset])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return { racers: snap, t, running, done, atFirstFinish, start, reset }
}

function snapshot(racers: Racer[], runs: Run[], fa: (number | null)[], fx: (number | null)[]): RacerSnapshot[] {
  return racers.map((r, i) => ({ id: r.id, label: r.label, state: { ...runs[i].state }, mph: mphFromMps(runs[i].state.v), finishedAt: fa[i], finishedX: fx[i] }))
}
