/**
 * Engine model: torque curve lookup, derived power, throttle/engine-braking
 * and an optional first-order turbo-lag filter.
 *
 * All torque in lb-ft, power in hp, speed in rpm (see units.ts for SI).
 */
import { clamp, hpFromTorqueRpm } from './units'

export interface TorquePoint {
  rpm: number
  lbft: number
}

/** Sorted (ascending rpm) array of torque samples. */
export type TorqueCurve = readonly TorquePoint[]

export interface TurboLagModel {
  /** When false the engine is treated as naturally aspirated (no lag). */
  enabled: boolean
  /**
   * Fraction of the curve available instantly (the "off-boost" baseline).
   * The remaining (1 - naFraction) is the boost contribution that lags.
   * Default 0.55.
   */
  naFraction: number
  /** First-order time constant of boost build-up, seconds. Default 0.25. */
  timeConstantS: number
  /**
   * First-order time constant of boost decay when the throttle is closed or
   * the engine is decoupled during a shift, seconds. Default 0.6: the turbo
   * shaft keeps spinning during a brief lift, so boost returns much faster
   * after a 0.35 s shift than it builds from off-boost.
   */
  decayTimeConstantS: number
}

export interface Engine {
  /** Idle speed, rpm. The clutch slips rather than letting rpm fall below this. */
  idleRpm: number
  /** Fuel-cut speed, rpm. Drive torque is removed at/above this speed. */
  limiterRpm: number
  /** Tachometer redline mark, rpm (display only). */
  redlineRpm: number
  /** Rated (manufacturer-style) crank torque curve. */
  curve: TorqueCurve
  /** Optional alternative curve (e.g. inferred from chassis dynos). */
  dynoCurve?: TorqueCurve
  /**
   * Optional rotational inertia of crank + flywheel + clutch, kg·m². Only used
   * for free-revving feel when the clutch is open (rev-matching in neutral).
   */
  inertiaKgM2?: number
  /** Optional turbo-lag model. Omit (or enabled:false) for NA engines. */
  turbo?: TurboLagModel
}

export type CurveMode = 'rated' | 'dyno'

export const DEFAULT_TURBO_LAG: TurboLagModel = {
  enabled: true,
  naFraction: 0.55,
  timeConstantS: 0.25,
  decayTimeConstantS: 0.6,
}

/** Selects the rated or dyno curve, falling back to rated if no dyno curve exists. */
export function resolveCurve(engine: Engine, mode: CurveMode = 'rated'): TorqueCurve {
  return mode === 'dyno' && engine.dynoCurve ? engine.dynoCurve : engine.curve
}

/** Validates that a curve is non-empty and sorted ascending by rpm. */
export function assertValidCurve(curve: TorqueCurve, name = 'curve'): void {
  if (curve.length === 0) throw new Error(`${name}: torque curve is empty`)
  for (let i = 1; i < curve.length; i++) {
    if (!(curve[i].rpm > curve[i - 1].rpm)) {
      throw new Error(`${name}: torque curve must be strictly ascending in rpm (index ${i})`)
    }
  }
}

/**
 * Linear interpolation of torque at a given rpm. Below the first point or
 * above the last the value is clamped to the end point.
 */
export function torqueAt(curve: TorqueCurve, rpm: number): number {
  const n = curve.length
  if (n === 0) return 0
  if (rpm <= curve[0].rpm) return curve[0].lbft
  if (rpm >= curve[n - 1].rpm) return curve[n - 1].lbft
  // binary search for the segment
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid].rpm <= rpm) lo = mid
    else hi = mid
  }
  const a = curve[lo]
  const b = curve[hi]
  const t = (rpm - a.rpm) / (b.rpm - a.rpm)
  return a.lbft + (b.lbft - a.lbft) * t
}

/** Power (hp) at a given rpm from the torque curve. */
export function powerAt(curve: TorqueCurve, rpm: number): number {
  return hpFromTorqueRpm(torqueAt(curve, rpm), rpm)
}

export interface Peak {
  value: number
  rpm: number
}

/** Scan resolution used by peakTorque/peakPower, rpm. */
export const PEAK_SCAN_STEP_RPM = 10

const peakTorqueCache = new WeakMap<TorqueCurve, Peak>()
const peakPowerCache = new WeakMap<TorqueCurve, Peak>()

/** Peak torque (lb-ft) and the lowest rpm at which it occurs, scanned at 10 rpm. Memoised per curve object. */
export function peakTorque(curve: TorqueCurve): Peak {
  let p = peakTorqueCache.get(curve)
  if (!p) {
    p = scanPeak(curve, torqueAt)
    peakTorqueCache.set(curve, p)
  }
  return p
}

