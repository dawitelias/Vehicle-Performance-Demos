/**
 * Drivetrain geometry: engine ↔ wheel speed/torque relations, gear-by-gear
 * speed tables, optimal shift points and tractive-force envelopes.
 *
 * Works for both powertrain kinds. For an EV the "gear" list has a single
 * entry (the fixed reduction) and the "engine" is the motor.
 */
import type { CurveMode } from './engine'
import { resolveCurve, torqueAt } from './engine'
import { hpFromTorqueRpm, mphFromMps, mpsFromMph, nmFromLbft, radPerSecFromRpm, rpmFromRadPerSec, torqueLbftFromHpRpm, wattsFromHp } from './units'
import type { Vehicle } from './vehicles'
import { simMassKg } from './vehicles'

/** Wheel torque (N·m) from engine torque (N·m) through a gear and final drive. */
export function wheelTorque(engineTorqueNm: number, gear: number, final: number, efficiency: number): number {
  return engineTorqueNm * gear * final * efficiency
}

/** Tractive force at the contact patch (N) from engine torque (N·m). */
export function wheelForce(engineTorqueNm: number, gear: number, final: number, efficiency: number, tireRadiusM: number): number {
  return wheelTorque(engineTorqueNm, gear, final, efficiency) / tireRadiusM
}

/** Engine speed (rpm) for a road speed (m/s) in a given gear. */
export function rpmFromSpeed(v: number, gear: number, final: number, tireRadiusM: number): number {
  return rpmFromRadPerSec((v / tireRadiusM) * gear * final)
}

/** Road speed (m/s) for an engine speed (rpm) in a given gear. */
export function speedFromRpm(rpm: number, gear: number, final: number, tireRadiusM: number): number {
  return (radPerSecFromRpm(rpm) / (gear * final)) * tireRadiusM
}

/** Overall ratios (transmission × final drive), one per gear. EV → single ratio. */
export function overallRatios(vehicle: Vehicle): number[] {
  const pt = vehicle.powertrain
  if (pt.kind === 'ev') return [pt.ratio]
  return pt.gearRatios.map((g) => g * pt.finalDrive)
}

export const gearCount = (vehicle: Vehicle): number => overallRatios(vehicle).length

/** Fuel-cut / max motor speed, rpm. */
export function limiterRpm(vehicle: Vehicle): number {
  const pt = vehicle.powertrain
  return pt.kind === 'ev' ? pt.maxMotorRpm : pt.engine.limiterRpm
}

/** Idle speed (0 for an EV). */
export function idleRpm(vehicle: Vehicle): number {
  const pt = vehicle.powertrain
  return pt.kind === 'ev' ? 0 : pt.engine.idleRpm
}

export function drivelineEfficiency(vehicle: Vehicle): number {
  return vehicle.powertrain.efficiency
}

/**
 * Full-throttle prime-mover torque (lb-ft) at a given shaft speed, ignoring
 * the limiter and turbo lag. For an EV: min(constant torque, P/ω).
 */
export function fullThrottleTorqueLbft(vehicle: Vehicle, rpm: number, curveMode: CurveMode = 'rated'): number {
  const pt = vehicle.powertrain
  if (pt.kind === 'ev') {
    if (rpm <= 0) return pt.motorTorqueLbft
    return Math.min(pt.motorTorqueLbft, torqueLbftFromHpRpm(pt.maxPowerHp, rpm))
  }
  return torqueAt(resolveCurve(pt.engine, curveMode), rpm)
}

/** Full-throttle power (hp) at a given shaft speed. */
export function fullThrottlePowerHp(vehicle: Vehicle, rpm: number, curveMode: CurveMode = 'rated'): number {
  const pt = vehicle.powertrain
  if (pt.kind === 'ev') {
    const w = radPerSecFromRpm(rpm) * nmFromLbft(pt.motorTorqueLbft)
    return Math.min(pt.maxPowerHp, w / wattsFromHp(1))
  }
  return hpFromTorqueRpm(fullThrottleTorqueLbft(vehicle, rpm, curveMode), rpm)
}

/** Engine rpm at road speed v (m/s) in gear index `gearIdx` (0-based). */
export function vehicleRpmAtSpeed(vehicle: Vehicle, v: number, gearIdx: number): number {
  return rpmFromSpeed(v, overallRatios(vehicle)[gearIdx], 1, vehicle.chassis.tireRadiusM)
}

/** Road speed (m/s) at `rpm` in gear index `gearIdx` (0-based). */
export function vehicleSpeedAtRpm(vehicle: Vehicle, rpm: number, gearIdx: number): number {
  return speedFromRpm(rpm, overallRatios(vehicle)[gearIdx], 1, vehicle.chassis.tireRadiusM)
}

