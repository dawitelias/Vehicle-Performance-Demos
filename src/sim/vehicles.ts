/**
 * Vehicle definitions. Every number carries a source comment. Values marked
 * "estimate" or "hypothetical" are ours, not the manufacturer's.
 *
 * Rivals share the Z's chassis (mass, aero, tyres, weight distribution) unless
 * noted, because the point of the demo is to compare engine character, not
 * cars. See src/sim/README.md for the modelling assumptions and tuned values.
 */
import type { Engine, TorqueCurve } from './engine'
import { DEFAULT_TURBO_LAG } from './engine'

export type DriveLayout = 'rwd' | 'fwd' | 'awd'

export interface Chassis {
  /** Curb mass, kg. */
  curbMassKg: number
  /** Driver + fuel allowance added to curb mass for the sim, kg. */
  payloadKg: number
  /** Drag coefficient (dimensionless). */
  cd: number
  /** Frontal area, m². */
  frontalAreaM2: number
  /** Rolling resistance coefficient (dimensionless). */
  crr: number
  /** Wheelbase, m. */
  wheelbaseM: number
  /** Centre-of-gravity height, m. */
  cgHeightM: number
  /** Static fraction of mass on the front axle (0..1). */
  frontWeightFraction: number
  /** Effective rolling radius of the driven tyre, m. */
  tireRadiusM: number
  /** Peak longitudinal tyre–road friction coefficient (dry). */
  mu: number
  drive: DriveLayout
}

export interface IcePowertrain {
  kind: 'ice'
  engine: Engine
  /** Transmission ratios, 1st first. */
  gearRatios: number[]
  finalDrive: number
  /** Overall driveline efficiency engine → tyre (0..1). */
  efficiency: number
  /** Time during which the clutch is open on a gear change, s. */
  shiftTimeS: number
  /** Engine speed held during the clutch-slip launch phase, rpm. */
  launchRpm: number
  /**
   * Coefficient k in the rotating-mass factor 1 + 0.04 + k·(gear·final)².
   * Gillespie's passenger-car value is 0.0025 (see README). Hypothetical
   * engines whose redline differs from the Z's are scaled so that the engine
   * stores the same rotational energy at the same road speed.
   */
  rotatingInertiaCoeff: number
}

export interface EvPowertrain {
  kind: 'ev'
  /** Constant motor torque available from 0 rpm up to base speed, lb-ft (at the motor). */
  motorTorqueLbft: number
  /** Constant-power ceiling above base speed, hp (at the motor). */
  maxPowerHp: number
  /** Maximum motor speed, rpm (torque is cut here, like a limiter). */
  maxMotorRpm: number
  /** Single reduction ratio motor → wheel. */
  ratio: number
  /** Motor + reduction + inverter efficiency to the tyre (0..1). */
  efficiency: number
  /** Lift-off regenerative braking torque as a fraction of motorTorqueLbft (0..1). */
  regenFraction: number
  /** See IcePowertrain.rotatingInertiaCoeff. EV rotors are light; see README. */
  rotatingInertiaCoeff: number
}

export type Powertrain = IcePowertrain | EvPowertrain

export interface Vehicle {
  id: string
  name: string
  shortName: string
  /** Free-text description of what this entry represents. */
  description: string
  hypothetical: boolean
  chassis: Chassis
  powertrain: Powertrain
  /** Electronic top-speed governor, mph (omit for none). */
  topSpeedGovernorMph?: number
}

/** Total simulated mass (curb + driver/fuel), kg. */
export const simMassKg = (v: Vehicle): number => v.chassis.curbMassKg + v.chassis.payloadKg

// ---------------------------------------------------------------------------
// Tuned launch/traction constants (see README "Tuned constants").
// ---------------------------------------------------------------------------

/**
 * Peak dry longitudinal friction coefficient for the stock max-performance
 * summer tyres (Bridgestone Potenza S007 on the Z Performance; comparable
 * Michelin/Bridgestone fitments on the rivals). The task brief started at
 * 1.05; published 0–60 and 0–40 times for the Z and 370Z require a stronger
 * launch than 1.05 allows, and tyre-industry data (e.g. SAE 2014-01-0082,
 * TireRack dry braking tests at ~1.1–1.2 g from 60 mph for this class)
 * support ~1.15–1.25 on dry asphalt. See README for the tuning record.
 */
export const STREET_SUMMER_TIRE_MU = 1.25

// ---------------------------------------------------------------------------
// Nissan Z Performance 6MT (2024, RZ34), VR30DDTT 3.0 L twin-turbo V6
// ---------------------------------------------------------------------------