/** Peak power (hp) and the rpm at which it occurs, scanned at 10 rpm. Memoised per curve object. */
export function peakPower(curve: TorqueCurve): Peak {
  let p = peakPowerCache.get(curve)
  if (!p) {
    p = scanPeak(curve, powerAt)
    peakPowerCache.set(curve, p)
  }
  return p
}

function scanPeak(curve: TorqueCurve, fn: (c: TorqueCurve, rpm: number) => number): Peak {
  if (curve.length === 0) return { value: 0, rpm: 0 }
  const start = curve[0].rpm
  const end = curve[curve.length - 1].rpm
  let best = { value: -Infinity, rpm: start }
  for (let rpm = start; rpm <= end + 1e-9; rpm += PEAK_SCAN_STEP_RPM) {
    const v = fn(curve, rpm)
    if (v > best.value) best = { value: v, rpm }
  }
  // Make sure the exact end point is considered when the span is not a multiple of the step.
  const vEnd = fn(curve, end)
  if (vEnd > best.value) best = { value: vEnd, rpm: end }
  return best
}

/**
 * Closed-throttle engine braking torque (lb-ft, negative).
 *
 *   T_brake = -(0.03 · T_peak + 0.000004 · rpm²)
 *
 * The constant part stands for pumping/friction losses scaled by engine size
 * (3 % of peak torque), the quadratic part for the increase of friction and
 * pumping work with speed. For a 350 lb-ft engine this gives ≈ -26 lb-ft at
 * 2000 rpm and ≈ -195 lb-ft at 6800 rpm. Deliberately simple.
 */
export function engineBrakingTorque(curveOrPeakLbft: TorqueCurve | number, rpm: number): number {
  const peak = typeof curveOrPeakLbft === 'number' ? curveOrPeakLbft : peakTorque(curveOrPeakLbft).value
  return -(0.03 * peak + 0.000004 * rpm * rpm)
}

/**
 * Mutable per-run state for the turbo-lag filter.
 * `boost` is the fraction (0..1) of the lagging torque share currently available.
 */
export interface BoostState {
  boost: number
}

export function createBoostState(initialBoost = 0): BoostState {
  return { boost: initialBoost }
}

/**
 * Advances the first-order boost filter by dt. The target is 1 when the
 * driver is on the throttle (wastegate closed, turbo spooling) and 0 when the
 * throttle is closed or the engine is decoupled during a shift.
 */
export function stepBoost(engine: Engine, state: BoostState, throttle: number, dt: number, decoupled = false): void {
  const turbo = engine.turbo
  if (!turbo || !turbo.enabled) {
    state.boost = 1
    return
  }
  const target = !decoupled && throttle > 0 ? 1 : 0
  const tau = target > state.boost ? turbo.timeConstantS : turbo.decayTimeConstantS
  const alpha = 1 - Math.exp(-dt / tau)
  state.boost += (target - state.boost) * alpha
}

/** Multiplier applied to the full-throttle curve for the current boost state. */
export function boostFactor(engine: Engine, state: BoostState): number {
  const turbo = engine.turbo
  if (!turbo || !turbo.enabled) return 1
  return turbo.naFraction + (1 - turbo.naFraction) * clamp(state.boost, 0, 1)
}

export interface EngineTorqueOptions {
  curveMode?: CurveMode
  /** Pre-computed boost state; when omitted the engine is treated as fully spooled. */
  boost?: BoostState
  /** Width of the soft fuel-cut window below the limiter, rpm. Default 100. */
  limiterWindowRpm?: number
}

/**
 * Net crank torque (lb-ft) for a given rpm and throttle position (0..1).
 *
 *   T = T_curve(rpm) · throttle · boostFactor · limiterScale
 *       + T_brake(rpm) · (1 - throttle)
 *
 * The limiter is a soft fuel cut: drive torque fades linearly to zero over the
 * last `limiterWindowRpm` (default 100) below `limiterRpm` and is zero at or
 * above it. This lets a car sitting on the limiter in gear settle a few rpm
 * below it instead of bouncing, which is both numerically kind and close to
 * what a modern ECU does.
 */
export function engineTorque(engine: Engine, rpm: number, throttle: number, opts: EngineTorqueOptions = {}): number {
  const thr = clamp(throttle, 0, 1)
  const curve = resolveCurve(engine, opts.curveMode)
  const window = opts.limiterWindowRpm ?? 100
  const limiterScale = clamp((engine.limiterRpm - rpm) / window, 0, 1)
  const bf = opts.boost ? boostFactor(engine, opts.boost) : 1
  const drive = torqueAt(curve, rpm) * thr * bf * limiterScale
  const brake = engineBrakingTorque(curve, rpm) * (1 - thr)
  return drive + brake
}
