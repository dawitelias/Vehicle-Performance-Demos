/**
 * Longitudinal (straight-line) vehicle simulator.
 *
 * Two entry points:
 *  - `createRun(vehicle, opts)` → a stepper `{ state, step(dt, inputs) }` for
 *    real-time use (UI at 60 fps with throttle button + shift paddles).
 *  - `simulate(vehicle, opts)` → runs the stepper for a fixed duration with a
 *    scripted throttle and automatic shifting, returning a full trace plus
 *    derived metrics (0–60, ¼ mile, 60–130, …).
 *
 * Model summary (details and sources in README.md):
 *  - Point-mass vehicle; forces: tyre thrust, aero drag ½ρCdAv², rolling
 *    resistance Crr·m·g.
 *  - Prime mover: ICE torque curve × throttle × turbo-lag factor × soft
 *    limiter, or EV constant-torque/constant-power motor.
 *  - Rotating inertia via Gillespie mass factor 1 + 0.04 + k·N² per gear.
 *  - Traction: F_max = μ · dynamic driven-axle load, with longitudinal load
 *    transfer m·a·h/L solved by 3 fixed-point iterations per step. When the
 *    engine could deliver more than the tyres can take, the car accelerates at
 *    (F_trac − R)/m (the surplus spins the rotating parts: wheelspin/clutch
 *    slip metered by the driver); otherwise at (F_eng − R)/m_eff.
 *  - Launch: clutch slips with the engine held at `launchRpm` until the wheel
 *    speed catches up, then locks. Gear changes open the clutch for
 *    `shiftTimeS` with zero thrust; the turbo de-spools meanwhile.
 *  - Semi-implicit Euler at dt = 5 ms by default. Deterministic.
 */
import type { CurveMode } from './engine'
import { boostFactor, createBoostState, engineBrakingTorque, engineTorque, peakTorque, resolveCurve, stepBoost } from './engine'
import type { BoostState } from './engine'
import { effectiveMassFactor, idleRpm, limiterRpm, optimalShiftPoints, overallRatios, resistanceForce, rpmFromSpeed, speedFromRpm } from './drivetrain'
import { G, clamp, hpFromTorqueRpm, lerp, mFromFeet, mphFromMps, mpsFromMph, nmFromLbft } from './units'
import type { Vehicle } from './vehicles'
import { simMassKg } from './vehicles'

// ---------------------------------------------------------------------------
// Options & state
// ---------------------------------------------------------------------------

export type ShiftRpmOption = number | number[] | 'optimal' | 'limiter'
export type ThrottleOption = number | ((t: number, state: Readonly<RunState>) => number)

export interface SimOptions {
  /** Integration step, s. Default 0.005. */
  dt?: number
  /** Simulated duration for `simulate`, s. Default 30. */
  duration?: number
  /** Initial road speed, m/s. Default 0 (standing start). */
  startSpeedMps?: number
  /** Initial gear, 1-based. Default 1. */
  startGear?: number
  /**
   * Automatic up-shift point(s). 'optimal' (default) uses optimalShiftPoints,
   * 'limiter' shifts at the fuel cut, a number applies to every gear and an
   * array gives one value per gear.
   */
  shiftRpm?: ShiftRpmOption
  /** Scripted throttle for `simulate` (0..1 or a function of time and state). Default 1. */
  throttle?: ThrottleOption
  /** 'auto' (default) up-shifts at `shiftRpm`; 'hold' never shifts on its own (stepper paddles still work). */
  shiftStrategy?: 'auto' | 'hold'
  /** Engine speed held while the clutch slips off the line. Default: vehicle's launchRpm. */
  launchRpm?: number
  /** Torque curve to use for ICE vehicles. Default 'rated'. */
  dyno?: CurveMode
  /** Override turbo-lag on/off (default: the engine's own setting). */
  turboLag?: boolean
  /** Override tyre friction coefficient (default: the chassis value). */
  mu?: number
  /** Override the top-speed governor in mph (0 or undefined → vehicle setting; Infinity → none). */
  topSpeedGovernorMph?: number
}

export type ClutchState = 'locked' | 'slipping' | 'open'