/** Full-throttle tractive force (N) at `rpm` in gear index `gearIdx`. */
export function vehicleWheelForceAtRpm(vehicle: Vehicle, rpm: number, gearIdx: number, curveMode: CurveMode = 'rated'): number {
  const tNm = nmFromLbft(fullThrottleTorqueLbft(vehicle, rpm, curveMode))
  return wheelForce(tNm, overallRatios(vehicle)[gearIdx], 1, drivelineEfficiency(vehicle), vehicle.chassis.tireRadiusM)
}

/**
 * Rotating-mass factor for a gear (Gillespie, Fundamentals of Vehicle
 * Dynamics, eq. 2-10): m_eff / m = 1 + 0.04 + k·(gear·final)². The 0.04 is
 * wheels/tyres/brakes/driveshaft; the k·N² term is the engine/flywheel/clutch
 * reflected through the overall ratio.
 */
export function effectiveMassFactor(vehicle: Vehicle, gearIdx: number): number {
  const n = overallRatios(vehicle)[gearIdx]
  return 1 + 0.04 + vehicle.powertrain.rotatingInertiaCoeff * n * n
}

export function effectiveMassKg(vehicle: Vehicle, gearIdx: number): number {
  return simMassKg(vehicle) * effectiveMassFactor(vehicle, gearIdx)
}

/** Road speed (mph) in each gear at a given engine speed. */
export function speedAtRpmPerGear(vehicle: Vehicle, rpm: number): number[] {
  return overallRatios(vehicle).map((n) => mphFromMps(speedFromRpm(rpm, n, 1, vehicle.chassis.tireRadiusM)))
}

/** Road speed (mph) at the limiter in each gear. */
export function topSpeedPerGearMph(vehicle: Vehicle): number[] {
  return speedAtRpmPerGear(vehicle, limiterRpm(vehicle))
}

/** Scan resolution for optimalShiftPoints, rpm. */
export const SHIFT_SCAN_STEP_RPM = 10

/**
 * For each gear, the rpm at which full-throttle wheel force in the next gear
 * (at the same road speed) first exceeds the force in the current gear, or
 * the limiter if that never happens before the limiter. The last gear always
 * returns the limiter. The scan starts where the next gear's rpm would be at
 * least idle (a shift below that is not usable).
 */
export function optimalShiftPoints(vehicle: Vehicle, curveMode: CurveMode = 'rated'): number[] {
  const ratios = overallRatios(vehicle)
  const lim = limiterRpm(vehicle)
  const idle = idleRpm(vehicle)
  const out: number[] = []
  for (let g = 0; g < ratios.length; g++) {
    if (g === ratios.length - 1) {
      out.push(lim)
      continue
    }
    const stepDown = ratios[g + 1] / ratios[g] // rpm in next gear = rpm × stepDown
    const startRpm = Math.max(idle, Math.ceil(idle / stepDown / SHIFT_SCAN_STEP_RPM) * SHIFT_SCAN_STEP_RPM, SHIFT_SCAN_STEP_RPM)
    let shiftAt = lim
    for (let rpm = startRpm; rpm <= lim; rpm += SHIFT_SCAN_STEP_RPM) {
      const fCur = fullThrottleTorqueLbft(vehicle, rpm, curveMode) * ratios[g]
      const fNext = fullThrottleTorqueLbft(vehicle, rpm * stepDown, curveMode) * ratios[g + 1]
      if (fNext > fCur) {
        shiftAt = rpm
        break
      }
    }
    out.push(shiftAt)
  }
  return out
}

export interface ForcePoint {
  mph: number
  /** Full-throttle tractive force at the contact patch, N. */
  force: number
  rpm: number
}

/**
 * Sampled full-throttle thrust-vs-speed curve for a gear (0-based index),
 * from idle (or 0 for an EV) to the limiter. Useful for plotting the
 * tractive-force envelope.
 */
export function tractiveForceCurve(vehicle: Vehicle, gearIdx: number, samples = 60, curveMode: CurveMode = 'rated'): ForcePoint[] {
  const lim = limiterRpm(vehicle)
  const lo = idleRpm(vehicle)
  const pts: ForcePoint[] = []
  for (let i = 0; i <= samples; i++) {
    const rpm = lo + ((lim - lo) * i) / samples
    const v = vehicleSpeedAtRpm(vehicle, rpm, gearIdx)
    pts.push({ mph: mphFromMps(v), force: vehicleWheelForceAtRpm(vehicle, rpm, gearIdx, curveMode), rpm })
  }
  return pts
}

/** Aerodynamic + rolling resistance (N) at road speed v (m/s). */
export function resistanceForce(vehicle: Vehicle, v: number): number {
  const c = vehicle.chassis
  const drag = 0.5 * 1.225 * c.cd * c.frontalAreaM2 * v * v
  const rolling = v > 1e-3 ? c.crr * simMassKg(vehicle) * 9.80665 : 0
  return drag + rolling
}

/** Convenience: mph → rpm in a gear (0-based). */
export function rpmAtMph(vehicle: Vehicle, mph: number, gearIdx: number): number {
  return vehicleRpmAtSpeed(vehicle, mpsFromMph(mph), gearIdx)
}
