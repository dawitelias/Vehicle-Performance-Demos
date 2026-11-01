import { describe, expect, it } from 'vitest'
import { createRun, rollingAccel, simulate, speedToSpeed, timeToMph } from './longitudinal'
import { rpmAtMph, topSpeedPerGearMph } from './drivetrain'
import { mphFromMps } from './units'
import { ev, ghostDiesel, ghostDieselStockGearing, ghostHighRev, ghostHighRevRegeared, nissanZ, z370 } from './vehicles'

const run = (v: Parameters<typeof simulate>[0], opts = {}) => simulate(v, { duration: 40, ...opts })

describe('Nissan Z (rated curve)', () => {
  const tr = run(nissanZ)
  const m = tr.metrics

  it('0–60 mph between 4.0 and 4.9 s (published 4.3–4.5 with 1-ft rollout)', () => {
    expect(m.zeroToSixtyS).not.toBeNull()
    expect(m.zeroToSixtyS!).toBeGreaterThan(4.0)
    expect(m.zeroToSixtyS!).toBeLessThan(4.9)
    // the rollout figure should sit in or near the published band
    expect(m.zeroToSixtyRolloutS!).toBeGreaterThan(4.1)
    expect(m.zeroToSixtyRolloutS!).toBeLessThan(4.7)
  })
  it('¼ mile ET between 12.4 and 13.3 s, trap 108–116 mph', () => {
    const q = m.quarterMile!
    expect(q.timeS).toBeGreaterThan(12.4)
    expect(q.timeS).toBeLessThan(13.3)
    expect(q.timeFromRestS).toBeGreaterThan(q.timeS)
    expect(q.timeFromRestS - q.timeS).toBeLessThan(0.5)
    expect(q.trapMph).toBeGreaterThan(108)
    expect(q.trapMph).toBeLessThan(116)
  })
  it('reaches 100 and 130 mph in a sensible time', () => {
    expect(m.zeroToHundredS!).toBeGreaterThan(9.5)
    expect(m.zeroToHundredS!).toBeLessThan(12.5)
    expect(m.sixtyToOneThirtyS!).toBeGreaterThan(10)
    expect(m.sixtyToOneThirtyS!).toBeLessThan(16)
  })
  it('top speed clamps at the 155 mph governor', () => {
    const long = simulate(nissanZ, { duration: 90 })
    expect(long.metrics.topSpeedMph).toBeGreaterThan(153.5)
    expect(long.metrics.topSpeedMph).toBeLessThanOrEqual(155.05)
    // and it is held there, not oscillating wildly
    const tail = long.v.subarray(long.length - 400)
    for (const v of tail) expect(mphFromMps(v)).toBeGreaterThan(153.5)
  })
  it('without a governor it goes faster', () => {
    const free = simulate(nissanZ, { duration: 120, topSpeedGovernorMph: Infinity })
    expect(free.metrics.topSpeedMph).toBeGreaterThan(160)
  })
  it('shifts at the limiter in every gear and never exceeds it', () => {
    for (let i = 0; i < tr.length; i++) expect(tr.rpm[i]).toBeLessThanOrEqual(6800 + 1e-6)
    const gearsSeen = new Set(Array.from(tr.gear))
    expect(gearsSeen.has(1) && gearsSeen.has(2) && gearsSeen.has(3) && gearsSeen.has(4)).toBe(true)
  })
  it('is traction-limited off the line and torque-limited in 2nd', () => {
    const i1 = Math.round(1.0 / tr.dt)
    expect(tr.tractionLimited[i1]).toBe(1)
    expect(tr.gear[i1]).toBe(1)
    const i2 = Math.round(4.5 / tr.dt)
    expect(tr.gear[i2]).toBe(2)
    expect(tr.tractionLimited[i2]).toBe(0)
  })
  it('dyno curve is quicker than the rated curve', () => {
    const d = run(nissanZ, { dyno: 'dyno' })
    expect(d.metrics.zeroToSixtyS!).toBeLessThan(m.zeroToSixtyS!)
    expect(d.metrics.quarterMile!.timeS).toBeLessThan(m.quarterMile!.timeS)
  })
  it('turbo lag off is slightly quicker', () => {
    const nolag = run(nissanZ, { turboLag: false })
    expect(nolag.metrics.zeroToSixtyS!).toBeLessThanOrEqual(m.zeroToSixtyS!)
    expect(m.zeroToSixtyS! - nolag.metrics.zeroToSixtyS!).toBeLessThan(0.3)
  })
  it('a lower shift point is slower (optimal really is optimal here)', () => {
    const early = run(nissanZ, { shiftRpm: 5500 })
    expect(early.metrics.zeroToSixtyS!).toBeGreaterThan(m.zeroToSixtyS!)
  })
})

