/**
 * Procedural V6 twin-turbo engine sound (WebAudio), modelled loosely on the
 * 3.0 L VR30DDTT. Pure TypeScript, no React, no imports.
 *
 * All AudioContext creation happens inside `start()`, which the UI must call
 * from a user gesture (pointerdown/click) so iOS Safari and Chrome autoplay
 * policies let the context run. Pure DSP helpers (`firingFrequency`,
 * `cutoffFor`, ...) are exported so they can be unit-tested in node, where
 * WebAudio does not exist.
 *
 * Node graph (15 nodes; each is trivially cheap, total CPU is well under one
 * percent on a phone). The spec asked for ~8; the extra nodes are the three
 * separate partial oscillators (so the 0.5x / 2x partials can be detuned
 * independently for a less static timbre) and the LFO pair that drives both
 * the idle lope and the limiter stutter from a single source.
 *
 *   oscMain   (PeriodicWave, saw/square blend @ firing f) ─┐
 *   oscHalf   (PeriodicWave, square-ish  @ 0.5 × firing)  ─┼─▶ engineGain ─▶ grit ─▶ lowpass ─┐
 *   oscDouble (PeriodicWave, saw          @ 2 × firing)   ─┘      ▲        (WaveShaper) (Biquad)  │
 *                                                                 │                               │
 *   lfo (Oscillator: sine = idle lope, square = limiter) ─▶ lfoGain ┘  (modulates engineGain.gain)  │
 *                                                                                                 ├─▶ master ─▶ softClip ─▶ destination
 *   noise (looping AudioBufferSource) ─▶ hissBP (bandpass 2–6 kHz) ─▶ hissGain (throttle·boost) ─┤   (0.5)     (tanh)
 *                                                                                                 │
 *   whistle (sine 8–14 kHz, tracks boost) ─▶ whistleGain (boost) ───────────────────────────────┘
 *
 * Every time-varying AudioParam is driven with `setTargetAtTime`, so rapid
 * `set()` calls (e.g. 60 Hz from the sim loop) never produce zipper noise.
 */

export interface EngineSoundParams {
  /** Crank speed in rpm. */
  rpm: number
  /** Throttle position 0..1. */
  throttle: number
  /**
   * Normalised boost 0..1 (fraction of peak boost; 0 = atmospheric/vacuum).
   * When omitted it is estimated from throttle and rpm, see `estimateBoost`.
   */
  boost?: number
}

export interface EngineSound {
  /** Creates/resumes the AudioContext and starts the sources. Call from a user gesture. */
  start(): Promise<void>
  /** Stops sources, tears down the graph and closes the context. Idempotent. */
  stop(): void
  /** Update engine state. Safe to call before `start()` (values are applied on start). */
  set(params: EngineSoundParams): void
  readonly running: boolean
  /** Master volume 0..1 (default 0.5). */
  setVolume(v: number): void
}

export interface EngineSoundOptions {
  /** Idle speed, rpm. Default 700. */
  idleRpm?: number
  /** Rev limiter, rpm. Default 7000. */
  limiterRpm?: number
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in node)
// ---------------------------------------------------------------------------

/** Number of cylinders of the modelled engine. */
export const CYLINDERS = 6
/** Fuel cut engages when rpm is within this many rpm of the limiter. */
export const LIMITER_WINDOW_RPM = 80
/** Fuel-cut stutter rate, Hz. */
export const LIMITER_STUTTER_HZ = 20
/** Default master gain. */
export const DEFAULT_VOLUME = 0.5

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

const clamp01 = (v: number): number => (Number.isFinite(v) ? clamp(v, 0, 1) : 0)

/**
 * Combustion events per second. A 4-stroke fires each cylinder once every two
 * revolutions, so a 6-cylinder fires 3 times per revolution.
 */
export function firingFrequency(rpm: number, cylinders: number = CYLINDERS): number {
  return (Math.max(0, rpm) / 60) * (cylinders / 2)
}

/**
 * Low-pass cutoff, Hz. Rises with rpm and opens up with throttle; closed
 * throttle at any rpm stays muffled (overrun burble rather than roar).
 */
export function cutoffFor(rpm: number, throttle: number): number {
  const t = clamp01(throttle)
  const r = Math.max(0, rpm)
  return clamp(220 + r * (0.35 + 0.95 * t), 220, 12000)
}

/**
 * Pre-waveshaper engine level. Louder with throttle (and a little with rpm);
 * because this sits in front of the grit waveshaper, more throttle also means
 * more saturation, which is what a real exhaust does under load.
 */