/**
 * "Rated" crank torque curve shaped to Nissan's published figures:
 * 350 lb-ft @ 1600–5200 rpm and 400 hp @ 6400 rpm (Nissan USA 2024 Z spec
 * sheet / press kit). Points above 5200 fall off so that power peaks at 6400
 * (328 lb-ft × 6400 / 5252 ≈ 400 hp). Low-rpm ramp (1000–2000) is a typical
 * turbo spool shape, not measured.
 */
export const Z_RATED_CURVE: TorqueCurve = [
  { rpm: 700, lbft: 150 }, // idle; off-boost estimate
  { rpm: 1000, lbft: 215 },
  { rpm: 1250, lbft: 250 },
  { rpm: 1500, lbft: 300 },
  { rpm: 1750, lbft: 338 },
  { rpm: 2000, lbft: 350 },
  { rpm: 2250, lbft: 350 },
  { rpm: 2500, lbft: 350 },
  { rpm: 2750, lbft: 350 },
  { rpm: 3000, lbft: 350 },
  { rpm: 3250, lbft: 350 },
  { rpm: 3500, lbft: 350 },
  { rpm: 3750, lbft: 350 },
  { rpm: 4000, lbft: 350 },
  { rpm: 4250, lbft: 350 },
  { rpm: 4500, lbft: 350 },
  { rpm: 4750, lbft: 350 },
  { rpm: 5000, lbft: 350 },
  { rpm: 5250, lbft: 350 },
  { rpm: 5500, lbft: 349 },
  { rpm: 5750, lbft: 345 },
  { rpm: 6000, lbft: 340 },
  { rpm: 6250, lbft: 334 },
  { rpm: 6400, lbft: 328 },
  { rpm: 6500, lbft: 321 },
  { rpm: 6750, lbft: 306 },
  { rpm: 6800, lbft: 302 },
  { rpm: 7000, lbft: 288 },
]

/**
 * "As-dyno'd" variant. Stock RZ34 chassis-dyno results published by owners
 * and tuners (e.g. AMS Performance, Z1 Motorsports baselines) show roughly
 * 360–383 lb-ft at the wheels; back-calculating through ~0.92 driveline
 * efficiency puts crank midrange torque ≈ 12 % above the rating (≈ 392 lb-ft).
 * The top end is left at the rated values (the rating is power-limited there).
 */
export const Z_DYNO_CURVE: TorqueCurve = [
  { rpm: 700, lbft: 150 }, // idle; off-boost estimate
  { rpm: 1000, lbft: 215 },
  { rpm: 1250, lbft: 258 },
  { rpm: 1500, lbft: 318 },
  { rpm: 1750, lbft: 368 },
  { rpm: 2000, lbft: 392 },
  { rpm: 2250, lbft: 392 },
  { rpm: 2500, lbft: 392 },
  { rpm: 2750, lbft: 392 },
  { rpm: 3000, lbft: 392 },
  { rpm: 3250, lbft: 392 },
  { rpm: 3500, lbft: 392 },
  { rpm: 3750, lbft: 392 },
  { rpm: 4000, lbft: 392 },
  { rpm: 4250, lbft: 392 },
  { rpm: 4500, lbft: 392 },
  { rpm: 4750, lbft: 392 },
  { rpm: 5000, lbft: 386 },
  { rpm: 5250, lbft: 379 },
  { rpm: 5500, lbft: 372 },
  { rpm: 5750, lbft: 361 },
  { rpm: 6000, lbft: 350 },
  { rpm: 6250, lbft: 337 },
  { rpm: 6400, lbft: 328 },
  { rpm: 6500, lbft: 321 },
  { rpm: 6750, lbft: 306 },
  { rpm: 6800, lbft: 302 },
  { rpm: 7000, lbft: 288 },
]

/** Nissan 6MT (FS6R31A) ratios, Z / 370Z: Nissan spec sheets. */
export const NISSAN_6MT_RATIOS = [3.794, 2.324, 1.624, 1.271, 1.0, 0.794]

export const Z_ENGINE: Engine = {
  idleRpm: 700, // typical VR30DDTT idle (estimate)
  limiterRpm: 6800, // fuel cut, per task brief / owner reports
  redlineRpm: 7000, // tach redline mark (Nissan)
  curve: Z_RATED_CURVE,
  dynoCurve: Z_DYNO_CURVE,
  inertiaKgM2: 0.25, // crank+flywheel+clutch, estimate for a 3.0 V6 with dual-mass flywheel
  turbo: { ...DEFAULT_TURBO_LAG, enabled: true },
}

