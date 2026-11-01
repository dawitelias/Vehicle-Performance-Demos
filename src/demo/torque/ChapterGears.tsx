import { useState } from 'react'
import { useFreeRev } from '../../hooks/useFreeRev'
import { nissanZ, Z_ENGINE, NISSAN_6MT_RATIOS } from '../../sim/vehicles'
import { speedAtRpmPerGear, topSpeedPerGearMph } from '../../sim/drivetrain'
import { ThrottleBar } from '../../ui/ThrottleBar'
import { BigNumber } from '../../ui/BigNumber'
import { useNarrow } from '../../hooks/useNarrow'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const FD = 3.538
const EFF = 0.92
const RATIOS = NISSAN_6MT_RATIOS

export function ChapterGears() {
  const rev = useFreeRev(Z_ENGINE, 'rated', 3000)
  const [gear, setGear] = useState(1)
  const mult = RATIOS[gear - 1] * FD
  const wheelTq = rev.tq * mult * EFF
  const wheelHp = rev.hp * EFF
  const speeds = speedAtRpmPerGear(nissanZ, rev.rpm)
  const tops = topSpeedPerGearMph(nissanZ)
  const maxTop = Math.max(...tops)
  const maxWheelTq = 350 * RATIOS[0] * FD * EFF
  const [barsRef, barsNarrow] = useNarrow<SVGSVGElement>(520)
  const [ladderRef, ladderNarrow] = useNarrow<SVGSVGElement>(520)
  const BW = barsNarrow ? 420 : 700
  const LW = ladderNarrow ? 420 : 700

  const gearPicker = (
    <div className="gear-picker" role="radiogroup" aria-label="Gear">
      {RATIOS.map((_, i) => (
        <button key={i} type="button" role="radio" aria-checked={gear === i + 1} className={`gear-btn ${gear === i + 1 ? 'is-on' : ''}`} onClick={() => setGear(i + 1)}>
          {i + 1}
        </button>
      ))}
    </div>
  )

  return (
    <section className="chapter" id="gears">
      <div className="wrap chapter-head">
        <h2 className="display display-l">Gears multiply torque.</h2>
        <p className="lede measure">The engine makes 350 lb-ft. First gear turns that into {fmt(350 * RATIOS[0] * FD * EFF)} at the road.</p>
        <p className="body measure">
          First multiplies engine torque {(RATIOS[0] * FD).toFixed(1)} times. Sixth, {(RATIOS[5] * FD).toFixed(1)}. Same engine, same pedal, a very different push. Pick a gear and rev it.
        </p>
      </div>

      <div className="wrap gears-stage">
        <div className="gears-mult">
          <BigNumber value={`×${mult.toFixed(1)}`} energy={Math.min(1, (rev.rpm - 1000) / 5800) * 0.6} label={`Gear ${gear} multiplies torque ${mult.toFixed(1)} times`} className="gears-bignum" />
          <p className="small">
            Gear {gear}: {RATIOS[gear - 1].toFixed(3)} × final drive {FD}, less 8% lost in the driveline
          </p>
        </div>

        <svg ref={barsRef} className="gears-bars" viewBox={`0 0 ${BW} 300`} role="img" aria-label="Torque at the rear wheels in each gear at the current engine speed">
          {RATIOS.map((r, i) => {
            const wt = rev.tq * r * FD * EFF
            const L = barsNarrow ? 30 : 70
            const W = BW - L - (barsNarrow ? 110 : 160)
            const w = (wt / maxWheelTq) * W
            const y = 18 + i * 46
            const on = i + 1 === gear
            return (
              <g key={i} fontSize={14}>
                <text x={L - 14} y={y + 20} textAnchor="end" fill={on ? '#f2c230' : '#a7a39a'} fontWeight={600}>
                  {i + 1}
                </text>
                <line x1={L} x2={L + W} y1={y + 15} y2={y + 15} stroke="#232327" />
                <rect x={L} y={y + 6} width={w} height={18} fill={on ? '#f2c230' : 'none'} stroke={on ? '#f2c230' : '#a7a39a'} strokeWidth={1} opacity={on ? 1 : 0.8} />
                <text x={L + w + 10} y={y + 20} fill={on ? '#ede9e0' : '#a7a39a'} fontWeight={on ? 700 : 500}>
                  {fmt(wt)} lb-ft
                </text>
              </g>
            )
          })}
          <text x={barsNarrow ? 30 : 70} y={296} fill="#6b685f" fontSize={13}>
            torque at the rear wheels, at {fmt(rev.rpm)} rpm
          </text>
        </svg>
      </div>

      <div className="wrap gears-ladder-wrap">
        <p className="lede measure">Every gear trades push for speed.</p>
        <p className="body measure">The same {fmt(rev.rpm)} rpm is {fmt(speeds[0])} mph in first and {fmt(speeds[5])} mph in sixth. The limiter at 6,800 rpm caps each gear at its own top speed.</p>
        <svg ref={ladderRef} className="gears-ladder" viewBox={`0 0 ${LW} 250`} role="img" aria-label="Road speed in each gear">
          {RATIOS.map((_, i) => {
            const L = ladderNarrow ? 26 : 40
            const W = LW - L - (ladderNarrow ? 118 : 140)
            const y = 14 + i * 36
            const top = (tops[i] / maxTop) * W
            const now = (speeds[i] / maxTop) * W
            const on = i + 1 === gear
            return (
              <g key={i} fontSize={13}>
                <text x={L - 12} y={y + 15} textAnchor="end" fill={on ? '#f2c230' : '#a7a39a'} fontWeight={600}>
                  {i + 1}
                </text>
                <line x1={L} x2={L + top} y1={y + 11} y2={y + 11} stroke={on ? '#f2c230' : '#3a3a3f'} strokeWidth={on ? 1.5 : 1} />
                <line x1={L + top} x2={L + top} y1={y + 4} y2={y + 18} stroke={i + 1 === 6 ? '#6b685f' : '#e8453c'} strokeWidth={1.2} />
                <text x={L + top + 8} y={y + 15} fill="#6b685f">
                  {fmt(Math.min(tops[i], 155))} mph{i + 1 === 6 ? ', governed' : ''}
                </text>
                <circle cx={L + now} cy={y + 11} r={on ? 5 : 3.5} fill={on ? '#f2c230' : '#ede9e0'} />
                {on && (
                  <text x={L + now} y={y - 2} textAnchor="middle" fill="#ede9e0" fontWeight={700}>
                    {fmt(speeds[i])} mph
                  </text>
                )}
              </g>
            )
          })}
          <text x={ladderNarrow ? 26 : 40} y={246} fill="#6b685f" fontSize={13}>
            road speed at {fmt(rev.rpm)} rpm, and where each gear runs out
          </text>
        </svg>
      </div>

      <div className="wrap dyno-after">
        <p className="lede measure">No gear multiplies horsepower.</p>
        <p className="body measure">
          At {fmt(rev.rpm)} rpm the engine is making {fmt(rev.hp)} hp, and after driveline losses the tyres see {fmt(wheelHp)} hp in every gear. Gears change how that power is delivered, as more push or more speed, never how much there is. That's why horsepower, not torque, decides how fast a car can go.
        </p>
      </div>

      <ThrottleBar
        sliderId="rpm-gears"
        rpm={rev.rpm}
        minRpm={1000}
        maxRpm={Z_ENGINE.limiterRpm}
        onRpm={rev.setRpm}
        holding={rev.holding}
        onHold={rev.hold}
        onRelease={rev.release}
        extra={gearPicker}
        readouts={[
          { value: fmt(rev.rpm), unit: 'rpm', accent: true },
          { value: fmt(wheelTq), unit: 'lb-ft at the wheels' },
          { value: fmt(speeds[gear - 1]), unit: 'mph' },
        ]}
      />
    </section>
  )
}