export interface RunState {
  /** Elapsed time, s. */
  t: number
  /** Road speed, m/s. */
  v: number
  /** Distance travelled, m. */
  x: number
  /** Acceleration, m/s². */
  a: number
  /** Engine (or motor) speed, rpm. */
  rpm: number
  /** Current gear, 1-based (always 1 for an EV). */
  gear: number
  /** Net longitudinal tyre force actually transmitted, N. */
  wheelForce: number
  /** Net crank/motor torque, lb-ft (negative = engine braking / regen). */
  engineTorqueLbft: number
  /** Crank/motor power, hp (negative when braking). */
  engineHp: number
  /** Throttle actually applied this step (0..1). */
  throttle: number
  /** Turbo boost availability 0..1 (1 for NA/EV). */
  boost: number
  /** Resistance (drag + rolling), N. */
  resistance: number
  /** Traction-limited this step (tyres at μ·Fz; surplus engine torque is being wasted). */
  tractionLimited: boolean
  /** Soft fuel-cut is reducing torque this step. */
  onLimiter: boolean
  /** Top-speed governor is reducing torque this step. */
  governed: boolean
  clutch: ClutchState
  /** A gear change is in progress (clutch open). */
  shifting: boolean
  /** Time left in the current gear change, s. */
  shiftTimeLeft: number
  /** Gear that will be engaged when the current shift completes. */
  targetGear: number
  /** Still in the standing-start clutch-slip phase. */
  launching: boolean
  /** Number of completed gear changes. */
  shiftCount: number
}

export interface RunInputs {
  /** Throttle 0..1. */
  throttle: number
  /** Request an up-shift this step (edge-triggered by the caller). */
  shiftUp?: boolean
  /** Request a down-shift this step. Ignored if it would over-rev the engine. */
  shiftDown?: boolean
  /** Clutch pedal 0 (engaged) .. 1 (fully depressed). > 0.5 opens the clutch (engine free-revs). */
  clutch?: number
  /** Brake pedal 0..1. Full braking decelerates at about 1 g on these tyres. */
  brake?: number
}

export interface Run {
  readonly vehicle: Vehicle
  readonly state: RunState
  /** Resolved per-gear shift points used by the automatic strategy, rpm. */
  readonly shiftPoints: number[]
  /** Advance the simulation by dt seconds with the given inputs. */
  step(dt: number, inputs: RunInputs): void
  /** Reset to the initial conditions. */
  reset(): void
}

/** Up-shift is triggered this many rpm below the configured shift point so the soft limiter never eats thrust first. */
export const SHIFT_TRIGGER_TOLERANCE_RPM = 25
/** Soft fuel-cut window width, rpm. */
export const LIMITER_WINDOW_RPM = 50
/** Governor fades thrust to zero over this speed window below the set point, m/s. */
export const GOVERNOR_WINDOW_MPS = 0.5
/** Fixed-point iterations for the load-transfer / traction solve per step. */
export const TRACTION_ITERATIONS = 3

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

export function resolveShiftPoints(vehicle: Vehicle, option: ShiftRpmOption | undefined, curveMode: CurveMode): number[] {
  const n = overallRatios(vehicle).length
  const lim = limiterRpm(vehicle)
  if (option === undefined || option === 'optimal') return optimalShiftPoints(vehicle, curveMode)
  if (option === 'limiter') return new Array<number>(n).fill(lim)
  if (typeof option === 'number') return new Array<number>(n).fill(Math.min(option, lim))
  if (option.length !== n) throw new Error(`shiftRpm array must have ${n} entries`)
  return option.map((r) => Math.min(r, lim))
}