describe('rivals', () => {
  const z = run(nissanZ).metrics
  it('370Z 0–60 between 4.8 and 5.6 s (published ~5.0–5.3)', () => {
    const m = run(z370).metrics
    expect(m.zeroToSixtyS!).toBeGreaterThan(4.8)
    expect(m.zeroToSixtyS!).toBeLessThan(5.6)
    expect(m.quarterMile!.trapMph).toBeGreaterThan(102)
    expect(m.quarterMile!.trapMph).toBeLessThan(110)
  })
  it('re-geared ghost high-rev is within 0.3 s of the Z to 60 (same hp, same gearing-to-speed)', () => {
    const m = run(ghostHighRevRegeared).metrics
    expect(Math.abs(m.zeroToSixtyS! - z.zeroToSixtyS!)).toBeLessThan(0.3)
    expect(topSpeedPerGearMph(ghostHighRevRegeared)[0]).toBeCloseTo(topSpeedPerGearMph(nissanZ)[0], 1)
  })
  it('stock-geared ghost high-rev is slower off the line than the re-geared one and the Z', () => {
    const stock = run(ghostHighRev).metrics
    const rg = run(ghostHighRevRegeared).metrics
    expect(stock.zeroToSixtyS!).toBeGreaterThan(rg.zeroToSixtyS!)
    expect(stock.zeroToSixtyS!).toBeGreaterThan(z.zeroToSixtyS!)
    expect(timeToMph(run(ghostHighRev), 30)!).toBeGreaterThan(timeToMph(run(ghostHighRevRegeared), 30)!)
  })
  it('ghost diesel is markedly slower to 60 (>6 s) despite more torque, in both gearings', () => {
    expect(run(ghostDiesel).metrics.zeroToSixtyS!).toBeGreaterThan(6)
    expect(run(ghostDieselStockGearing).metrics.zeroToSixtyS!).toBeGreaterThan(6)
    expect(run(ghostDiesel).metrics.quarterMile!.trapMph).toBeLessThan(z.quarterMile!.trapMph - 8)
  })
  it('EV 0–60 between 3.0 and 3.8 s, with no shifts', () => {
    const tr = run(ev)
    expect(tr.metrics.zeroToSixtyS!).toBeGreaterThan(3.0)
    expect(tr.metrics.zeroToSixtyS!).toBeLessThan(3.8)
    for (let i = 0; i < tr.length; i++) expect(tr.gear[i]).toBe(1)
    expect(tr.metrics.topSpeedMph).toBeLessThanOrEqual(162.05)
  })
})

describe('rolling acceleration in a fixed gear', () => {
  it('Z 50→80 in 6th takes much longer than in 3rd (≈2×), and 3rd stays below the limiter at 80', () => {
    const g3 = rollingAccel(nissanZ, { fromMph: 50, toMph: 80, gear: 3 })
    const g6 = rollingAccel(nissanZ, { fromMph: 50, toMph: 80, gear: 6 })
    expect(g3.reachable).toBe(true)
    expect(g6.reachable).toBe(true)
    expect(g6.timeS / g3.timeS).toBeGreaterThan(1.8)
    expect(g6.timeS / g3.timeS).toBeLessThan(3.2)
    expect(rpmAtMph(nissanZ, 80, 2)).toBeLessThan(6800)
    expect(topSpeedPerGearMph(nissanZ)[2]).toBeGreaterThan(89)
    expect(g3.distanceM).toBeGreaterThan(0)
    expect(g6.distanceM).toBeGreaterThan(g3.distanceM)
  })
  it('reports the limiter when the gear cannot reach the target', () => {
    const r = rollingAccel(nissanZ, { fromMph: 50, toMph: 80, gear: 2 })
    expect(r.reachable).toBe(false)
    expect(r.reason).toBe('limiter')
    expect(r.reachedMph).toBeGreaterThan(62)
    expect(r.reachedMph).toBeLessThan(63.5)
  })
  it('reports a stall when the start speed is below idle in that gear', () => {
    const r = rollingAccel(nissanZ, { fromMph: 3, toMph: 30, gear: 6 })
    expect(r.reachable).toBe(false)
    expect(r.reason).toBe('stall')
  })
  it('370Z suffers more from a tall gear than the Z (NA vs flat turbo torque)', () => {
    const z6 = rollingAccel(nissanZ, { fromMph: 50, toMph: 80, gear: 6 })
    const z3 = rollingAccel(nissanZ, { fromMph: 50, toMph: 80, gear: 3 })
    const n6 = rollingAccel(z370, { fromMph: 50, toMph: 80, gear: 6 })
    const n3 = rollingAccel(z370, { fromMph: 50, toMph: 80, gear: 3 })
    expect(n6.timeS / n3.timeS).toBeGreaterThan(z6.timeS / z3.timeS)
  })
  it('EV single gear just works', () => {
    const r = rollingAccel(ev, { fromMph: 50, toMph: 80, gear: 1 })
    expect(r.reachable).toBe(true)
    expect(r.timeS).toBeLessThan(3.5)
  })
})

