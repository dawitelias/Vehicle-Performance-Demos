import { describe, expect, it } from 'vitest'
import {
  HAPTIC_PATTERNS,
  clickTimesFromPattern,
  createHaptics,
  detectSupport,
  isIOS,
  type HapticKind,
} from './haptics'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0 Mobile/15E148 Safari/604.1'
// iPadOS 13+ "desktop" UA: indistinguishable from a Mac except for touch points
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const MAC_UA = IPAD_DESKTOP_UA
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

describe('haptic pattern table', () => {
  it('has the specified patterns for every kind', () => {
    expect(HAPTIC_PATTERNS.shift).toEqual([18])
    expect(HAPTIC_PATTERNS.limiter).toEqual([10, 30, 10, 30, 10])
    expect(HAPTIC_PATTERNS.tick).toEqual([6])
    expect(HAPTIC_PATTERNS.launch).toEqual([40])
    const kinds: HapticKind[] = ['shift', 'limiter', 'tick', 'launch']
    for (const k of kinds) {
      expect(HAPTIC_PATTERNS[k].length).toBeGreaterThan(0)
      expect(HAPTIC_PATTERNS[k].every((ms) => ms > 0)).toBe(true)
    }
  })

  it('derives iOS switch click offsets from the on/off pattern', () => {
    expect(clickTimesFromPattern([18])).toEqual([0])
    expect(clickTimesFromPattern([10, 30, 10, 30, 10])).toEqual([0, 40, 80])
    expect(clickTimesFromPattern([5, 10, 5, 10])).toEqual([0, 15])
    expect(clickTimesFromPattern([])).toEqual([])
  })
})

describe('iOS detection', () => {
  it('detects iPhone / iPad / iPod user agents', () => {
    expect(isIOS(IPHONE_UA)).toBe(true)
    expect(isIOS(IPAD_UA)).toBe(true)
    expect(isIOS('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)')).toBe(true)
  })
  it('detects iPadOS desktop-mode via MacIntel + touch points', () => {
    expect(isIOS(IPAD_DESKTOP_UA, 'MacIntel', 5)).toBe(true)
    expect(isIOS(MAC_UA, 'MacIntel', 0)).toBe(false)
    expect(isIOS(MAC_UA, 'MacIntel', 1)).toBe(false)
  })
  it('rejects Android and Windows', () => {
    expect(isIOS(ANDROID_UA, 'Linux armv81', 5)).toBe(false)
    expect(isIOS(WINDOWS_UA, 'Win32', 0)).toBe(false)
    expect(isIOS('')).toBe(false)
  })
})

describe('detectSupport', () => {
  it('prefers navigator.vibrate when present', () => {
    expect(detectSupport({ userAgent: ANDROID_UA, vibrate: () => true })).toBe('vibrate')
    // even a hypothetical iOS browser exposing vibrate would use it
    expect(detectSupport({ userAgent: IPHONE_UA, vibrate: () => true })).toBe('vibrate')
  })
  it('falls back to the iOS switch trick on iOS without vibrate', () => {
    expect(detectSupport({ userAgent: IPHONE_UA })).toBe('ios-switch')
    expect(detectSupport({ userAgent: IPAD_DESKTOP_UA, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(
      'ios-switch',
    )
  })
  it('is none on desktop without vibrate and when no navigator exists', () => {
    expect(detectSupport({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('none')
    expect(detectSupport({ userAgent: WINDOWS_UA, platform: 'Win32' })).toBe('none')
    expect(detectSupport(undefined)).toBe('none')
    expect(detectSupport({})).toBe('none')
  })
})

describe('createHaptics in node (no DOM, no vibrate)', () => {
  it('reports none and all methods are harmless no-ops', () => {
    const h = createHaptics()
    expect(h.supported).toBe('none')
    expect(() => h.prime()).not.toThrow()
    expect(() => h.pulse('shift')).not.toThrow()
    expect(() => h.pulse('limiter')).not.toThrow()
    expect(() => h.pulse('tick')).not.toThrow()
    expect(() => h.pulse('launch')).not.toThrow()
  })
})