export function createRun(vehicle: Vehicle, opts: SimOptions = {}): Run {
  const pt = vehicle.powertrain
  const ch = vehicle.chassis
  const curveMode: CurveMode = opts.dyno ?? 'rated'
  const ratios = overallRatios(vehicle)
  const nGears = ratios.length
  const mass = simMassKg(vehicle)
  const mEff = ratios.map((_, i) => mass * effectiveMassFactor(vehicle, i))
  const r = ch.tireRadiusM
  const mu = opts.mu ?? ch.mu
  const lim = limiterRpm(vehicle)
  const idle = idleRpm(vehicle)
  const shiftPoints = resolveShiftPoints(vehicle, opts.shiftRpm, curveMode)
  const autoShift = (opts.shiftStrategy ?? 'auto') === 'auto'
  const governorMph = opts.topSpeedGovernorMph || vehicle.topSpeedGovernorMph
  const vGov = governorMph !== undefined && isFinite(governorMph) ? mpsFromMph(governorMph) : Infinity
  const startGear = clamp(Math.round(opts.startGear ?? 1), 1, nGears)
  const startV = Math.max(0, opts.startSpeedMps ?? 0)
  const wStaticRear = mass * G * (1 - ch.frontWeightFraction)
  const wStaticFront = mass * G * ch.frontWeightFraction
  const transferPerAccel = (mass * ch.cgHeightM) / ch.wheelbaseM // N per m/s²

  // ICE-specific
  const engine = pt.kind === 'ice' ? pt.engine : undefined
  const curve = engine ? resolveCurve(engine, curveMode) : undefined
  const peakLbft = curve ? peakTorque(curve).value : 0
  const launchRpm = pt.kind === 'ice' ? Math.max(opts.launchRpm ?? pt.launchRpm, pt.engine.idleRpm) : 0
  const shiftTime = pt.kind === 'ice' ? pt.shiftTimeS : 0
  const engineForTorque = engine
    ? {
        ...engine,
        curve: curve!,
        turbo: engine.turbo ? { ...engine.turbo, enabled: opts.turboLag ?? engine.turbo.enabled } : undefined,
      }
    : undefined
  const inertia = engine?.inertiaKgM2 ?? 0.25

  const boost: BoostState = createBoostState(0)
  let shiftStartRpm = 0

  const state: RunState = makeInitialState()

  function makeInitialState(): RunState {
    const rpmWheel = rpmFromSpeed(startV, ratios[startGear - 1], 1, r)
    const launching = pt.kind === 'ice' && rpmWheel < idle
    return {
      t: 0,
      v: startV,
      x: 0,
      a: 0,
      rpm: pt.kind === 'ice' ? Math.max(rpmWheel, idle) : rpmWheel,
      gear: startGear,
      wheelForce: 0,
      engineTorqueLbft: 0,
      engineHp: 0,
      throttle: 0,
      boost: engineForTorque?.turbo?.enabled ? 0 : 1,
      resistance: resistanceForce(vehicle, startV),
      tractionLimited: false,
      onLimiter: false,
      governed: false,
      clutch: pt.kind === 'ice' ? (launching ? 'slipping' : 'locked') : 'locked',
      shifting: false,
      shiftTimeLeft: 0,
      targetGear: startGear,
      launching,
      shiftCount: 0,
    }
  }

  function reset(): void {
    Object.assign(state, makeInitialState())
    boost.boost = 0
    shiftStartRpm = 0
  }

  function startShift(toGear: number): void {
    state.shifting = true
    state.shiftTimeLeft = shiftTime
    state.targetGear = toGear
    shiftStartRpm = state.rpm
    state.clutch = 'open'
    state.launching = false
    if (shiftTime <= 0) completeShift()
  }

  function completeShift(): void {
    state.gear = state.targetGear
    state.shifting = false
    state.shiftTimeLeft = 0
    state.shiftCount++
    state.rpm = rpmFromSpeed(state.v, ratios[state.gear - 1], 1, r)
    state.clutch = 'locked'
  }

  /** Thrust the prime mover could deliver at the tyre this step (N, may be negative). Sets rpm/torque/boost on state. */
  function primeMoverForce(dt: number, thr: number, clutchPedal: number): number {
    const s = state
    const ratio = ratios[s.gear - 1]
    const rpmWheel = rpmFromSpeed(s.v, ratio, 1, r)

    if (pt.kind === 'ev') {
      s.rpm = rpmWheel
      s.clutch = 'locked'
      const limScale = clamp((pt.maxMotorRpm - s.rpm) / LIMITER_WINDOW_RPM, 0, 1)
      const avail = s.rpm <= 0 ? pt.motorTorqueLbft : Math.min(pt.motorTorqueLbft, (pt.maxPowerHp * 5252) / s.rpm)
      const drive = avail * thr * limScale
      const regen = s.v > 0.05 ? -pt.regenFraction * pt.motorTorqueLbft * (1 - thr) : 0
      s.engineTorqueLbft = drive + regen
      s.onLimiter = limScale < 1 && thr > 0
      s.boost = 1
      return (nmFromLbft(s.engineTorqueLbft) * ratio * pt.efficiency) / r
    }

    const eng = engineForTorque!
    // --- gear change in progress: clutch open, no thrust, turbo de-spools
    if (s.shifting) {
      s.shiftTimeLeft -= dt
      const frac = shiftTime > 0 ? clamp(1 - s.shiftTimeLeft / shiftTime, 0, 1) : 1
      const rpmTarget = rpmFromSpeed(s.v, ratios[s.targetGear - 1], 1, r)
      s.rpm = Math.max(eng.idleRpm, lerp(shiftStartRpm, rpmTarget, frac))
      stepBoost(eng, boost, 0, dt, true)
      s.boost = boost.boost
      s.engineTorqueLbft = engineBrakingTorque(peakLbft, s.rpm)
      s.onLimiter = false
      s.clutch = 'open'
      if (s.shiftTimeLeft <= 0) completeShift()
      return 0
    }

    // --- driver holding the clutch pedal: engine free-revs against its own inertia
    if (clutchPedal > 0.5) {
      s.clutch = 'open'
      s.launching = false
      const t = engineTorque(eng, s.rpm, thr, { boost, limiterWindowRpm: LIMITER_WINDOW_RPM })
      const alpha = nmFromLbft(t) / inertia // rad/s²
      s.rpm = clamp(s.rpm + (alpha * 60 * dt) / (2 * Math.PI), eng.idleRpm, eng.limiterRpm + 150)
      stepBoost(eng, boost, thr, dt, false)
      s.boost = boost.boost
      s.engineTorqueLbft = t
      s.onLimiter = s.rpm > eng.limiterRpm - LIMITER_WINDOW_RPM
      return 0
    }

    // --- clutch engaged: lock or slip
    const holdRpm = s.launching ? launchRpm : eng.idleRpm
    if (rpmWheel >= holdRpm) {
      s.launching = false
      s.clutch = 'locked'
      s.rpm = rpmWheel
    } else {
      s.clutch = 'slipping'
      s.rpm = holdRpm
    }
    let t = engineTorque(eng, s.rpm, thr, { boost, limiterWindowRpm: LIMITER_WINDOW_RPM })
    if (s.clutch === 'slipping') t = Math.max(t, 0) // a slipping clutch transmits no engine braking
    stepBoost(eng, boost, thr, dt, false)
    s.boost = boost.boost
    s.engineTorqueLbft = t
    s.onLimiter = thr > 0 && s.rpm > eng.limiterRpm - LIMITER_WINDOW_RPM
    return (nmFromLbft(t) * ratio * pt.efficiency) / r
  }

  function step(dt: number, inputs: RunInputs): void {
    const s = state
    const thr = clamp(inputs.throttle ?? 0, 0, 1)
    const clutchPedal = inputs.clutch ?? 0

    // 1. Gear-change requests (ICE only)
    if (pt.kind === 'ice' && !s.shifting) {
      const rpmWheelNow = rpmFromSpeed(s.v, ratios[s.gear - 1], 1, r)
      if (inputs.shiftUp && s.gear < nGears) {
        startShift(s.gear + 1)
      } else if (inputs.shiftDown && s.gear > 1) {
        const rpmAfter = rpmFromSpeed(s.v, ratios[s.gear - 2], 1, r)
        if (rpmAfter <= lim) startShift(s.gear - 1)
      } else if (autoShift && s.gear < nGears && thr > 0 && s.clutch !== 'open' && rpmWheelNow >= shiftPoints[s.gear - 1] - SHIFT_TRIGGER_TOLERANCE_RPM) {
        startShift(s.gear + 1)
      }
    }

    // 2. Resistance and available thrust
    const R = resistanceForce(vehicle, s.v)
    let fEng = primeMoverForce(dt, thr, clutchPedal)

    // 3. Top-speed governor (fades positive thrust to zero over the last 0.5 m/s)
    s.governed = false
    if (fEng > 0 && s.v > vGov - GOVERNOR_WINDOW_MPS) {
      const scale = clamp((vGov - s.v) / GOVERNOR_WINDOW_MPS, 0, 1)
      fEng *= scale
      s.governed = true
    }

    // 4. Traction limit with load transfer, fixed-point iteration on a.
    //    While the clutch slips the engine turns at constant speed, so only
    //    the wheels/driveline (the 0.04 share) add to the translational mass.
    const mE = s.clutch === 'slipping' ? mass * (1 + 0.04) : mEff[s.gear - 1]
    let a = s.a
    let tractionLimited = false
    let fTire = fEng
    for (let i = 0; i < TRACTION_ITERATIONS; i++) {
      let fz: number
      if (ch.drive === 'rwd') fz = wStaticRear + transferPerAccel * a
      else if (ch.drive === 'fwd') fz = wStaticFront - transferPerAccel * a
      else fz = mass * G
      const fTrac = mu * Math.max(fz, 0)
      if (fEng >= 0) {
        const aTrac = (fTrac - R) / mass
        const aEng = (fEng - R) / mE
        tractionLimited = aTrac < aEng
        a = tractionLimited ? aTrac : aEng
        fTire = tractionLimited ? fTrac : fEng
      } else {
        const aTrac = (-fTrac - R) / mass
        const aEng = (fEng - R) / mE
        tractionLimited = aEng < aTrac
        a = tractionLimited ? aTrac : aEng
        fTire = tractionLimited ? -fTrac : fEng
      }
    }

    // 4b. Brakes: a deceleration on top of whatever the engine is doing, never past a stop
    const brake = clamp(inputs.brake ?? 0, 0, 1)
    if (brake > 0 && s.v > 0) {
      const decel = brake * mu * 0.8 * G
      a -= decel
      fTire -= decel * mass
    }

    // 5. Integrate (semi-implicit Euler), no reversing
    let v = s.v + a * dt
    if (v < 0) {
      v = 0
      a = s.v > 0 ? -s.v / dt : 0
    }
    s.x += v * dt
    s.v = v
    s.a = a
    s.t += dt

    // 6. Book-keeping
    s.throttle = thr
    s.resistance = R
    s.wheelForce = fTire
    s.tractionLimited = tractionLimited
    s.engineHp = hpFromTorqueRpm(s.engineTorqueLbft, s.rpm)
    if (pt.kind === 'ice' && s.clutch === 'locked' && !s.shifting) {
      // keep rpm consistent with the new speed for display
      s.rpm = Math.max(rpmFromSpeed(s.v, ratios[s.gear - 1], 1, r), idle)
    }
  }

  return { vehicle, state, shiftPoints, step, reset }
}

