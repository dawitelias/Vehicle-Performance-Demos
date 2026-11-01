import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDrive } from '../../hooks/useDrive'
import { nissanZ, Z_ENGINE } from '../../sim/vehicles'
import { resolveCurve, type CurveMode } from '../../sim/engine'
import { optimalShiftPoints, overallRatios } from '../../sim/drivetrain'
import { createEngineSound, type EngineSound } from '../../audio/engineSound'
import { createHaptics } from '../../haptics/haptics'
import { ZContour } from '../../ui/ZContour'
import { ZScene, hasWebGL } from '../../ui/ZScene'
import { RingTach } from '../../ui/RingTach'
import { CurveChart } from '../../ui/CurveChart'
import { ControlBar } from '../../ui/ControlBar'
import { HoldButton } from '../../ui/ThrottleBar'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function ChapterDrive() {
  const [curveMode, setCurveMode] = useState<CurveMode>('rated')
  const [autoShift, setAutoShift] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [webgl] = useState(() => hasWebGL())
  const haptics = useMemo(() => createHaptics(), [])
  const soundRef = useRef<EngineSound | null>(null)

  const drive = useDrive(
    nissanZ,
    { curveMode, autoShift },
    {
      onShift: () => haptics.pulse('shift'),
      onLimiter: () => haptics.pulse('limiter'),
      onLaunch: () => haptics.pulse('launch'),
    },
  )
  const s = drive.state
  const ratios = overallRatios(nissanZ)
  const wheelTq = Math.max(0, s.engineTorqueLbft) * ratios[s.gear - 1] * 0.92
  const shiftPoints = useMemo(() => optimalShiftPoints(nissanZ, curveMode), [curveMode])
  const curve = resolveCurve(Z_ENGINE, curveMode)

  // sound follows the engine every frame
  useEffect(() => {
    soundRef.current?.set({ rpm: s.rpm, throttle: s.throttle, boost: s.boost })
  }, [s.rpm, s.throttle, s.boost])
  useEffect(() => () => soundRef.current?.stop(), [])

  const toggleSound = useCallback(async () => {
    if (soundOn) {
      soundRef.current?.stop()
      soundRef.current = null
      setSoundOn(false)
      return
    }
    const snd = createEngineSound({ idleRpm: Z_ENGINE.idleRpm, limiterRpm: Z_ENGINE.limiterRpm })
    soundRef.current = snd
    await snd.start()
    snd.set({ rpm: s.rpm, throttle: s.throttle, boost: s.boost })
    setSoundOn(true)
  }, [soundOn, s.rpm, s.throttle, s.boost])

  const prime = useCallback(() => haptics.prime(), [haptics])

  return (
    <section className="chapter" id="drive" onPointerDownCapture={prime}>
      <div className="wrap chapter-head">
        <h2 className="display display-l">Drive it.</h2>
        <p className="lede measure">Everything above, in one car. Hold the throttle. Shift when you like, or let it shift for you.</p>
        <p className="body measure">
          With a flat torque curve the right shift point is the limiter, in every gear. Shift early and you land in a gear with less push. Watch the torque at the wheels when you do.
        </p>
      </div>

      <div className="wrap drive-stage">
        <div className="drive-car">
          {webgl ? <ZScene view="side" autoRotate={false} wheelAngle={s.x / 0.327} className="drive-scene" fallback={<ZContour wheelAngle={s.x / 0.327} className="drive-car-svg" />} /> : <ZContour wheelAngle={s.x / 0.327} className="drive-car-svg" />}
        </div>
        <div className="drive-instruments">
          <RingTach rpm={s.rpm} redlineRpm={Z_ENGINE.redlineRpm} onLimiter={s.onLimiter} className="drive-ring" />
          <CurveChart curve={curve} ghost={curveMode === 'dyno' ? Z_ENGINE.curve : undefined} rpm={s.rpm} maxRpm={Z_ENGINE.limiterRpm} maxValue={curveMode === 'dyno' ? 450 : 450} className="drive-chart" />
        </div>
      </div>

      <div className="wrap drive-options">
        <div className="drive-opt">
          <span className="small">Torque curve</span>
          <div className="seg" role="radiogroup" aria-label="Torque curve">
            <button type="button" role="radio" aria-checked={curveMode === 'rated'} className={`seg-btn ${curveMode === 'rated' ? 'is-on' : ''}`} onClick={() => setCurveMode('rated')}>
              Nissan's rating
            </button>
            <button type="button" role="radio" aria-checked={curveMode === 'dyno'} className={`seg-btn ${curveMode === 'dyno' ? 'is-on' : ''}`} onClick={() => setCurveMode('dyno')}>
              As measured on a dyno
            </button>
          </div>
          <span className="small">Stock cars put 360 to 383 lb-ft to the wheels on a chassis dyno, so the factory 350 is conservative.</span>
        </div>
        <div className="drive-opt">
          <span className="small">Shifting</span>
          <div className="seg" role="radiogroup" aria-label="Shifting">
            <button type="button" role="radio" aria-checked={!autoShift} className={`seg-btn ${!autoShift ? 'is-on' : ''}`} onClick={() => setAutoShift(false)}>
              Paddles
            </button>
            <button type="button" role="radio" aria-checked={autoShift} className={`seg-btn ${autoShift ? 'is-on' : ''}`} onClick={() => setAutoShift(true)}>
              Shift for me
            </button>
          </div>
          <span className="small">Best points: {shiftPoints.slice(0, 5).map((p) => fmt(p)).join(', ')} rpm.</span>
        </div>
        <div className="drive-opt">
          <span className="small">Sound</span>
          <div className="seg">
            <button type="button" className={`seg-btn ${soundOn ? 'is-on' : ''}`} onClick={toggleSound} aria-pressed={soundOn}>
              {soundOn ? 'Engine sound on' : 'Engine sound off'}
            </button>
          </div>
          <span className="small">Synthesised V6 with turbo hiss. {haptics.supported === 'none' ? 'No haptics on this device.' : 'Haptics on shifts and the limiter.'}</span>
        </div>
      </div>

      <ControlBar
        readouts={[
          { value: fmt(drive.mph), unit: 'mph', accent: true },
          { value: fmt(s.rpm), unit: 'rpm' },
          { value: s.gear.toString(), unit: s.shifting ? 'shifting' : 'gear' },
          { value: fmt(wheelTq), unit: 'lb-ft at the wheels' },
          { value: drive.zeroToSixty !== null ? drive.zeroToSixty.toFixed(2) : '', unit: drive.zeroToSixty !== null ? 's to 60' : '' },
        ].filter((r) => r.value !== '')}
      >
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={drive.shiftDown} aria-label="Shift down" disabled={autoShift}>
            −
          </button>
          <button type="button" className="btn btn-ghost" onClick={drive.shiftUp} aria-label="Shift up" disabled={autoShift}>
            +
          </button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={drive.reset}>
          Reset
        </button>
        <HoldButton holding={drive.holding} onHold={drive.hold} onRelease={drive.release} label="Hold to drive" className="drive-hold" />
      </ControlBar>
    </section>
  )
}
