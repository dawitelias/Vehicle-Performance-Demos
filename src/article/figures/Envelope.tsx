import { useMemo, useState } from 'react'
import { Figure, Slider, Readouts } from '../Figure'
import { useNarrow } from '../../hooks/useNarrow'
import type { Vehicle } from '../../sim/vehicles'
import { gearCount, idleRpm, limiterRpm, vehicleRpmAtSpeed, vehicleWheelForceAtRpm } from '../../sim/drivetrain'
import { mpsFromMph } from '../../sim/units'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const N_PER_LB = 4.4482
const MAX_MPH = 140
const MAX_LB = 4400

/** The most push a car can get at a road speed, choosing the best gear: the top edge of its per-gear curves. */
export function bestPush(v: Vehicle, mph: number): number {
  let best = 0
  const vm = mpsFromMph(mph)
  for (let g = 0; g < gearCount(v); g++) {
    const rpm = vehicleRpmAtSpeed(v, vm, g)
    if (rpm < idleRpm(v) - 1 || rpm > limiterRpm(v)) continue
    best = Math.max(best, vehicleWheelForceAtRpm(v, rpm, g) / N_PER_LB)
  }
  return best
}

/** Spread label positions apart so none are closer than `gap`, keeping their order. */
function labelYs(ys: number[], gap: number): number[] {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < idx.length; k++) if (idx[k].y - idx[k - 1].y < gap) idx[k].y = idx[k - 1].y + gap
  const out: number[] = []
  idx.forEach((o) => (out[o.i] = o.y))
  return out
}

export function EnvelopeFigure({ entries }: { entries: { label: string; vehicle: Vehicle; color: string }[] }) {
  const [mph, setMph] = useState(70)
  const [ref, narrow] = useNarrow<SVGSVGElement>(560)
  const W = narrow ? 440 : 760
  const H = narrow ? 320 : 360
  const L = narrow ? 44 : 58
  const R = W - (narrow ? 70 : 110)
  const T = 14
  const B = H - 36
  const x = (v: number) => L + (v / MAX_MPH) * (R - L)
  const y = (lb: number) => B - (Math.min(lb, MAX_LB) / MAX_LB) * (B - T)
  const paths = useMemo(
    () =>
      entries.map((e) => {
        let d = ''
        let started = false
        for (let v = 2; v <= MAX_MPH; v += 1) {
          const p = bestPush(e.vehicle, v)
          if (p <= 0) continue
          d += `${started ? 'L' : 'M'}${x(v).toFixed(1)} ${y(p).toFixed(1)}`
          started = true
        }
        return d
      }),
    [entries, narrow], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const at = entries.map((e) => bestPush(e.vehicle, mph))
  const fs = narrow ? 11 : 12.5
  return (
    <Figure
      label="The most push each engine can give at each road speed"
      aspect={W / H}
      phoneAspect={440 / 320}
      drag={false}
      fallback={
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} fontSize={fs} role="img" aria-label="Best-gear push against road speed for five engines">
          {[1000, 2000, 3000, 4000].map((v) => (
            <g key={v}>
              <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#26252a" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fill="#7e7b70">
                {fmt(v)}
              </text>
            </g>
          ))}
          <text x={L - 8} y={T + 4} textAnchor="end" fill="#7e7b70">
            lb
          </text>
          {[0, 35, 70, 105, 140].map((v) => (
            <text key={v} x={x(v)} y={B + 20} textAnchor={v === 0 ? 'start' : 'middle'} fill="#7e7b70">
              {v === 140 ? '140 mph' : v}
            </text>
          ))}
          {entries.map((e, i) => (
            <g key={e.label}>
              <path d={paths[i]} fill="none" stroke={e.color} strokeWidth={i === 0 ? 2 : 1.4} />
            </g>
          ))}
          {labelYs(entries.map((e) => y(bestPush(e.vehicle, MAX_MPH))), fs + 3).map((ly, i) => (
            <text key={entries[i].label} x={R + 6} y={ly + 4} fill={entries[i].color} fontWeight={i === 0 ? 700 : 500}>
              {entries[i].label}
            </text>
          ))}
          <line x1={x(mph)} x2={x(mph)} y1={T} y2={B} stroke="#9ea87a" strokeOpacity={0.6} />
          {at.map((p, i) => (p > 0 ? <circle key={i} cx={x(mph)} cy={y(p)} r={4} fill={entries[i].color} /> : null))}
          <line x1={L} x2={R} y1={B} y2={B} stroke="#3a3a3f" />
        </svg>
      }
      controls={
        <>
          <Readouts corner="inline" items={entries.map((e, i) => ({ label: e.label, value: at[i] > 0 ? `${fmt(at[i])} lb` : 'n/a', accent: i === 0 }))} />
          <Slider id="en-mph" label="Road speed" value={mph} min={5} max={135} onChange={setMph} format={(v) => `${fmt(v)} mph`} />
        </>
      }
      caption={<>For each engine, the most push it can put through the rear tyres at each speed, in whichever gear gives the most. Grip and drag are not taken off.</>}
    />
  )
}