export const Z_CHASSIS: Chassis = {
  curbMassKg: 1604, // 3536 lb, Nissan 2024 Z Performance 6MT curb weight
  payloadKg: 90, // driver + fuel allowance (task brief)
  cd: 0.31, // Nissan (Z Performance with rear spoiler)
  frontalAreaM2: 2.0, // estimate from 1.845 m width × 1.315 m height × ~0.82 shape factor
  crr: 0.012, // typical performance summer tyre on asphalt (estimate)
  wheelbaseM: 2.55, // Nissan: 100.4 in
  cgHeightM: 0.48, // estimate (task brief marks as such)
  frontWeightFraction: 0.564, // 56.4/43.6 F/R static (task brief; magazine corner-weight tests show 55–56 % front)
  tireRadiusM: 0.327, // 275/35R19 rear, 784 rev/mile (Bridgestone Potenza S007 spec) → 1609.344 / 784 / 2π
  mu: STREET_SUMMER_TIRE_MU,
  drive: 'rwd',
}

export const nissanZ: Vehicle = {
  id: 'z',
  name: 'Nissan Z Performance 6MT (2024)',
  shortName: 'Z',
  description:
    'VR30DDTT 3.0 L twin-turbo V6, 400 hp @ 6400 rpm, 350 lb-ft @ 1600–5200 rpm, 6-speed manual.',
  hypothetical: false,
  chassis: Z_CHASSIS,
  powertrain: {
    kind: 'ice',
    engine: Z_ENGINE,
    gearRatios: NISSAN_6MT_RATIOS,
    finalDrive: 3.538, // Nissan Z Performance 6MT final drive
    efficiency: 0.92, // task brief; typical for a manual RWD driveline
    shiftTimeS: 0.35, // task brief; a brisk manual shift
    launchRpm: 3500, // task brief default
    rotatingInertiaCoeff: 0.0025, // Gillespie, Fundamentals of Vehicle Dynamics, eq. 2-10
  },
  topSpeedGovernorMph: 155, // electronically limited (Nissan)
}

// ---------------------------------------------------------------------------
// Nissan 370Z (2009–2020, Z34), VQ37VHR 3.7 L NA V6
// ---------------------------------------------------------------------------

/**
 * Approximate crank torque curve shaped to Nissan's ratings: 332 hp @ 7000
 * rpm, 270 lb-ft @ 5200 rpm (Nissan 370Z spec sheet). 249 lb-ft × 7000 /
 * 5252 = 332 hp. Shape informed by published VQ37VHR dyno plots (broad,
 * gently rising, peaking just above 5000 rpm).
 */
export const Z370_CURVE: TorqueCurve = [
  { rpm: 1000, lbft: 195 },
  { rpm: 1500, lbft: 215 },
  { rpm: 2000, lbft: 232 },
  { rpm: 2500, lbft: 245 },
  { rpm: 3000, lbft: 252 },
  { rpm: 3500, lbft: 256 },
  { rpm: 4000, lbft: 260 },
  { rpm: 4500, lbft: 265 },
  { rpm: 5000, lbft: 269 },
  { rpm: 5200, lbft: 270 },
  { rpm: 5500, lbft: 268 },
  { rpm: 6000, lbft: 263 },
  { rpm: 6500, lbft: 255 },
  { rpm: 7000, lbft: 249 },
  { rpm: 7500, lbft: 235 },
]

export const z370: Vehicle = {
  id: 'z370',
  name: 'Nissan 370Z 6MT (2009–2020)',
  shortName: '370Z',
  description: 'VQ37VHR 3.7 L naturally aspirated V6, 332 hp @ 7000 rpm, 270 lb-ft @ 5200 rpm, 6-speed manual.',
  hypothetical: false,
  chassis: {
    ...Z_CHASSIS,
    curbMassKg: 1496, // ≈ 3300 lb, 370Z Sport 6MT (Nissan quotes 3232–3333 lb depending on trim)
    tireRadiusM: 0.333, // 275/35R19 rear (Bridgestone Potenza RE050A), ≈ 770 rev/mile → 0.333 m
    cd: 0.3, // Nissan 370Z coupe
    frontalAreaM2: 2.0, // task brief (same as Z)
    frontWeightFraction: 0.54, // Nissan quotes 54/46 F/R for the 370Z coupe
    wheelbaseM: 2.55, // 100.4 in, same platform family
  },
  powertrain: {
    kind: 'ice',
    engine: {
      idleRpm: 700,
      limiterRpm: 7600, // fuel cut (task brief / owner reports)
      redlineRpm: 7500, // tach redline (Nissan)
      curve: Z370_CURVE,
      inertiaKgM2: 0.22, // estimate (lighter flywheel than the Z's dual-mass unit)
      turbo: { ...DEFAULT_TURBO_LAG, enabled: false }, // naturally aspirated
    },
    gearRatios: NISSAN_6MT_RATIOS,
    finalDrive: 3.692, // Nissan 370Z 6MT final drive
    efficiency: 0.92,
    shiftTimeS: 0.35,
    launchRpm: 5000, // high-rpm NA launch near peak torque; VQ37 makes little torque below 4000 (our choice)
    rotatingInertiaCoeff: 0.0025,
  },
  topSpeedGovernorMph: 155, // electronically limited (Nissan)
}