export function engineGainFor(rpm: number, throttle: number, limiterRpm = 7000): number {
  const t = clamp01(throttle)
  const rn = clamp01(rpm / Math.max(1, limiterRpm))
  return (0.32 + 0.68 * t) * (0.6 + 0.4 * rn)
}

/**
 * Boost estimate when the caller does not supply one: turbos spool with
 * throttle and only above ~2000 rpm.
 */
export function estimateBoost(rpm: number, throttle: number): number {
  return clamp01(throttle) * clamp01((rpm - 2000) / 2500)
}

/** Turbo hiss (bandpassed noise) gain: scales with throttle × boost. */
export function hissGainFor(throttle: number, boost: number): number {
  return 0.22 * clamp01(throttle) * clamp01(boost)
}

/** Centre frequency of the hiss bandpass, Hz. Rises with boost from ~2.5 to ~5.5 kHz. */
export function hissCenterFor(boost: number): number {
  return 2500 + 3000 * clamp01(boost)
}

/** Turbo whine frequency, Hz: 8 kHz at no boost up to 14 kHz at peak boost. */
export function whistleFreqFor(boost: number): number {
  return 8000 + 6000 * clamp01(boost)
}

/** Turbo whine gain — deliberately faint. */
export function whistleGainFor(boost: number): number {
  const b = clamp01(boost)
  return 0.018 * b * b
}

/** True when the fuel cut should stutter. */
export function isAtLimiter(rpm: number, limiterRpm: number, window = LIMITER_WINDOW_RPM): boolean {
  return rpm >= limiterRpm - window
}

/**
 * Idle lope depth (fraction of engine gain): a gentle wobble at idle that
 * fades out completely by idle + 700 rpm.
 */
export function lopeDepthFor(rpm: number, idleRpm: number): number {
  const over = clamp01((rpm - idleRpm) / 700)
  return 0.1 * (1 - over)
}

/** Idle lope rate, Hz. Slightly faster at higher idle. */
export function lopeRateFor(rpm: number, idleRpm: number): number {
  return 2.6 + 1.2 * clamp01((rpm - idleRpm) / 700)
}

export interface WaveCoefficients {
  real: Float32Array<ArrayBuffer>
  imag: Float32Array<ArrayBuffer>
}

/**
 * Fourier coefficients for a sawtooth/square blend.
 * @param harmonics number of harmonics (array length is harmonics + 1; index 0 is DC)
 * @param sawMix 0 = pure square, 1 = pure sawtooth
 * @param level overall amplitude scale (used with disableNormalization)
 */
export function blendedWave(harmonics: number, sawMix: number, level = 1): WaveCoefficients {
  const n = Math.max(1, Math.floor(harmonics))
  const real = new Float32Array(new ArrayBuffer(4 * (n + 1)))
  const imag = new Float32Array(new ArrayBuffer(4 * (n + 1)))
  const s = clamp01(sawMix)
  for (let k = 1; k <= n; k++) {
    const saw = ((2 / Math.PI) * (k % 2 === 1 ? 1 : -1)) / k
    const square = k % 2 === 1 ? 4 / Math.PI / k : 0
    imag[k] = level * (s * saw + (1 - s) * square)
  }
  return { real, imag }
}

/**
 * Soft clipper transfer curve: tanh(drive · x) normalised so x = ±1 maps to ±1.
 * Odd-symmetric and monotonic.
 */
export function softClipCurve(samples = 1024, drive = 1.6): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(4 * samples))
  const norm = Math.tanh(drive)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = Math.tanh(drive * x) / norm
  }
  return curve
}

/**
 * Grit curve: asymmetric soft saturation (a touch of even-harmonic content,
 * like an exhaust pulse) — x·(1 + bias·x) pushed through a tanh.
 */
export function gritCurve(samples = 1024, drive = 2.2, bias = 0.18): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(4 * samples))
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    const shaped = x * (1 + bias * x)
    curve[i] = Math.tanh(drive * shaped) / Math.tanh(drive * (1 + bias))
  }
  return curve
}

// ---------------------------------------------------------------------------
// WebAudio implementation
// ---------------------------------------------------------------------------

// Loosely typed to tolerate `webkitAudioContext` and SSR/test environments.
type AnyWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }

function getAudioContextCtor(): (typeof AudioContext) | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as AnyWindow
  return w.AudioContext ?? w.webkitAudioContext
}

interface Graph {
  ctx: AudioContext
  oscMain: OscillatorNode
  oscHalf: OscillatorNode
  oscDouble: OscillatorNode
  engineGain: GainNode
  lfo: OscillatorNode
  lfoGain: GainNode
  grit: WaveShaperNode
  lowpass: BiquadFilterNode
  noise: AudioBufferSourceNode
  hissBP: BiquadFilterNode
  hissGain: GainNode
  whistle: OscillatorNode
  whistleGain: GainNode
  master: GainNode
  softClip: WaveShaperNode
}