// ---------------------------------------------------------------------------
// Batch simulation and derived metrics
// ---------------------------------------------------------------------------

export interface QuarterMile {
  /**
   * Elapsed time (ET) in the drag-strip convention: the clock starts when the
   * car has rolled 1 ft (the stage beam), which is also how published
   * magazine ¼-mile times are measured. s.
   */
  timeS: number
  /** Time from a true standstill (t = 0) to the finish line, s. ≈ timeS + 0.3. */
  timeFromRestS: number
  /** Trap speed: average speed over the last 66 ft, mph (drag-strip convention). */
  trapMph: number
  /** Instantaneous speed at the finish line, mph. */
  finishMph: number
}

export interface TraceMetrics {
  /** 0–60 mph from a true standstill, s (null if not reached). */
  zeroToSixtyS: number | null
  /** 0–60 mph with a 1-ft rollout (US magazine convention), s. */
  zeroToSixtyRolloutS: number | null
  zeroToHundredS: number | null
  sixtyToOneThirtyS: number | null
  quarterMile: QuarterMile | null
  eighthMile: QuarterMile | null
  /** Highest speed reached in the run, mph. */
  topSpeedMph: number
  /** Time at which the highest speed was first reached (within 0.1 mph), s. */
  timeToTopSpeedS: number
}

