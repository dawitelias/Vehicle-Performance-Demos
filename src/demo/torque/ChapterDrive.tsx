import { useCallback, useMemo, useState } from 'react'
import { useDrive } from '../../hooks/useDrive'
import { nissanZ, Z_ENGINE } from '../../sim/vehicles'
import { resolveCurve, type CurveMode } from '../../sim/engine'
import { optimalShiftPoints, overallRatios } from '../../sim/drivetrain'
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
  const [webgl] = useState(() => hasWebGL())
  const haptics = useMemo(() => createHaptics(), [])

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
  const wheelTq = s.engineTorqueLbft * ratios[s.gear - 1] * 0.92
  const shiftPoints = useMemo(() => optimalShiftPoints(nissanZ, curveMode), [curveMode])
  const curve = resolveCurve(Z_ENGINE, curveMode)
  const prime = useCallback(() => haptics.prime(), [haptics])
  const wheelAngle = s.x / nissanZ.chassis.tireRadiusM

  return (
    <section className="chapter" id="drive" onPointerDownCapture={prime}>
      <div className="wrap chapter-head">
        <h2 className="display display-l">Drive the simulated Z</h2>
        <p className="lede measure">Everything on this page comes from the same model, and here you can drive it from a standstill.</p>
        <p className="body measure">
          Hold the throttle to accelerate and use the brake to stop. You can shift yourself or let the car shift at the best point, which on this engine is the rev limiter in every gear. Try shifting early, at 4,000 rpm, and watch what happens to the torque at the wheels in the next gear.
        </p>
      </div>

      <div className="wrap drive-stage">
        <div className="drive-car">
          {webgl ? (
            <ZScene view="side" autoRotate={false} wheelAngle={wheelAngle} className="drive-scene" fallback={<ZContour wheelAngle={wheelAngle} className="drive-car-svg" />} />
          ) : (
            <ZContour wheelAngle={wheelAngle} className="drive-car-svg" />
          )}
        </div>
        <div className="drive-instruments">
          <RingTach rpm={s.rpm} redlineRpm={Z_ENGINE.redlineRpm} onLimiter={s.onLimiter} className="drive-ring" />
          <CurveChart curve={curve} ghost={curveMode === 'dyno' ? Z_ENGINE.curve : undefined} rpm={s.rpm} throttle={s.throttle} maxRpm={Z_ENGINE.limiterRpm} className="drive-chart" />
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
              Measured on a dyno
            </button>
          </div>
          <span className="small">Stock cars put 360 to 383 lb-ft to the wheels on a chassis dyno, so the factory figure of 350 at the crank is conservative.</span>
        </div>
        <div className="drive-opt">
          <span className="small">Shifting</span>
          <div className="seg" role="radiogroup" aria-label="Shifting">
            <button type="button" role="radio" aria-checked={!autoShift} className={`seg-btn ${!autoShift ? 'is-on' : ''}`} onClick={() => setAutoShift(false)}>
              I'll shift
            </button>
            <button type="button" role="radio" aria-checked={autoShift} className={`seg-btn ${autoShift ? 'is-on' : ''}`} onClick={() => setAutoShift(true)}>
              Shift for me
            </button>
          </div>
          <span className="small">The car shifts at {fmt(shiftPoints[0])} rpm in every gear.</span>
        </div>
      </div>

      <ControlBar
        readouts={[
          { value: fmt(drive.mph), unit: 'mph', accent: true },
          { value: fmt(s.rpm), unit: 'rpm' },
          { value: s.gear.toString(), unit: s.shifting ? 'shifting' : 'gear' },
          { value: fmt(wheelTq), unit: 'lb-ft at the wheels' },
          { value: drive.g.toFixed(2), unit: 'g' },
          ...(drive.zeroToSixty !== null ? [{ value: drive.zeroToSixty.toFixed(1), unit: 's to 60' }] : []),
        ]}
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
        <HoldButton holding={drive.braking} onHold={drive.brake} onRelease={drive.releaseBrake} label="Brake" className="btn-ghost drive-brake" />
        <HoldButton holding={drive.holding} onHold={drive.hold} onRelease={drive.release} label="Throttle" className="drive-hold" />
      </ControlBar>
    </section>
  )
}