// Smoothing time constants (seconds). Reached ~95 % of target after 3τ.
const TAU_FREQ = 0.025
const TAU_GAIN = 0.045
const TAU_FILTER = 0.06
const TAU_LFO = 0.01

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

export function createEngineSound(opts: EngineSoundOptions = {}): EngineSound {
  const idleRpm = opts.idleRpm ?? 700
  const limiterRpm = opts.limiterRpm ?? 7000

  let g: Graph | null = null
  let starting: Promise<void> | null = null
  let volume = DEFAULT_VOLUME
  let last: Required<EngineSoundParams> = { rpm: idleRpm, throttle: 0, boost: 0 }
  let lastLfoType: OscillatorType = 'sine'

  function build(ctx: AudioContext): Graph {
    // --- combustion partials ------------------------------------------------
    const main = blendedWave(24, 0.65, 1.0)
    const mainWave = ctx.createPeriodicWave(main.real, main.imag, { disableNormalization: true })
    const halfWave = blendedWave(10, 0.15, 0.38)
    const doubleWave = blendedWave(12, 1.0, 0.26)

    const oscMain = ctx.createOscillator()
    oscMain.setPeriodicWave(mainWave)
    const oscHalf = ctx.createOscillator()
    oscHalf.setPeriodicWave(
      ctx.createPeriodicWave(halfWave.real, halfWave.imag, { disableNormalization: true }),
    )
    oscHalf.detune.value = -4 // a few cents off for a slowly moving timbre
    const oscDouble = ctx.createOscillator()
    oscDouble.setPeriodicWave(
      ctx.createPeriodicWave(doubleWave.real, doubleWave.imag, { disableNormalization: true }),
    )
    oscDouble.detune.value = 5

    const engineGain = ctx.createGain()
    engineGain.gain.value = engineGainFor(last.rpm, last.throttle, limiterRpm)

    // --- lope / limiter LFO -------------------------------------------------
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = lopeRateFor(last.rpm, idleRpm)
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0
    lfo.connect(lfoGain).connect(engineGain.gain)

    // --- grit + tone --------------------------------------------------------
    const grit = ctx.createWaveShaper()
    grit.curve = gritCurve()
    grit.oversample = '2x'
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.Q.value = 0.9
    lowpass.frequency.value = cutoffFor(last.rpm, last.throttle)

    // --- turbo hiss ---------------------------------------------------------
    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx)
    noise.loop = true
    const hissBP = ctx.createBiquadFilter()
    hissBP.type = 'bandpass'
    hissBP.Q.value = 0.8
    hissBP.frequency.value = hissCenterFor(last.boost)
    const hissGain = ctx.createGain()
    hissGain.gain.value = hissGainFor(last.throttle, last.boost)

    // --- turbo whine --------------------------------------------------------
    const whistle = ctx.createOscillator()
    whistle.type = 'sine'
    whistle.frequency.value = whistleFreqFor(last.boost)
    const whistleGain = ctx.createGain()
    whistleGain.gain.value = whistleGainFor(last.boost)

    // --- output -------------------------------------------------------------
    const master = ctx.createGain()
    master.gain.value = volume
    const softClip = ctx.createWaveShaper()
    softClip.curve = softClipCurve()
    softClip.oversample = '2x'

    oscMain.connect(engineGain)
    oscHalf.connect(engineGain)
    oscDouble.connect(engineGain)
    engineGain.connect(grit).connect(lowpass).connect(master)
    noise.connect(hissBP).connect(hissGain).connect(master)
    whistle.connect(whistleGain).connect(master)
    master.connect(softClip).connect(ctx.destination)

    return {
      ctx, oscMain, oscHalf, oscDouble, engineGain, lfo, lfoGain, grit, lowpass,
      noise, hissBP, hissGain, whistle, whistleGain, master, softClip,
    }
  }

  function apply(graph: Graph, p: Required<EngineSoundParams>): void {
    const { ctx } = graph
    const now = ctx.currentTime
    const rpm = clamp(p.rpm, 0, limiterRpm) // the limiter holds the crank at limiterRpm
    const f = firingFrequency(rpm)

    graph.oscMain.frequency.setTargetAtTime(Math.max(1, f), now, TAU_FREQ)
    graph.oscHalf.frequency.setTargetAtTime(Math.max(1, f * 0.5), now, TAU_FREQ)
    graph.oscDouble.frequency.setTargetAtTime(Math.max(1, f * 2), now, TAU_FREQ)

    const base = engineGainFor(rpm, p.throttle, limiterRpm)
    graph.engineGain.gain.setTargetAtTime(base, now, TAU_GAIN)
    graph.lowpass.frequency.setTargetAtTime(cutoffFor(rpm, p.throttle), now, TAU_FILTER)

    graph.hissBP.frequency.setTargetAtTime(hissCenterFor(p.boost), now, TAU_FILTER)
    graph.hissGain.gain.setTargetAtTime(hissGainFor(p.throttle, p.boost), now, TAU_GAIN)
    graph.whistle.frequency.setTargetAtTime(whistleFreqFor(p.boost), now, TAU_FILTER)
    graph.whistleGain.gain.setTargetAtTime(whistleGainFor(p.boost), now, TAU_GAIN)

    // One LFO serves both effects: at the limiter it becomes a 20 Hz square
    // chopping ~45 % of the level (fuel cut); otherwise it is a slow sine
    // whose depth fades out shortly above idle (lope).
    const atLimiter = isAtLimiter(p.rpm, limiterRpm)
    const wantType: OscillatorType = atLimiter ? 'square' : 'sine'
    if (wantType !== lastLfoType) {
      graph.lfo.type = wantType
      lastLfoType = wantType
    }
    if (atLimiter) {
      graph.lfo.frequency.setTargetAtTime(LIMITER_STUTTER_HZ, now, TAU_LFO)
      graph.lfoGain.gain.setTargetAtTime(0.45 * base, now, TAU_LFO)
    } else {
      graph.lfo.frequency.setTargetAtTime(lopeRateFor(rpm, idleRpm), now, TAU_LFO)
      graph.lfoGain.gain.setTargetAtTime(lopeDepthFor(rpm, idleRpm) * base, now, TAU_GAIN)
    }
  }

  function normalise(params: EngineSoundParams): Required<EngineSoundParams> {
    const rpm = Number.isFinite(params.rpm) ? Math.max(0, params.rpm) : idleRpm
    const throttle = clamp01(params.throttle)
    const boost = params.boost === undefined ? estimateBoost(rpm, throttle) : clamp01(params.boost)
    return { rpm, throttle, boost }
  }

  const sound: EngineSound = {
    get running() {
      return g !== null && g.ctx.state !== 'closed'
    },

    async start() {
      if (starting) return starting
      starting = (async () => {
        try {
          if (g) {
            // Already built: just make sure the context is running (iOS
            // suspends it on interruptions / backgrounding).
            if (g.ctx.state !== 'running') await g.ctx.resume().catch(() => undefined)
            return
          }
          const Ctor = getAudioContextCtor()
          if (!Ctor) return // no WebAudio here (SSR, old browser); stay silent
          const ctx = new Ctor({ latencyHint: 'interactive' })
          // iOS Safari creates contexts in a suspended state even inside a
          // gesture; resume() must be called from the gesture's call chain.
          if (ctx.state !== 'running') await ctx.resume().catch(() => undefined)

          const graph = build(ctx)
          g = graph
          const t0 = ctx.currentTime
          graph.oscMain.start(t0)
          graph.oscHalf.start(t0)
          graph.oscDouble.start(t0)
          graph.lfo.start(t0)
          graph.noise.start(t0)
          graph.whistle.start(t0)
          apply(graph, last)
        } finally {
          starting = null
        }
      })()
      return starting
    },

    stop() {
      const graph = g
      g = null
      if (!graph) return
      const sources = [graph.oscMain, graph.oscHalf, graph.oscDouble, graph.lfo, graph.noise, graph.whistle]
      for (const s of sources) {
        try { s.stop() } catch { /* already stopped */ }
      }
      const nodes: AudioNode[] = [
        ...sources, graph.lfoGain, graph.engineGain, graph.grit, graph.lowpass,
        graph.hissBP, graph.hissGain, graph.whistleGain, graph.master, graph.softClip,
      ]
      for (const n of nodes) {
        try { n.disconnect() } catch { /* ignore */ }
      }
      if (graph.ctx.state !== 'closed') {
        graph.ctx.close().catch(() => undefined)
      }
      lastLfoType = 'sine'
    },

    set(params) {
      last = normalise(params)
      if (g && g.ctx.state !== 'closed') apply(g, last)
    },

    setVolume(v) {
      volume = clamp01(v)
      if (g && g.ctx.state !== 'closed') {
        g.master.gain.setTargetAtTime(volume, g.ctx.currentTime, TAU_GAIN)
      }
    },
  }

  return sound
}
