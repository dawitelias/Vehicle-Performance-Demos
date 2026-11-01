import { useMemo } from 'react'
import { useRace, type Racer } from '../../hooks/useRace'
import { useNarrow } from '../../hooks/useNarrow'
import { nissanZ, z370, ghostHighRevRegeared, ghostDiesel, ev, type Vehicle } from '../../sim/vehicles'
import { simulate, timeToMph } from '../../sim/longitudinal'
import { ControlBar } from '../../ui/ControlBar'
import { ZGlyph } from '../../ui/ZGlyph'
import { useZSprite } from '../../hooks/useZSprite'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const FINISH = 130
const WINDOW_M = 170

interface Entry {
  vehicle: Vehicle
  label: string
  blurb: string
  hp: number
  lbft: number
  color: string
}

const ENTRIES: Entry[] = [
  { vehicle: nissanZ, label: 'Your Z', blurb: 'Twin-turbo V6. Flat torque to 5,200 rpm.', color: '#f2c230', hp: 400, lbft: 350 },
  { vehicle: z370, label: '370Z', blurb: 'The car it replaced. 3.7 litres, no turbos, lighter.', color: '#ede9e0', hp: 332, lbft: 270 },
  { vehicle: ghostHighRevRegeared, label: 'Screamer', blurb: 'Imaginary. Peaks at 9,000 rpm with two-thirds the torque, geared to match.', color: '#ede9e0', hp: 400, lbft: 233 },
  { vehicle: ghostDiesel, label: 'Torque monster', blurb: 'Imaginary. All of it by 1,800 rpm, done by 4,500, geared to match.', color: '#ede9e0', hp: 250, lbft: 450 },
  { vehicle: ev, label: 'EV', blurb: 'Dual motor, one gear, full torque from zero rpm. Heavier.', color: '#ede9e0', hp: 450, lbft: 480 },
]

export function ChapterEngines() {
  const racers = useMemo<Racer[]>(() => ENTRIES.map((e) => ({ id: e.vehicle.id, label: e.label, vehicle: e.vehicle, options: { shiftRpm: 'optimal' } })), [])
  const race = useRace(racers, { finishMph: FINISH, timeScale: 1.5, maxTimeS: 40 })
  const batch = useMemo(
    () =>
      ENTRIES.map((e) => {
        const tr = simulate(e.vehicle, { duration: 40, shiftRpm: 'optimal' })
        return { to60: timeToMph(tr, 60), to100: timeToMph(tr, 100), to130: timeToMph(tr, 130) }
      }),
    [],
  )
  const [ref, narrow] = useNarrow<SVGSVGElement>(560)
  const sprite = useZSprite()
  const W = narrow ? 520 : 1000
  const L = narrow ? 110 : 180 // room for the car body behind the start line
  const trackW = W - L - (narrow ? 16 : 40)
  const laneH = narrow ? 64 : 84
  const H = 30 + laneH * ENTRIES.length + 30
  const leaderX = Math.max(...race.racers.map((r) => r.state.x))
  const windowStart = Math.max(0, leaderX - WINDOW_M)
  const xOf = (m: number) => L + ((m - windowStart) / WINDOW_M) * trackW
  const glyphScale = narrow ? 0.11 : 0.15
  const ticks: number[] = []
  for (let m = Math.ceil(windowStart / 50) * 50; m <= windowStart + WINDOW_M; m += 50) ticks.push(m)

  const order = [...race.racers].map((r, i) => ({ r, i })).sort((p, q) => (p.r.finishedAt ?? 99) - (q.r.finishedAt ?? 99))

  return (
    <section className="chapter" id="engines">
      <div className="wrap chapter-head">
        <h2 className="display display-l">Five engines. One Z.</h2>
        <p className="lede measure">Same body, same tyres, same road. Swap the engine and race to 130.</p>
        <p className="body measure">
          Each car shifts at its own best point. The clock runs at one and a half times real time so you aren't waiting on the torque monster.
        </p>
      </div>

      <div className="wrap engines-list">
        {ENTRIES.map((e, i) => (
          <div className="engines-row" key={e.vehicle.id}>
            <span className="engines-name" style={{ color: e.color }}>
              {e.label}
            </span>
            <span className="engines-spec num">{fmt(e.hp)} hp</span>
            <span className="engines-spec num">{fmt(e.lbft)} lb-ft</span>
            <span className="engines-blurb small">{e.blurb}</span>
            <span className="engines-time num">{batch[i].to130 !== null ? `${batch[i].to130!.toFixed(1)} s to 130` : ''}</span>
          </div>
        ))}
      </div>

      <div className="wrap">
        <svg ref={ref} className="engines-track" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Five cars racing from a standstill to 130 mph">
          {ticks.map((m) => (
            <g key={m}>
              <line x1={xOf(m)} x2={xOf(m)} y1={16} y2={H - 24} stroke="#232327" strokeDasharray="2 6" />
              <text x={xOf(m)} y={H - 8} textAnchor="middle" fill="#6b685f" fontSize={13}>
                {m} m
              </text>
            </g>
          ))}
          {race.racers.map((r, i) => {
            const e = ENTRIES[i]
            const y = 30 + i * laneH
            const ground = y + laneH - 10
            const s = r.state
            const x = xOf(Math.max(s.x, windowStart - 20))
            return (
              <g key={r.id}>
                <line x1={narrow ? 16 : 40} x2={L + trackW} y1={ground} y2={ground} stroke="#2a2a2e" />
                <ZGlyph x={x} y={ground - 318 * glyphScale} scale={glyphScale} flip wheelAngle={s.x / 0.327} color={e.color} strokeWidth={1} opacity={s.x < windowStart - 20 ? 0.35 : i === 0 ? 1 : 0.7} href={sprite} />
                <text x={narrow ? 16 : 40} y={y + 4} fill={e.color} fontSize={narrow ? 13 : 15} fontWeight={700}>
                  {e.label}
                </text>
                <text x={(narrow ? 16 : 40) + (narrow ? 90 : 130)} y={y + 4} fill="#a7a39a" fontSize={narrow ? 12 : 14}>
                  {fmt(r.mph)} mph{e.vehicle.powertrain.kind === 'ice' ? `, ${ordinalShort(s.gear)}, ${fmt(s.rpm)} rpm` : ''}
                  {r.finishedAt !== null ? `, 130 at ${r.finishedAt.toFixed(1)} s` : ''}
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
        {race.done ? (
          <p className="lede measure">
            {order.map(({ r }) => r.label).join(', then ')}. Rank them by horsepower and you get the same order.
          </p>
        ) : (
          <p className="lede measure">The most torque finishes last. The least torque keeps up with your Z.</p>
        )}
        <p className="body measure">
          Horsepower sets how fast a car can go. Torque sets how it gets there in each gear, and the gearbox can trade one for the other. The EV's torque arrives at zero rpm, which is why it jumps first, and it carries the most horsepower, which is why it stays there. The torque monster has the biggest number on the sheet and the smallest one that matters.
        </p>
      </div>

      <ControlBar
        readouts={[
          { value: race.t.toFixed(1), unit: 's', accent: true },
          { value: fmt(race.racers[0].mph), unit: 'mph, your Z' },
          { value: batch[0].to60 !== null ? batch[0].to60!.toFixed(1) : '', unit: 's to 60, your Z' },
        ]}
      >
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn" onClick={race.running ? race.reset : race.start}>
            {race.running ? 'Reset' : race.done ? 'Race again' : 'Race'}
          </button>
        </div>
      </ControlBar>
    </section>
  )
}

function ordinalShort(g: number): string {
  return ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][g] ?? `${g}`
}
