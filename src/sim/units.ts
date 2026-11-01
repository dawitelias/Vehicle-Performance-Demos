/**
 * Unit conversions and physical constants used throughout the simulator.
 * Internally the sim works in SI (m, kg, s, N, N·m, W). Torque curves are
 * authored in lb-ft and power is reported in hp because that is what the
 * source material (manufacturer spec sheets, dyno charts) uses.
 */

/** Standard gravity, m/s². */
export const G = 9.80665
/** Sea-level dry air density at 15 °C, kg/m³ (ISA). */
export const AIR_DENSITY = 1.225

export const NM_PER_LBFT = 1.3558179483314004
export const W_PER_HP = 745.6998715822702 // mechanical horsepower
export const M_PER_MILE = 1609.344
export const M_PER_INCH = 0.0254
export const KG_PER_LB = 0.45359237
export const MPS_PER_MPH = M_PER_MILE / 3600 // 0.44704
export const MPS_PER_KPH = 1000 / 3600
/** hp = lb-ft × rpm / 5252 (5252 = 33000 / 2π). */
export const HP_CONSTANT = 5252

// Torque
export const nmFromLbft = (lbft: number): number => lbft * NM_PER_LBFT
export const lbftFromNm = (nm: number): number => nm / NM_PER_LBFT

// Power
export const kwFromHp = (hp: number): number => (hp * W_PER_HP) / 1000
export const hpFromKw = (kw: number): number => (kw * 1000) / W_PER_HP
export const wattsFromHp = (hp: number): number => hp * W_PER_HP
export const hpFromWatts = (w: number): number => w / W_PER_HP

// Speed
export const mpsFromMph = (mph: number): number => mph * MPS_PER_MPH
export const mphFromMps = (mps: number): number => mps / MPS_PER_MPH
export const mpsFromKph = (kph: number): number => kph * MPS_PER_KPH
export const kphFromMps = (mps: number): number => mps / MPS_PER_KPH
export const kphFromMph = (mph: number): number => kphFromMps(mpsFromMph(mph))
export const mphFromKph = (kph: number): number => mphFromMps(mpsFromKph(kph))

// Length
export const mFromInches = (inches: number): number => inches * M_PER_INCH
export const inchesFromM = (m: number): number => m / M_PER_INCH
export const mFromFeet = (ft: number): number => ft * 12 * M_PER_INCH
export const feetFromM = (m: number): number => m / (12 * M_PER_INCH)
export const mFromMiles = (mi: number): number => mi * M_PER_MILE

// Mass
export const kgFromLb = (lb: number): number => lb * KG_PER_LB
export const lbFromKg = (kg: number): number => kg / KG_PER_LB

// Angular velocity
export const radPerSecFromRpm = (rpm: number): number => (rpm * 2 * Math.PI) / 60
export const rpmFromRadPerSec = (w: number): number => (w * 60) / (2 * Math.PI)

/** Horsepower from torque in lb-ft and engine speed in rpm. */
export const hpFromTorqueRpm = (lbft: number, rpm: number): number => (lbft * rpm) / HP_CONSTANT
/** Torque (lb-ft) from horsepower and engine speed in rpm. */
export const torqueLbftFromHpRpm = (hp: number, rpm: number): number =>
  rpm === 0 ? 0 : (hp * HP_CONSTANT) / rpm

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
