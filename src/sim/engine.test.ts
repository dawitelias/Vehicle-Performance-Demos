import { describe, expect, it } from 'vitest'
import {
  assertValidCurve,
  boostFactor,
  createBoostState,
  engineBrakingTorque,
  engineTorque,
  peakPower,
  peakTorque,
  powerAt,
  stepBoost,
  torqueAt,
} from './engine'
import { Z_ENGINE, Z_RATED_CURVE, Z_DYNO_CURVE, Z370_CURVE, GHOST_HIGH_REV_CURVE, GHOST_DIESEL_CURVE } from './vehicles'

describe('torque curve lookup', () => {
  it('all shipped curves are valid (strictly ascending rpm)', () => {
    for (const c of [Z_RATED_CURVE, Z_DYNO_CURVE, Z370_CURVE, GHOST_HIGH_REV_CURVE, GHOST_DIESEL_CURVE]) {
      expect(() => assertValidCurve(c)).not.toThrow()
    }
    expect(() => assertValidCurve([{ rpm: 2000, lbft: 1 }, { rpm: 1000, lbft: 2 }])).toThrow()
  })
  it('interpolates linearly between points', () => {
    expect(torqueAt(Z_RATED_CURVE, 1125)).toBeCloseTo(232.5, 9) // between 1000:215 and 1250:250
    expect(torqueAt(Z_RATED_CURVE, 3000)).toBe(350)
    expect(torqueAt(Z_RATED_CURVE, 6450)).toBeCloseTo(324.5, 9) // between 6400:328 and 6500:321
  })
  it('clamps at the ends', () => {
    expect(torqueAt(Z_RATED_CURVE, 0)).toBe(215)
    expect(torqueAt(Z_RATED_CURVE, 500)).toBe(215)
    expect(torqueAt(Z_RATED_CURVE, 9000)).toBe(288)
  })
})

describe('power', () => {
  it('Z rated curve peaks at ≈400 hp at 6400 rpm (±2 hp)', () => {
    const p = peakPower(Z_RATED_CURVE)
    expect(p.value).toBeGreaterThan(398)
    expect(p.value).toBeLessThan(402)
    expect(p.rpm).toBe(6400)
  })
  it('hp and lb-ft are numerically equal at 5252 rpm', () => {
    expect(powerAt(Z_RATED_CURVE, 5252)).toBeCloseTo(torqueAt(Z_RATED_CURVE, 5252), 9)
    expect(powerAt(Z370_CURVE, 5252)).toBeCloseTo(torqueAt(Z370_CURVE, 5252), 9)
  })
  it('Z rated peak torque is 350 lb-ft from 2000 rpm', () => {
    const t = peakTorque(Z_RATED_CURVE)
    expect(t.value).toBe(350)
    expect(t.rpm).toBe(2000)
  })
  it('370Z curve gives 332 hp @ 7000 and 270 lb-ft @ 5200 (the curve as specified keeps climbing slightly to 7500)', () => {
    expect(powerAt(Z370_CURVE, 7000)).toBeCloseTo(331.9, 0)
    expect(peakPower(Z370_CURVE).value).toBeLessThan(336)
    expect(peakTorque(Z370_CURVE).value).toBe(270)
    expect(peakTorque(Z370_CURVE).rpm).toBe(5200)
  })
  it('ghost high-rev makes ≈400 hp at 9000 (408 at the 9400 cut) and ghost diesel ≈250 hp at 4000', () => {
    expect(powerAt(GHOST_HIGH_REV_CURVE, 9000)).toBeCloseTo(399.3, 0)
    const hr = peakPower(GHOST_HIGH_REV_CURVE)
    expect(hr.value).toBeLessThan(409)
    expect(hr.rpm).toBeGreaterThanOrEqual(9000)
    const d = peakPower(GHOST_DIESEL_CURVE)
    expect(d.value).toBeGreaterThan(248)
    expect(d.value).toBeLessThan(276) // 450 lb-ft at 3200 is 274 hp; the "250 hp" figure is at 4000
    expect(powerAt(GHOST_DIESEL_CURVE, 4000)).toBeCloseTo(249.8, 0)
  })
})

describe('throttle, engine braking and limiter', () => {
  it('full throttle equals the curve, zero throttle is the braking term', () => {
    expect(engineTorque(Z_ENGINE, 3000, 1)).toBe(350)
    const brake = engineTorque(Z_ENGINE, 3000, 0)
    expect(brake).toBeCloseTo(-(0.03 * 350 + 0.000004 * 3000 * 3000), 9)
    expect(brake).toBeCloseTo(engineBrakingTorque(Z_RATED_CURVE, 3000), 9)
    expect(engineBrakingTorque(350, 3000)).toBeCloseTo(brake, 9)
  })
  it('part throttle blends drive and braking terms', () => {
    const half = engineTorque(Z_ENGINE, 3000, 0.5)
    expect(half).toBeCloseTo(0.5 * 350 + 0.5 * engineBrakingTorque(Z_RATED_CURVE, 3000), 9)
  })
  it('drive torque is cut at and above the limiter', () => {
    expect(engineTorque(Z_ENGINE, 6800, 1)).toBe(0)
    expect(engineTorque(Z_ENGINE, 7000, 1)).toBe(0)
    expect(engineTorque(Z_ENGINE, 6750, 1, { limiterWindowRpm: 100 })).toBeCloseTo(0.5 * torqueAt(Z_RATED_CURVE, 6750), 9)
  })
  it('uses the dyno curve when asked', () => {
    expect(engineTorque(Z_ENGINE, 3000, 1, { curveMode: 'dyno' })).toBe(392)
  })
})

describe('turbo lag', () => {
  it('ramps boost toward 1 with the 0.25 s time constant', () => {
    const b = createBoostState(0)
    stepBoost(Z_ENGINE, b, 1, 0.25)
    expect(b.boost).toBeCloseTo(1 - Math.exp(-1), 6)
    expect(boostFactor(Z_ENGINE, b)).toBeCloseTo(0.55 + 0.45 * (1 - Math.exp(-1)), 6)
  })
  it('decays more slowly when decoupled or off throttle', () => {
    const b = createBoostState(1)
    stepBoost(Z_ENGINE, b, 0, 0.35, true)
    expect(b.boost).toBeCloseTo(Math.exp(-0.35 / 0.6), 6)
  })
  it('is bypassed for NA engines', () => {
    const na = { ...Z_ENGINE, turbo: { ...Z_ENGINE.turbo!, enabled: false } }
    const b = createBoostState(0)
    stepBoost(na, b, 1, 0.001)
    expect(b.boost).toBe(1)
    expect(boostFactor(na, b)).toBe(1)
  })
  it('scales full-throttle torque by the boost factor', () => {
    const b = createBoostState(0)
    expect(engineTorque(Z_ENGINE, 3000, 1, { boost: b })).toBeCloseTo(350 * 0.55, 9)
  })
})