// ---------------------------------------------------------------------------
// Hypothetical rivals. The chassis is the Z's; only the engine/gearing change.
// ---------------------------------------------------------------------------

/**
 * "Same 400 hp, half the torque": a high-revving NA engine peaking at
 * 400 hp @ 9000 rpm (233 lb-ft × 9000 / 5252 = 399 hp). Curve from the task
 * brief; purely hypothetical.
 */
export const GHOST_HIGH_REV_CURVE: TorqueCurve = [
  { rpm: 1000, lbft: 120 },
  { rpm: 2000, lbft: 150 },
  { rpm: 3000, lbft: 175 },
  { rpm: 4000, lbft: 195 },
  { rpm: 5000, lbft: 210 },
  { rpm: 6000, lbft: 222 },
  { rpm: 7000, lbft: 230 },
  { rpm: 8000, lbft: 233 },
  { rpm: 9000, lbft: 233 },
  { rpm: 9400, lbft: 228 },
]

const GHOST_HIGH_REV_ENGINE: Engine = {
  idleRpm: 900,
  limiterRpm: 9400,
  redlineRpm: 9000,
  curve: GHOST_HIGH_REV_CURVE,
  inertiaKgM2: 0.13, // scaled with (6800/9400)² from the Z, see rotatingInertiaCoeff note
  turbo: { ...DEFAULT_TURBO_LAG, enabled: false },
}

/**
 * Rotating-inertia coefficient scaled so that the engine stores the same
 * kinetic energy as the Z's at the same fraction of redline:
 * k = 0.0025 × (6800 / limiter)². This keeps the "equal gearing-to-speed"
 * comparison fair (a 9400 rpm engine would have a much lighter flywheel; a
 * 4500 rpm diesel a much heavier one).
 */
export const scaledInertiaCoeff = (limiterRpm: number): number => 0.0025 * (6800 / limiterRpm) ** 2

export const ghostHighRev: Vehicle = {
  id: 'ghostHighRev',
  name: 'Ghost High-Rev NA (stock Z gearing)',
  shortName: 'HighRev',
  description:
    'Hypothetical NA engine: 400 hp @ 9000 rpm, 233 lb-ft peak, 9400 rpm limiter, in the Z chassis with the Z gearbox and 3.538 final drive. Taller effective gearing than the Z.',
  hypothetical: true,
  chassis: Z_CHASSIS,
  powertrain: {
    kind: 'ice',
    engine: GHOST_HIGH_REV_ENGINE,
    gearRatios: NISSAN_6MT_RATIOS,
    finalDrive: 3.538, // Z final drive — speed per gear is 9400/6800 = 1.38× higher
    efficiency: 0.92,
    shiftTimeS: 0.35,
    launchRpm: 6000, // NA engine with little torque below 5000 rpm (our choice)
    rotatingInertiaCoeff: scaledInertiaCoeff(9400),
  },
  topSpeedGovernorMph: 155,
}

export const ghostHighRevRegeared: Vehicle = {
  ...ghostHighRev,
  id: 'ghostHighRevRegeared',
  name: 'Ghost High-Rev NA (re-geared)',
  shortName: 'HighRev-RG',
  description:
    'Same hypothetical 400 hp / 9400 rpm engine, final drive raised to 3.538 × 9400/6800 = 4.89 so each gear tops out at the same road speed as the Z. The fair comparison.',
  powertrain: {
    ...(ghostHighRev.powertrain as IcePowertrain),
    finalDrive: 3.538 * (9400 / 6800), // ≈ 4.891
  },
}

/**
 * "Low-rev torque monster": 450 lb-ft from 1800–3200 rpm, 250 hp peak near
 * 4000 rpm (328 lb-ft × 4000 / 5252 = 250 hp), 4500 rpm limiter. Curve from
 * the task brief; purely hypothetical (a performance-diesel-like shape).
 */