describe('stepper API', () => {
  it('holding throttle in 1st from rest reaches the limiter and stays there, at or below ~40 mph', () => {
    const r = createRun(nissanZ, { shiftStrategy: 'hold' })
    const dt = 1 / 60
    for (let t = 0; t < 12; t += dt) r.step(dt, { throttle: 1 })
    expect(r.state.gear).toBe(1)
    expect(r.state.rpm).toBeGreaterThan(6800 - 60)
    expect(r.state.rpm).toBeLessThanOrEqual(6800)
    expect(mphFromMps(r.state.v)).toBeLessThanOrEqual(40)
    expect(mphFromMps(r.state.v)).toBeGreaterThan(37.5)
    expect(r.state.onLimiter).toBe(true)
  })
  it('paddle up-shift changes gear after the shift time and drops rpm', () => {
    const r = createRun(nissanZ, { shiftStrategy: 'hold' })
    const dt = 0.005
    for (let t = 0; t < 3; t += dt) r.step(dt, { throttle: 1 })
    const rpmBefore = r.state.rpm
    r.step(dt, { throttle: 1, shiftUp: true })
    expect(r.state.shifting).toBe(true)
    expect(r.state.clutch).toBe('open')
    expect(r.state.wheelForce).toBe(0)
    for (let t = 0; t < 0.36; t += dt) r.step(dt, { throttle: 1 })
    expect(r.state.shifting).toBe(false)
    expect(r.state.gear).toBe(2)
    expect(r.state.rpm).toBeLessThan(rpmBefore * 0.7)
    expect(r.state.shiftCount).toBe(1)
  })
  it('refuses a down-shift that would over-rev', () => {
    const r = createRun(nissanZ, { shiftStrategy: 'hold', startGear: 2, startSpeedMps: 25 }) // ≈ 56 mph, 1st would be ~9800 rpm
    r.step(0.005, { throttle: 1, shiftDown: true })
    expect(r.state.gear).toBe(2)
    expect(r.state.shifting).toBe(false)
  })
  it('clutch pedal lets the engine free-rev; lifting it reconnects', () => {
    const r = createRun(nissanZ, { shiftStrategy: 'hold' })
    for (let i = 0; i < 100; i++) r.step(0.005, { throttle: 1, clutch: 1 })
    expect(r.state.v).toBe(0)
    expect(r.state.rpm).toBeGreaterThan(2000)
    for (let i = 0; i < 200; i++) r.step(0.005, { throttle: 1 })
    expect(r.state.v).toBeGreaterThan(0)
  })
  it('throttle off from speed coasts down (engine braking + drag), never reverses', () => {
    const r = createRun(nissanZ, { shiftStrategy: 'hold', startGear: 3, startSpeedMps: 20 })
    for (let i = 0; i < 2000; i++) r.step(0.005, { throttle: 0 })
    expect(r.state.v).toBeLessThan(20)
    expect(r.state.v).toBeGreaterThanOrEqual(0)
    expect(r.state.engineTorqueLbft).toBeLessThanOrEqual(0)
  })
  it('reset restores the initial state', () => {
    const r = createRun(nissanZ)
    for (let i = 0; i < 100; i++) r.step(0.01, { throttle: 1 })
    r.reset()
    expect(r.state.t).toBe(0)
    expect(r.state.v).toBe(0)
    expect(r.state.gear).toBe(1)
  })
})

describe('numerics', () => {
  it('is deterministic', () => {
    const a = simulate(nissanZ, { duration: 20 })
    const b = simulate(nissanZ, { duration: 20 })
    expect(Array.from(a.v)).toEqual(Array.from(b.v))
    expect(a.metrics).toEqual(b.metrics)
  })
  it('a 30 s run at dt 0.005 takes < 50 ms', () => {
    simulate(nissanZ, { duration: 5 }) // warm-up
    const t0 = performance.now()
    const tr = simulate(nissanZ, { duration: 30, dt: 0.005 })
    const ms = performance.now() - t0
    expect(tr.length).toBe(6001)
    expect(ms).toBeLessThan(50)
  })
  it('is insensitive to the time step (dt 1 ms vs 5 ms within 0.03 s to 60)', () => {
    const fine = simulate(nissanZ, { duration: 10, dt: 0.001 }).metrics.zeroToSixtyS!
    const coarse = simulate(nissanZ, { duration: 10, dt: 0.005 }).metrics.zeroToSixtyS!
    expect(Math.abs(fine - coarse)).toBeLessThan(0.03)
  })
  it('speedToSpeed matches timeToMph differences', () => {
    const tr = simulate(nissanZ, { duration: 30 })
    const s = speedToSpeed(tr, 30, 70)!
    expect(s.timeS).toBeCloseTo(timeToMph(tr, 70)! - timeToMph(tr, 30)!, 9)
    expect(s.distanceM).toBeGreaterThan(0)
  })
  it('scripted throttle function is honoured', () => {
    const tr = simulate(nissanZ, { duration: 5, throttle: (t) => (t < 2 ? 1 : 0) })
    const i = Math.round(3 / tr.dt)
    expect(tr.throttle[i]).toBe(0)
    expect(tr.a[i]).toBeLessThan(0)
  })
})
