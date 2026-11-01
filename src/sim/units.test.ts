import { describe, expect, it } from 'vitest'
import {
  hpFromKw,
  hpFromTorqueRpm,
  inchesFromM,
  kgFromLb,
  kphFromMph,
  kwFromHp,
  lbFromKg,
  lbftFromNm,
  mFromInches,
  mphFromMps,
  mpsFromMph,
  nmFromLbft,
  torqueLbftFromHpRpm,
} from './units'

describe('units', () => {
  it('converts torque both ways', () => {
    expect(nmFromLbft(350)).toBeCloseTo(474.54, 1)
    expect(lbftFromNm(nmFromLbft(123.4))).toBeCloseTo(123.4, 9)
  })
  it('converts power both ways', () => {
    expect(kwFromHp(400)).toBeCloseTo(298.28, 1)
    expect(hpFromKw(kwFromHp(77))).toBeCloseTo(77, 9)
  })
  it('converts speed', () => {
    expect(mpsFromMph(60)).toBeCloseTo(26.8224, 4)
    expect(mphFromMps(mpsFromMph(100))).toBeCloseTo(100, 9)
    expect(kphFromMph(100)).toBeCloseTo(160.934, 2)
  })
  it('converts length and mass', () => {
    expect(mFromInches(26.6)).toBeCloseTo(0.67564, 4)
    expect(inchesFromM(1)).toBeCloseTo(39.3701, 3)
    expect(kgFromLb(3536)).toBeCloseTo(1603.9, 0)
    expect(lbFromKg(1694)).toBeCloseTo(3734.6, 0)
  })
  it('hp = lb-ft × rpm / 5252', () => {
    expect(hpFromTorqueRpm(328, 6400)).toBeCloseTo(399.7, 1)
    // crossover: at 5252 rpm hp and lb-ft are numerically equal
    expect(hpFromTorqueRpm(350, 5252)).toBeCloseTo(350, 9)
    expect(torqueLbftFromHpRpm(400, 6400)).toBeCloseTo(328.25, 2)
  })
})