export interface Trace {
  vehicleId: string
  dt: number
  /** Number of samples (steps + 1). */
  length: number
  t: Float64Array
  /** m/s */
  v: Float64Array
  /** m */
  x: Float64Array
  /** m/s² */
  a: Float64Array
  rpm: Float64Array
  gear: Uint8Array
  /** N */
  wheelForce: Float64Array
  /** lb-ft */
  engineTorque: Float64Array
  engineHp: Float64Array
  throttle: Float64Array
  boost: Float64Array
  tractionLimited: Uint8Array
  metrics: TraceMetrics
}

function recordSample(tr: Trace, i: number, s: RunState): void {
  tr.t[i] = s.t
  tr.v[i] = s.v
  tr.x[i] = s.x
  tr.a[i] = s.a
  tr.rpm[i] = s.rpm
  tr.gear[i] = s.gear
  tr.wheelForce[i] = s.wheelForce
  tr.engineTorque[i] = s.engineTorqueLbft
  tr.engineHp[i] = s.engineHp
  tr.throttle[i] = s.throttle
  tr.boost[i] = s.boost
  tr.tractionLimited[i] = s.tractionLimited ? 1 : 0
}

/** Runs the stepper for `duration` seconds with the scripted throttle and automatic shifting. */
export function simulate(vehicle: Vehicle, opts: SimOptions = {}): Trace {
  const dt = opts.dt ?? 0.005
  const duration = opts.duration ?? 30
  const n = Math.max(1, Math.round(duration / dt))
  const run = createRun(vehicle, opts)
  const throttleOpt = opts.throttle ?? 1
  const throttleFn = typeof throttleOpt === 'function' ? throttleOpt : () => throttleOpt

  const len = n + 1
  const tr: Trace = {
    vehicleId: vehicle.id,
    dt,
    length: len,
    t: new Float64Array(len),
    v: new Float64Array(len),
    x: new Float64Array(len),
    a: new Float64Array(len),
    rpm: new Float64Array(len),
    gear: new Uint8Array(len),
    wheelForce: new Float64Array(len),
    engineTorque: new Float64Array(len),
    engineHp: new Float64Array(len),
    throttle: new Float64Array(len),
    boost: new Float64Array(len),
    tractionLimited: new Uint8Array(len),
    metrics: null as unknown as TraceMetrics,
  }
  recordSample(tr, 0, run.state)
  const inputs: RunInputs = { throttle: 1 }
  for (let i = 1; i <= n; i++) {
    inputs.throttle = throttleFn(run.state.t, run.state)
    run.step(dt, inputs)
    recordSample(tr, i, run.state)
  }
  tr.metrics = computeMetrics(tr)
  return tr
}

