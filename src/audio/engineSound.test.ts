import { describe, expect, it } from 'vitest'
import {
  LIMITER_WINDOW_RPM,
  blendedWave,
  createEngineSound,
  cutoffFor,
  engineGainFor,
  estimateBoost,
  firingFrequency,
  gritCurve,
  hissCenterFor,
  hissGainFor,
  isAtLimiter,
  lopeDepthFor,
  lopeRateFor,
  softClipCurve,
  whistleFreqFor,
  whistleGainFor,
} from './engineSound'

describe('engineSound pure helpers', () => {
  it('firing frequency is 3 per rev for a 6-cyl 4-stroke', () => {
    expect(firingFrequency(600)).toBeCloseTo(30, 9) // 10 rev/s × 3
    expect(firingFrequency(7000)).toBeCloseTo(350, 9)
    expect(firingFrequency(0)).toBe(0)
    expect(firingFrequency(-500)).toBe(0)
    expect(firingFrequency(6000, 8)).toBeCloseTo(400, 9) // V8: 4 per rev
  })

  it('cutoff rises with rpm and throttle, closed throttle stays muffled', () => {
    const idleClosed = cutoffFor(700, 0)
    const idleOpen = cutoffFor(700, 1)
    const redlineClosed = cutoffFor(7000, 0)
    const redlineOpen = cutoffFor(7000, 1)
    expect(idleOpen).toBeGreaterThan(idleClosed)
    expect(redlineClosed).toBeGreaterThan(idleClosed)
    expect(redlineOpen).toBeGreaterThan(redlineClosed)
    expect(redlineClosed).toBeLessThan(3000)
    expect(redlineOpen).toBeGreaterThan(8000)
    // clamped
    expect(cutoffFor(0, 0)).toBe(220)
    expect(cutoffFor(1e6, 1)).toBe(12000)
    // bad throttle input does not produce NaN
    expect(Number.isFinite(cutoffFor(3000, Number.NaN))).toBe(true)
  })

  it('engine gain increases with throttle and rpm and stays in a sane range', () => {
    expect(engineGainFor(700, 0)).toBeLessThan(engineGainFor(700, 1))
    expect(engineGainFor(700, 1)).toBeLessThan(engineGainFor(7000, 1))
    expect(engineGainFor(0, 0)).toBeGreaterThan(0)
    expect(engineGainFor(7000, 1)).toBeLessThanOrEqual(1)
  })

  it('boost estimate is zero off-throttle or below spool rpm and rises after', () => {
    expect(estimateBoost(3000, 0)).toBe(0)
    expect(estimateBoost(1500, 1)).toBe(0)
    expect(estimateBoost(3250, 1)).toBeCloseTo(0.5, 9)
    expect(estimateBoost(6000, 1)).toBe(1)
  })

  it('turbo hiss and whine track throttle and boost', () => {
    expect(hissGainFor(0, 1)).toBe(0)
    expect(hissGainFor(1, 0)).toBe(0)
    expect(hissGainFor(1, 1)).toBeGreaterThan(hissGainFor(0.5, 0.5))
    expect(hissCenterFor(0)).toBeGreaterThanOrEqual(2000)
    expect(hissCenterFor(1)).toBeLessThanOrEqual(6000)
    expect(whistleFreqFor(0)).toBe(8000)
    expect(whistleFreqFor(1)).toBe(14000)
    expect(whistleFreqFor(2)).toBe(14000) // clamped
    expect(whistleGainFor(0)).toBe(0)
    expect(whistleGainFor(1)).toBeGreaterThan(whistleGainFor(0.5))
    expect(whistleGainFor(1)).toBeLessThan(0.05) // faint
  })

  it('limiter engages within 80 rpm of the limiter', () => {
    expect(LIMITER_WINDOW_RPM).toBe(80)
    expect(isAtLimiter(6900, 7000)).toBe(false)
    expect(isAtLimiter(6920, 7000)).toBe(true)
    expect(isAtLimiter(7000, 7000)).toBe(true)
    expect(isAtLimiter(7100, 7000)).toBe(true)
  })

  it('idle lope is present at idle and gone above idle', () => {
    expect(lopeDepthFor(700, 700)).toBeCloseTo(0.1, 9)
    expect(lopeDepthFor(1050, 700)).toBeCloseTo(0.05, 9)
    expect(lopeDepthFor(1400, 700)).toBe(0)
    expect(lopeDepthFor(5000, 700)).toBe(0)
    expect(lopeRateFor(700, 700)).toBeGreaterThan(1)
    expect(lopeRateFor(700, 700)).toBeLessThan(10)
  })

  it('blended wave: square has only odd harmonics, saw has all, blend is in between', () => {
    const square = blendedWave(8, 0)
    const saw = blendedWave(8, 1)
    const blend = blendedWave(8, 0.5)
    expect(square.real.length).toBe(9)
    expect(square.imag[0]).toBe(0)
    expect(square.imag[2]).toBe(0)
    expect(square.imag[4]).toBe(0)
    expect(square.imag[1]).toBeCloseTo(4 / Math.PI, 5)
    expect(saw.imag[1]).toBeCloseTo(2 / Math.PI, 5)
    expect(saw.imag[2]).toBeCloseTo(-1 / Math.PI, 5)
    expect(saw.imag[2]).not.toBe(0)
    expect(blend.imag[1]).toBeGreaterThan(saw.imag[1])
    expect(blend.imag[1]).toBeLessThan(square.imag[1])
    // level scales everything
    const scaled = blendedWave(8, 1, 0.5)
    expect(scaled.imag[1]).toBeCloseTo(saw.imag[1] * 0.5, 6)
    // real part is all zero (pure sine series)
    expect(Array.from(saw.real).every((v) => v === 0)).toBe(true)
  })

  it('soft clip curve is odd-symmetric, monotonic and bounded to ±1', () => {
    const c = softClipCurve(1025)
    expect(c[0]).toBeCloseTo(-1, 6)
    expect(c[1024]).toBeCloseTo(1, 6)
    expect(c[512]).toBeCloseTo(0, 6)
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1])
    for (let i = 0; i < 512; i++) expect(c[i]).toBeCloseTo(-c[1024 - i], 6)
    // compresses: mid-level input is above the linear line
    expect(c[768]).toBeGreaterThan(0.5)
  })

  it('grit curve is monotonic, bounded, and asymmetric', () => {
    const c = gritCurve(1025)
    expect(c[1024]).toBeCloseTo(1, 6)
    expect(c[0]).toBeGreaterThan(-1.0001)
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
    // asymmetric: |f(-x)| != f(x) for mid-level x
    expect(Math.abs(c[256])).not.toBeCloseTo(c[768], 2)
  })
})

describe('createEngineSound without WebAudio (node)', () => {
  it('is inert: set/setVolume/stop never throw and start resolves', async () => {
    const s = createEngineSound({ idleRpm: 800, limiterRpm: 7000 })
    expect(s.running).toBe(false)
    s.set({ rpm: 3000, throttle: 0.5 })
    s.setVolume(0.3)
    await expect(s.start()).resolves.toBeUndefined()
    expect(s.running).toBe(false) // no AudioContext available in node
    s.stop()
    s.stop() // idempotent
    expect(s.running).toBe(false)
  })
})