export const GHOST_DIESEL_CURVE: TorqueCurve = [
  { rpm: 1000, lbft: 280 },
  { rpm: 1400, lbft: 380 },
  { rpm: 1800, lbft: 450 },
  { rpm: 2000, lbft: 450 },
  { rpm: 2500, lbft: 450 },
  { rpm: 3000, lbft: 450 },
  { rpm: 3200, lbft: 450 },
  { rpm: 3500, lbft: 375 },
  { rpm: 4000, lbft: 328 },
  { rpm: 4500, lbft: 280 },
]

const GHOST_DIESEL_ENGINE: Engine = {
  idleRpm: 750,
  limiterRpm: 4500,
  redlineRpm: 4200,
  curve: GHOST_DIESEL_CURVE,
  inertiaKgM2: 0.57, // scaled with (6800/4500)² from the Z
  turbo: { ...DEFAULT_TURBO_LAG, enabled: false }, // treat as lag-free so the comparison isolates the curve shape
}

export const ghostDiesel: Vehicle = {
  id: 'ghostDiesel',
  name: 'Ghost Diesel (re-geared)',
  shortName: 'Diesel-RG',
  description:
    'Hypothetical 450 lb-ft / 250 hp low-rev engine, final drive lowered to 3.538 × 4500/6800 = 2.34 so each gear tops out at the same road speed as the Z.',
  hypothetical: true,
  chassis: Z_CHASSIS,
  powertrain: {
    kind: 'ice',
    engine: GHOST_DIESEL_ENGINE,
    gearRatios: NISSAN_6MT_RATIOS,
    finalDrive: 3.538 * (4500 / 6800), // ≈ 2.341
    efficiency: 0.92,
    shiftTimeS: 0.35,
    launchRpm: 2200, // on the torque plateau (our choice)
    rotatingInertiaCoeff: scaledInertiaCoeff(4500),
  },
  topSpeedGovernorMph: 155,
}

export const ghostDieselStockGearing: Vehicle = {
  ...ghostDiesel,
  id: 'ghostDieselStockGearing',
  name: 'Ghost Diesel (stock Z gearing)',
  shortName: 'Diesel',
  description:
    'Same hypothetical 450 lb-ft engine with the Z\'s 3.538 final drive: each gear tops out at 4500/6800 = 66 % of the Z\'s speed, so it shifts far more often.',
  powertrain: {
    ...(ghostDiesel.powertrain as IcePowertrain),
    finalDrive: 3.538,
  },
}

// ---------------------------------------------------------------------------
// Generic performance EV (Tesla Model 3 Performance class)
// ---------------------------------------------------------------------------

export const ev: Vehicle = {
  id: 'ev',
  name: 'Generic Performance EV (AWD)',
  shortName: 'EV',
  description:
    'Model 3 Performance-class dual-motor EV: 480 lb-ft constant torque to base speed, then constant 450 hp, single-speed 9.0:1 reduction.',
  hypothetical: true,
  chassis: {
    ...Z_CHASSIS,
    curbMassKg: 1850, // ≈ 4080 lb, Tesla Model 3 Performance (Tesla spec, 2021–2023)
    cd: 0.23, // Tesla Model 3
    frontalAreaM2: 2.2, // Model 3 ≈ 2.2 m² (commonly quoted)
    frontWeightFraction: 0.49, // ≈ 49/51 (Tesla); irrelevant for AWD traction in this model
    tireRadiusM: 0.327, // task brief: same as Z (235/35R20 is ≈ 0.334 m; difference is immaterial)
    drive: 'awd',
  },
  powertrain: {
    kind: 'ev',
    motorTorqueLbft: 480, // task brief (combined motor torque at the rotors)
    maxPowerHp: 450, // task brief (≈ 2021 Model 3 Performance rating)
    maxMotorRpm: 18000, // task brief
    ratio: 9.0, // task brief (Tesla drive units ≈ 9:1)
    efficiency: 0.95, // single-stage helical reduction + inverter/motor at peak load; higher than a manual gearbox + hypoid diff (estimate)
    regenFraction: 0.1, // mild lift-off regen (estimate)
    rotatingInertiaCoeff: 0.0006, // EV rotors are small: ~0.05–0.1 kg·m² vs ~0.4 for ICE crank+flywheel implied by 0.0025 (estimate)
  },
  topSpeedGovernorMph: 162, // Model 3 Performance top speed (Tesla)
}

export const vehicles: Record<string, Vehicle> = {
  z: nissanZ,
  z370,
  ghostHighRev,
  ghostHighRevRegeared,
  ghostDiesel,
  ghostDieselStockGearing,
  ev,
}

export const vehicleList: Vehicle[] = Object.values(vehicles)

export function getVehicle(id: string): Vehicle {
  const v = vehicles[id]
  if (!v) throw new Error(`Unknown vehicle id "${id}"`)
  return v
}
