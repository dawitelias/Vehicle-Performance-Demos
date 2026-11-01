import { describe, expect, it } from 'vitest'
import {
  effectiveMassFactor,
  optimalShiftPoints,
  overallRatios,
  resistanceForce,
  rpmFromSpeed,
  speedAtRpmPerGear,
  speedFromRpm,
  tractiveForceCurve,
  vehicleWheelForceAtRpm,
  wheelForce,
  wheelTorque,
} from './drivetrain'
import { mpsFromMph } from './units'
import { ev, ghostDiesel, ghostHighRevRegeared, nissanZ, z370 } from './vehicles'

describe('basic relations', () => {
  it('wheel torque and force', () => {
    expect(wheelTorque(100, 2, 3, 0.9)).toBeCloseTo(540, 9)
    expect(wheelForce(100, 2, 3, 0.9, 0.3)).toBeCloseTo(1800, 9)
  })
  it('rpm ↔ speed are inverses', () => {
    const v = mpsFromMph(60)
    const rpm = rpmFromSpeed(v, 1.624, 3.538, 0.327)
    expect(speedFromRpm(rpm, 1.624, 3.538, 0.327)).toBeCloseTo(v, 9)
    expect(rpm).toBeCloseTo(4500, -2) // ≈ 4500 rpm at 60 mph in 3rd
  })
  it('overall ratios', () => {
    expect(overallRatios(nissanZ)[0]).toBeCloseTo(3.794 * 3.538, 9)
    expect(overallRatios(ev)).toEqual([9])
  })
})

describe('speed per gear', () => {
  it('Z at 6800 rpm ≈ [39, 63, 91, 116, 147, 185] mph (±1.5)', () => {
    const mph = speedAtRpmPerGear(nissanZ, 6800)
    const expected = [39, 63, 91, 116, 147, 185]
    expect(mph).toHaveLength(6)
    mph.forEach((m, i) => expect(Math.abs(m - expected[i])).toBeLessThan(1.5))
  })
  it('EV base speed is ≈ 42 mph (torque → power crossover at 4923 motor rpm)', () => {
    const rpmBase = (450 * 5252) / 480
    expect(speedAtRpmPerGear(ev, rpmBase)[0]).toBeCloseTo(42.0, 0)
  })
})

describe('effective mass factor', () => {
  it('follows 1 + 0.04 + k·N²', () => {
    const n1 = 3.794 * 3.538
    expect(effectiveMassFactor(nissanZ, 0)).toBeCloseTo(1.04 + 0.0025 * n1 * n1, 9)
    expect(effectiveMassFactor(nissanZ, 5)).toBeCloseTo(1.04 + 0.0025 * (0.794 * 3.538) ** 2, 9)
    expect(effectiveMassFactor(nissanZ, 5)).toBeLessThan(1.07)
  })
})

describe('optimal shift points', () => {
  it('Z: wheel force in the next gear never exceeds the current gear before the limiter', () => {
    expect(optimalShiftPoints(nissanZ)).toEqual([6800, 6800, 6800, 6800, 6800, 6800])
  })
  it('Z dyno curve: same', () => {
    expect(optimalShiftPoints(nissanZ, 'dyno')).toEqual([6800, 6800, 6800, 6800, 6800, 6800])
  })
  it('370Z: at (or very near) the 7600 limiter', () => {
    for (const r of optimalShiftPoints(z370)) expect(r).toBeGreaterThanOrEqual(7400)
  })
  it('ghost high-rev: at the limiter', () => {
    expect(optimalShiftPoints(ghostHighRevRegeared)).toEqual([9400, 9400, 9400, 9400, 9400, 9400])
  })
  it('ghost diesel: near its 4500 limiter (torque falls 25 % from 3200 to 4000, so a few gears shift ~3700)', () => {
    const pts = optimalShiftPoints(ghostDiesel)
    expect(pts).toHaveLength(6)
    expect(pts[0]).toBe(4500)
    for (const r of pts) {
      expect(r).toBeGreaterThanOrEqual(3600)
      expect(r).toBeLessThanOrEqual(4500)
    }
  })
  it('EV: single gear → limiter', () => {
    expect(optimalShiftPoints(ev)).toEqual([18000])
  })
})

describe('tractive force', () => {
  it('Z 1st gear at 3500 rpm ≈ 17.9 kN at the contact patch', () => {
    expect(vehicleWheelForceAtRpm(nissanZ, 3500, 0)).toBeCloseTo(17940, -2)
  })
  it('curve is monotonic in speed and ends at the limiter', () => {
    const pts = tractiveForceCurve(nissanZ, 2, 30)
    expect(pts).toHaveLength(31)
    for (let i = 1; i < pts.length; i++) expect(pts[i].mph).toBeGreaterThan(pts[i - 1].mph)
    expect(pts[pts.length - 1].rpm).toBe(6800)
    expect(pts[pts.length - 1].mph).toBeCloseTo(90.7, 0)
  })
  it('EV force is flat then ∝ 1/v', () => {
    const pts = tractiveForceCurve(ev, 0, 100)
    expect(pts[1].force).toBeCloseTo(pts[5].force, 6)
    const hi = pts[pts.length - 1]
    const mid = pts[Math.floor(pts.length * 0.6)]
    expect((hi.force * hi.mph) / (mid.force * mid.mph)).toBeCloseTo(1, 2)
  })
  it('resistance is drag + rolling and zero at rest', () => {
    expect(resistanceForce(nissanZ, 0)).toBe(0)
    const v = mpsFromMph(60)
    const drag = 0.5 * 1.225 * 0.31 * 2.0 * v * v
    const roll = 0.012 * 1694 * 9.80665
    expect(resistanceForce(nissanZ, v)).toBeCloseTo(drag + roll, 6)
  })
})
