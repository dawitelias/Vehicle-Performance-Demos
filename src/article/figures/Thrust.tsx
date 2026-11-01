import { useMemo, useState } from 'react'
import { Figure, Slider, Readouts } from '../Figure'
import { useNarrow } from '../../hooks/useNarrow'
import { nissanZ } from '../../sim/vehicles'
import { overallRatios, resistanceForce, tractiveForceCurve } from '../../sim/drivetrain'
import { mpsFromMph } from '../../sim/units'
import { tyreState } from './TyreForce'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const N_PER_LB = 4.4482
const GEAR_NAMES = ['1st', '2nd', '3rd', '4th', '5th', '6th']
const MAX_MPH = 160
const MAX_LB = 4400

/** Full-throttle push at the tyres against road speed in each gear, the 400 hp line that bounds them, grip and drag. */
export function ThrustFigure() {
  const [mph, setMph] = useState(60)
  const [ref, narrow] = useNarrow<SVGSVGElement>(560)
  const curves = useMemo(() => overallRatios(nissanZ).map((_, i) => tractiveForceCurve(nissanZ, i, 80).map((p) => ({ mph: p.mph, lb: p.force / N_PER_LB }))), [])
  const W = narrow ? 440 : 760
  const H = narrow ? 320 : 380
  const L = narrow ? 44 : 58
  const R = W - (narrow ? 16 : 28)
  const T = 14
  const B = H - 36
  const x = (v: number) => L + (v / MAX_MPH) * (R - L)
  const y = (lb: number) => B - (Math.min(lb, MAX_LB) / MAX_LB) * (B - T)
  const pt = nissanZ.powertrain
  if (pt.kind !== 'ice') throw new Error('ice only')
  // the most push 400 hp can give at each speed, after driveline losses
  const envelope = (v: number) => (400 * 550 * pt.efficiency) / ((v * 5280) / 3600)
  let envD = ''
  for (let v = 20; v <= MAX_MPH; v += 2) envD += `${v === 20 ? 'M' : 'L'}${x(v).toFixed(1)} ${y(envelope(v)).toFixed(1)}`
  let dragD = ''
  for (let v = 0; v <= MAX_MPH; v += 4) dragD += `${v === 0 ? 'M' : 'L'}${x(v).toFixed(1)} ${y(resistanceForce(nissanZ, mpsFromMph(v)) / N_PER_LB).toFixed(1)}`
  const states = [1, 2, 3, 4, 5, 6].map((g) => tyreState(mph, g))
  let best = 0
  states.forEach((s, i) => {
    if (s.inRange && s.push > states[best].push) best = i
    if (!states[best].inRange && s.inRange) best = i
  })
  const grip = tyreState(mph, best + 1).grip
  const fs = narrow ? 11 : 12.5
  return (
    <Figure
      label="Push at the tyres against road speed in each of the Z's six gears"
      aspect={W / H}
      phoneAspect={440 / 320}
      drag={false}
      fallback={
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} fontSize={fs} role="img" aria-label="Push against road speed for each gear">
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
          {[0, 40, 80, 120, 160].map((v) => (
            <text key={v} x={x(v)} y={B + 20} textAnchor={v === 0 ? 'start' : v === 160 ? 'end' : 'middle'} fill="#7e7b70">
              {v === 160 ? '160 mph' : v}
            </text>
          ))}
          {/* grip of the rear tyres, roughly level */}
          <line x1={L} x2={R} y1={y(grip)} y2={y(grip)} stroke="#f1e6cf" strokeOpacity={0.35} strokeDasharray="4 5" />
          <text x={R} y={y(grip) - 6} textAnchor="end" fill="#a7a39a">
            rear tyre grip
          </text>
          <path d={dragD} fill="none" stroke="#7e7b70" strokeWidth={1.2} />
          <text x={x(150)} y={y(resistanceForce(nissanZ, mpsFromMph(150)) / N_PER_LB) - 8} textAnchor="end" fill="#7e7b70">
            drag
          </text>
          <path d={envD} fill="none" stroke="#f2c230" strokeWidth={1.2} strokeDasharray="5 4" />
          <text x={x(narrow ? 92 : 100)} y={y(envelope(narrow ? 92 : 100)) - 10} fill="#f2c230">
            400 hp limit
          </text>
          {curves.map((c, i) => {
            let d = ''
            c.forEach((p, k) => (d += `${k === 0 ? 'M' : 'L'}${x(p.mph).toFixed(1)} ${y(p.lb).toFixed(1)}`))
            const on = i === best
            const last = c[c.length - 1]
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={on ? '#f1e6cf' : '#8d897f'} strokeWidth={on ? 2 : 1.2} strokeOpacity={on ? 1 : 0.7} />
                <text x={x(last.mph) + 4} y={y(last.lb) + (i === 0 ? 12 : 4)} fill={on ? '#f1e6cf' : '#8d897f'} fontWeight={on ? 700 : 500}>
                  {GEAR_NAMES[i]}
                </text>
              </g>
            )
          })}
          <line x1={x(mph)} x2={x(mph)} y1={T} y2={B} stroke="#9ea87a" strokeOpacity={0.6} />
          {states.map((s, i) => (s.inRange ? <circle key={i} cx={x(mph)} cy={y(s.push)} r={i === best ? 5 : 3} fill={i === best ? '#f2c230' : '#8d897f'} /> : null))}
          <line x1={L} x2={R} y1={B} y2={B} stroke="#3a3a3f" />
        </svg>
      }
      controls={
        <>
          <Readouts
            corner="inline"
            items={[
              { label: `Best gear at ${fmt(mph)} mph`, value: `${GEAR_NAMES[best]}, ${fmt(states[best].push)} lb`, accent: true },
              { label: 'In 6th', value: states[5].inRange ? `${fmt(states[5].push)} lb` : 'below idle' },
              { label: '400 hp allows', value: `${fmt(envelope(mph))} lb` },
            ]}
          />
          <Slider id="th-mph" label="Road speed" value={mph} min={10} max={155} onChange={setMph} format={(v) => `${fmt(v)} mph`} />
        </>
      }
      caption={<>Full-throttle push at the rear tyres in each gear, before grip and drag are taken off. The dashed yellow line is the push that 400 hp can supply at each speed after driveline losses.</>}
    />
  )
}