// ---- interpolation helpers -------------------------------------------------

/** Index/fraction of the first upward crossing of `target` in `arr` at or after `from`. */
function firstCrossing(arr: Float64Array, target: number, from = 0): { i: number; f: number } | null {
  if (from < arr.length && arr[from] >= target) return { i: from, f: 0 }
  for (let i = Math.max(from, 1); i < arr.length; i++) {
    if (arr[i - 1] < target && arr[i] >= target) {
      const f = (target - arr[i - 1]) / (arr[i] - arr[i - 1])
      return { i: i - 1, f }
    }
  }
  return null
}

function sampleAt(arr: Float64Array, c: { i: number; f: number }): number {
  if (c.i + 1 >= arr.length) return arr[c.i]
  return lerp(arr[c.i], arr[c.i + 1], c.f)
}

/** Time (s) at which the trace first reaches `mph`, or null. */
export function timeToMph(trace: Trace, mph: number, fromIndex = 0): number | null {
  const c = firstCrossing(trace.v, mpsFromMph(mph), fromIndex)
  return c ? sampleAt(trace.t, c) : null
}

/** Time (s) at which the trace first reaches distance `m`, or null. */
export function timeAtDistance(trace: Trace, m: number): number | null {
  const c = firstCrossing(trace.x, m)
  return c ? sampleAt(trace.t, c) : null
}

