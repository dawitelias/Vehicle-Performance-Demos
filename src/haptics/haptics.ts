/**
 * Cross-platform haptics. Pure TypeScript, no React, no imports.
 *
 * Three back ends:
 *  - 'vibrate'    : `navigator.vibrate(pattern)` (Android Chrome/Firefox etc.).
 *  - 'ios-switch' : iOS has no vibrate API in any browser (they are all WebKit).
 *                   Safari 17.4+ plays the system "switch" haptic when a
 *                   `<input type="checkbox" switch>` toggles. We keep a hidden
 *                   one in the DOM and `.click()` it. This is BEST-EFFORT: it
 *                   only fires when the click happens inside a user-gesture
 *                   call chain (pointerdown/pointerup/click handlers) and when
 *                   the switch control is supported (iOS 17.4+). There is no
 *                   reliable feature test (`'switch' in input` is unreliable), so
 *                   we simply detect iOS. Multi-pulse kinds use setTimeout for
 *                   the later clicks; whether those count as gesture-chained is
 *                   up to the OS, so the first pulse is the one you can rely on.
 *  - 'none'       : everything else; `pulse` is a no-op.
 *
 * Every DOM access is guarded (`typeof document`), so the module is safe to
 * import in SSR and node tests. Call `prime()` from the first user gesture
 * (e.g. pointerdown) so the hidden switch exists before the first pulse.
 */

export type HapticKind = 'shift' | 'limiter' | 'tick' | 'launch'

export type HapticSupport = 'vibrate' | 'ios-switch' | 'none'

export interface Haptics {
  supported: HapticSupport
  pulse(kind: HapticKind): void
  /** Lazily creates the hidden iOS switch element. Safe to call repeatedly. */
  prime(): void
}

/** Vibration patterns in ms: [on, off, on, off, ...]. */
export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, readonly number[]>> = {
  shift: [18],
  limiter: [10, 30, 10, 30, 10],
  tick: [6],
  launch: [40],
}

/** Minimal slice of Navigator we need, so detection can be tested with fakes. */
export interface NavigatorLike {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  vibrate?: unknown
}

/**
 * iOS detection. iPadOS 13+ reports a desktop Safari UA with platform
 * 'MacIntel', so a Mac with a touch screen (which does not exist) is an iPad.
 */
export function isIOS(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  return /iP(hone|ad|od)/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

/** Which back end to use for the given navigator (defaults to the global one). */
export function detectSupport(nav: NavigatorLike | undefined = globalNavigator()): HapticSupport {
  if (!nav) return 'none'
  if (typeof nav.vibrate === 'function') return 'vibrate'
  if (isIOS(nav.userAgent ?? '', nav.platform ?? '', nav.maxTouchPoints ?? 0)) return 'ios-switch'
  return 'none'
}

/**
 * Converts a vibrate pattern into the start offsets (ms) of each "on" segment,
 * i.e. the moments to click the iOS switch. [10,30,10,30,10] → [0, 40, 80].
 */
export function clickTimesFromPattern(pattern: readonly number[]): number[] {
  const times: number[] = []
  let t = 0
  for (let i = 0; i < pattern.length; i++) {
    if (i % 2 === 0) times.push(t)
    t += Math.max(0, pattern[i] ?? 0)
  }
  return times
}

function globalNavigator(): NavigatorLike | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as NavigatorLike)
}

const SWITCH_ID = 'haptics-ios-switch'

function createSwitchElement(): HTMLInputElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  const existing = document.getElementById(SWITCH_ID)
  if (existing instanceof HTMLInputElement) return existing
  const el = document.createElement('input')
  el.type = 'checkbox'
  el.id = SWITCH_ID
  // `switch` is the Safari 17.4+ attribute that turns a checkbox into a toggle
  // switch with a system haptic. Set via setAttribute: it is not in the DOM typings.
  el.setAttribute('switch', '')
  el.setAttribute('aria-hidden', 'true')
  el.tabIndex = -1
  // Visually hidden but NOT display:none / visibility:hidden — a non-rendered
  // control does not produce the haptic.
  const s = el.style
  s.position = 'fixed'
  s.left = '0'
  s.bottom = '0'
  s.width = '1px'
  s.height = '1px'
  s.opacity = '0'
  s.pointerEvents = 'none'
  s.margin = '0'
  s.padding = '0'
  s.border = '0'
  s.zIndex = '-1'
  document.body.appendChild(el)
  return el
}

export function createHaptics(): Haptics {
  const supported = detectSupport()
  let switchEl: HTMLInputElement | null = null

  function prime(): void {
    if (supported !== 'ios-switch') return
    if (switchEl && switchEl.isConnected) return
    switchEl = createSwitchElement()
  }

  function clickSwitch(): void {
    const el = switchEl
    if (!el) return
    try {
      // click() toggles .checked and dispatches input/change events the way a
      // real tap does; programmatic `.checked = !checked` alone does not reliably
      // trigger the haptic.
      el.click()
    } catch {
      /* ignore */
    }
  }

  function pulse(kind: HapticKind): void {
    const pattern = HAPTIC_PATTERNS[kind]
    if (!pattern) return
    if (supported === 'vibrate') {
      const nav = globalNavigator()
      if (nav && typeof nav.vibrate === 'function') {
        try {
          ;(nav.vibrate as (p: number[]) => boolean).call(nav, [...pattern])
        } catch {
          /* ignore */
        }
      }
      return
    }
    if (supported === 'ios-switch') {
      prime()
      if (!switchEl) return
      const times = clickTimesFromPattern(pattern)
      for (const t of times) {
        if (t === 0) clickSwitch() // synchronous: stays inside the gesture chain
        else setTimeout(clickSwitch, t)
      }
    }
    // 'none': no-op
  }

  return { supported, pulse, prime }
}
