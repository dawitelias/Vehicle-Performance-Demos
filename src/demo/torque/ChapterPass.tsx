import { useMemo, useState } from 'react'
import { useRace, type Racer } from '../../hooks/useRace'
import { nissanZ } from '../../sim/vehicles'
import { rpmAtMph, fullThrottleTorqueLbft, fullThrottlePowerHp, overallRatios } from '../../sim/drivetrain'
import { useNarrow } from '../../hooks/useNarrow'
import { rollingAccel } from '../../sim/longitudinal'
import { mpsFromMph } from '../../sim/units'
import { ControlBar } from '../../ui/ControlBar'
import { ZGlyph } from '../../ui/ZGlyph'
import { useZSprite } from '../../hooks/useZSprite'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const FROM = 50
const TO = 80

export function ChapterPass() {
  const [gearB, setGearB] = useState(3)
  const racers = useMemo<Racer[]>(
    () => [
      { id: 'sixth', label: 'Sixth', vehicle: nissanZ, options: { startSpeedMps: mpsFromMph(FROM), startGear: 6, shiftStrategy: 'hold' } },
      { id: 'low', label: cap(ordinal(gearB)), vehicle: nissanZ, options: { startSpeedMps: mpsFromMph(FROM), startGear: gearB, shiftStrategy: 'hold' } },
    ],
    [gearB],
  )
  const race = useRace(racers, { finishMph: TO, timeScale: 1 })
  const [a, b] = race.racers
  const batch = useMemo(() => ({ six: rollingAccel(nissanZ, { fromMph: FROM, toMph: TO, gear: 6 }), low: rollingAccel(nissanZ, { fromMph: FROM, toMph: TO, gear: gearB }) }), [gearB])
  const rpmSixAt50 = rpmAtMph(nissanZ, FROM, 5)
  const rpmLowAt50 = rpmAtMph(nissanZ, FROM, gearB - 1)
  const ratios = overallRatios(nissanZ)
  const hpRatio = fullThrottlePowerHp(nissanZ, rpmLowAt50) / fullThrottlePowerHp(nissanZ, rpmSixAt50)
  const pushRatio = (fullThrottleTorqueLbft(nissanZ, rpmLowAt50) * ratios[gearB - 1]) / (fullThrottleTorqueLbft(nissanZ, rpmSixAt50) * ratios[5])
  const [trackRef, narrow] = useNarrow<SVGSVGElement>(560)
  const sprite = useZSprite()

  // Track: both cars start at x = 0, noses on the line. Scale so the slow car's whole run fits.
  const maxX = Math.max(240, batch.six.distanceM * 1.08)
  const W = narrow ? 520 : 1000
  const H = narrow ? 260 : 300
  const L = narrow ? 130 : 220 // room for the car body behind the start line
  const trackW = W - L - (narrow ? 16 : 40)
  const xOf = (m: number) => L + (m / maxX) * trackW
  const wheelAngle = (s: { x: number }) => s.x / 0.327
  const glyphScale = narrow ? 0.13 : 0.19
  const ff = race.atFirstFinish
  const gapM = b.state.x - a.state.x
  const result =
    race.done && ff
      ? `${b.label} reaches 80 in ${batch.low.timeS.toFixed(1)} seconds. Sixth takes ${batch.six.timeS.toFixed(1)}. The moment ${b.label.toLowerCase()} hits 80, sixth is ${fmt(ff.x[1] - ff.x[0])} metres behind and still doing ${fmt(ff.mph[0])} mph.`
      : null

  return (
    <section className="chapter" id="pass">
      <div className="wrap chapter-head">
        <h2 className="display display-l">50 to 80. Sixth, or third?</h2>
        <p className="lede measure">Same car, same foot to the floor. Only the gear is different.</p>
        <p className="body measure">
          At 50 mph in sixth the engine turns {fmt(rpmSixAt50)} rpm. Plenty of torque at the crank, a sliver at the wheels. In {ordinal(gearB)} it turns {fmt(rpmLowAt50)} rpm, with {hpRatio.toFixed(1)} times the horsepower on tap and {pushRatio.toFixed(1)} times the push at the tyres.
        </p>
      </div>

      <div className="wrap">
        <svg ref={trackRef} className="pass-track" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Two cars accelerating from 50 to 80 mph">
          {[0, 50, 100, 150, 200, 250, 300, 350, 400].filter((m) => m <= maxX && (!narrow || m % 100 === 0)).map((m) => (
            <g key={m}>
              <line x1={xOf(m)} x2={xOf(m)} y1={20} y2={H - 20} stroke="#232327" strokeDasharray="2 6" />
              <text x={xOf(m)} y={H - 4} textAnchor={m === 0 ? 'start' : 'middle'} fill="#6b685f" fontSize={13}>
                {m} m
              </text>
            </g>
          ))}
          {[a, b].map((r, i) => {
            const laneH = (H - 60) / 2
            const y = 30 + i * laneH
            const on = i === 1
            const ground = y + laneH - 14
            return (
              <g key={r.id}>
                <line x1={narrow ? 16 : 40} x2={L + trackW} y1={ground} y2={ground} stroke="#2a2a2e" />
                <ZGlyph x={xOf(r.state.x)} y={ground - 318 * glyphScale} scale={glyphScale} flip wheelAngle={wheelAngle(r.state)} color={on ? '#f2c230' : '#ede9e0'} strokeWidth={1.1} href={sprite} opacity={on ? 1 : 0.7} />
                <text x={narrow ? 16 : 40} y={y + 6} fill={on ? '#f2c230' : '#ede9e0'} fontSize={16} fontWeight={700}>
                  {r.label}
                </text>
                <text x={(narrow ? 16 : 40) + 70} y={y + 6} fill="#a7a39a" fontSize={14}>
                  {fmt(r.mph)} mph, {fmt(r.state.rpm)} rpm{r.finishedAt !== null ? `, 80 at ${r.finishedAt.toFixed(1)} s` : ''}
                </text>
              </g>
            )
          })}
          {race.t > 0 && (
            <text x={W - L} y={30} textAnchor="end" fill="#ede9e0" fontSize={28} fontWeight={760} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {race.t.toFixed(1)} s
            </text>
          )}
        </svg>
      </div>

      <div className="wrap dyno-after">
        {result ? <p className="lede measure">{result}</p> : <p className="lede measure">Press go. Both cars hold their gear all the way to 80.</p>}
        <p className="body measure">
          Torque at the crank is what you have. Horsepower is what you can use, and a gear is how you reach it. The engine never changed. The gear put it where it could work.
          {gearB === 2 ? ' Second gear runs into the limiter at 63 mph, so it never gets there.' : ''}
        </p>
      </div>

      <ControlBar
        readouts={[
          { value: race.t.toFixed(1), unit: 's', accent: true },
          { value: fmt(Math.abs(gapM)), unit: gapM >= 0 ? 'm ahead' : 'm behind' },
          { value: fmt(b.state.wheelForce / 4.448), unit: `lb of push in ${ordinal(gearB)}` },
        ]}
      >
        <div className="gear-picker" role="radiogroup" aria-label="Gear for the second car">
          {[2, 3, 4, 5].map((g) => (
            <button key={g} type="button" role="radio" aria-checked={gearB === g} className={`gear-btn ${gearB === g ? 'is-on' : ''}`} disabled={race.running} onClick={() => { race.reset(); setGearB(g) }}>
              {g}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn" onClick={race.running ? race.reset : race.start}>
            {race.running ? 'Reset' : race.done ? 'Run it again' : 'Go'}
          </button>
        </div>
      </ControlBar>
    </section>
  )
}

function ordinal(g: number): string {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'][g] ?? `${g}`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