export interface Interval {
  timeS: number
  distanceM: number
  fromMph: number
  toMph: number
}

/** Time and distance between first reaching `fromMph` and first reaching `toMph` afterwards, or null. */
export function speedToSpeed(trace: Trace, fromMph: number, toMph: number): Interval | null {
  const c0 = firstCrossing(trace.v, mpsFromMph(fromMph))
  if (!c0) return null
  const c1 = firstCrossing(trace.v, mpsFromMph(toMph), c0.i)
  if (!c1) return null
  const t0 = sampleAt(trace.t, c0)
  const t1 = sampleAt(trace.t, c1)
  const x0 = sampleAt(trace.x, c0)
  const x1 = sampleAt(trace.x, c1)
  return { timeS: t1 - t0, distanceM: x1 - x0, fromMph, toMph }
}

/** Distance the car may roll before the drag-strip clock starts, m (1 ft). */
export const ROLLOUT_M = mFromFeet(1)

function distanceRun(trace: Trace, distM: number): QuarterMile | null {
  const cEnd = firstCrossing(trace.x, distM)
  if (!cEnd) return null
  const tEnd = sampleAt(trace.t, cEnd)
  const vEnd = sampleAt(trace.v, cEnd)
  const cRoll = firstCrossing(trace.x, ROLLOUT_M)
  const tRoll = cRoll ? sampleAt(trace.t, cRoll) : 0
  const cTrap = firstCrossing(trace.x, distM - mFromFeet(66))
  const tTrap = cTrap ? sampleAt(trace.t, cTrap) : 0
  const trapMps = cTrap && tEnd > tTrap ? mFromFeet(66) / (tEnd - tTrap) : vEnd
  return { timeS: tEnd - tRoll, timeFromRestS: tEnd, trapMph: mphFromMps(trapMps), finishMph: mphFromMps(vEnd) }
}

export function computeMetrics(trace: Trace): TraceMetrics {
  const rolloutIdx = firstCrossing(trace.x, ROLLOUT_M)
  const tRollout = rolloutIdx ? sampleAt(trace.t, rolloutIdx) : null
  const t60 = timeToMph(trace, 60)
  const t100 = timeToMph(trace, 100)
  const s60to130 = speedToSpeed(trace, 60, 130)
  let vMax = -1
  let iMax = 0
  for (let i = 0; i < trace.length; i++) {
    if (trace.v[i] > vMax + mpsFromMph(0.1)) {
      vMax = trace.v[i]
      iMax = i
    }
  }
  return {
    zeroToSixtyS: trace.v[0] < mpsFromMph(0.5) ? t60 : null,
    zeroToSixtyRolloutS: t60 !== null && tRollout !== null && trace.v[0] < mpsFromMph(0.5) ? t60 - tRollout : null,
    zeroToHundredS: trace.v[0] < mpsFromMph(0.5) ? t100 : null,
    sixtyToOneThirtyS: s60to130 ? s60to130.timeS : null,
    quarterMile: trace.x[0] === 0 ? distanceRun(trace, mFromFeet(1320)) : null,
    eighthMile: trace.x[0] === 0 ? distanceRun(trace, mFromFeet(660)) : null,
    topSpeedMph: mphFromMps(Math.max(vMax, 0)),
    timeToTopSpeedS: trace.t[iMax],
  }
}

// ---------------------------------------------------------------------------
// Rolling acceleration in a fixed gear
// ---------------------------------------------------------------------------

export interface RollingAccelOptions {
  fromMph: number
  toMph: number
  /** Gear, 1-based. */
  gear: number
  dyno?: CurveMode
  dt?: number
  /** Give up after this long, s. Default 60. */
  maxTimeS?: number
  turboLag?: boolean
}

export type RollingAccelReason = 'limiter' | 'stall' | 'topSpeed' | 'noAcceleration' | 'timeout'

export interface RollingAccelResult {
  /** True if `toMph` was reached in the requested gear. */
  reachable: boolean
  /** Time taken, s: to `toMph` if reachable, otherwise to the limiting speed. */
  timeS: number
  /** Distance covered over that time, m. */
  distanceM: number
  fromMph: number
  toMph: number
  gear: number
  /** Speed actually reached, mph (= toMph when reachable). */
  reachedMph: number
  /** Why the target could not be reached, when it could not. */
  reason?: RollingAccelReason
  /** Engine speed at the start, rpm. */
  rpmAtFrom: number
  /** Engine speed at the end, rpm. */
  rpmAtReached: number
}

/**
 * Full-throttle acceleration from `fromMph` to `toMph` held in one gear
 * (no shifting), e.g. a 50→80 mph highway pass in 3rd vs 6th.
 */
export function rollingAccel(vehicle: Vehicle, o: RollingAccelOptions): RollingAccelResult {
  const ratios = overallRatios(vehicle)
  const gearIdx = clamp(Math.round(o.gear), 1, ratios.length) - 1
  const ratio = ratios[gearIdx]
  const r = vehicle.chassis.tireRadiusM
  const dt = o.dt ?? 0.005
  const maxT = o.maxTimeS ?? 60
  const vFrom = mpsFromMph(o.fromMph)
  const vTo = mpsFromMph(o.toMph)
  const rpmAtFrom = rpmFromSpeed(vFrom, ratio, 1, r)
  const idle = idleRpm(vehicle)
  const lim = limiterRpm(vehicle)
  const base = { fromMph: o.fromMph, toMph: o.toMph, gear: gearIdx + 1, rpmAtFrom }

  if (vehicle.powertrain.kind === 'ice' && rpmAtFrom < idle) {
    return { ...base, reachable: false, timeS: 0, distanceM: 0, reachedMph: o.fromMph, reason: 'stall', rpmAtReached: rpmAtFrom }
  }
  if (o.toMph <= o.fromMph) {
    return { ...base, reachable: true, timeS: 0, distanceM: 0, reachedMph: o.fromMph, rpmAtReached: rpmAtFrom }
  }

  const vLimiter = speedFromRpm(lim, ratio, 1, r)
  const vGov = vehicle.topSpeedGovernorMph !== undefined ? mpsFromMph(vehicle.topSpeedGovernorMph) : Infinity
  const run = createRun(vehicle, {
    dt,
    startSpeedMps: vFrom,
    startGear: gearIdx + 1,
    shiftStrategy: 'hold',
    dyno: o.dyno,
    turboLag: o.turboLag,
  })
  const s = run.state
  const inputs: RunInputs = { throttle: 1 }
  let prevV = s.v
  let stagnantS = 0
  while (s.t < maxT) {
    run.step(dt, inputs)
    if (s.v >= vTo) {
      // interpolate the crossing within the last step
      const f = (vTo - prevV) / (s.v - prevV)
      const tCross = s.t - dt * (1 - f)
      const xCross = s.x - (s.v - vTo) * dt * (1 - f) // approx: back off part of the last step's distance
      return { ...base, reachable: true, timeS: tCross, distanceM: xCross, reachedMph: o.toMph, rpmAtReached: rpmFromSpeed(vTo, ratio, 1, r) }
    }
    if (s.a < 0.02) stagnantS += dt
    else stagnantS = 0
    if (stagnantS > 0.5) break
    prevV = s.v
  }
  let reason: RollingAccelReason
  if (s.v >= vLimiter - 0.3) reason = 'limiter'
  else if (s.v >= vGov - GOVERNOR_WINDOW_MPS - 0.3) reason = 'topSpeed'
  else if (s.t >= maxT) reason = 'timeout'
  else reason = 'noAcceleration'
  return { ...base, reachable: false, timeS: s.t, distanceM: s.x, reachedMph: mphFromMps(s.v), reason, rpmAtReached: s.rpm }
}

/** Convenience: full-throttle standing start with default options and the usual metrics. */
export function standingStart(vehicle: Vehicle, opts: SimOptions = {}): Trace {
  return simulate(vehicle, { duration: 40, ...opts })
}

/** Re-export for consumers that only import this module. */
export type { CurveMode }
export { engineTorque, engineBrakingTorque, boostFactor }
