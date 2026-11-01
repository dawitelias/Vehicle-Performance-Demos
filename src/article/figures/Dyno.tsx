import { useState } from 'react'
import { Figure, Slider, Choice, Readouts } from '../Figure'
import { Z_ENGINE } from '../../sim/vehicles'
import { resolveCurve, torqueAt, type CurveMode } from '../../sim/engine'
import { hpFromTorqueRpm } from '../../sim/units'
import { useNarrow } from '../../hooks/useNarrow'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** Torque and horsepower on one scale, with a cursor you move along engine speed. */
function DynoChart({ rpm, mode }: { rpm: number; mode: CurveMode }) {
  const [ref, narrow] = useNarrow<SVGSVGElement>(560)
  const curve = resolveCurve(Z_ENGINE, mode)
  const W = narrow ? 440 : 760
  const H = narrow ? 300 : 340
  const L = narrow ? 40 : 56
  const R = W - (narrow ? 78 : 96)
  const T = 16
  const B = H - 34
  const MIN = 1000
  const MAX = 6800
  const x = (r: number) => L + ((r - MIN) / (MAX - MIN)) * (R - L)
  const y = (v: number) => B - (v / 450) * (B - T)
  let dT = ''
  let dH = ''
  for (let r = MIN; r <= MAX; r += 25) {
    dT += `${r === MIN ? 'M' : 'L'}${x(r).toFixed(1)} ${y(torqueAt(curve, r)).toFixed(1)}`
    dH += `${r === MIN ? 'M' : 'L'}${x(r).toFixed(1)} ${y(hpFromTorqueRpm(torqueAt(curve, r), r)).toFixed(1)}`
  }
  const tq = torqueAt(curve, rpm)
  const hp = hpFromTorqueRpm(tq, rpm)
  const px = x(rpm)
  const fs = narrow ? 11.5 : 12.5
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} fontSize={fs} role="img" aria-label="Torque and horsepower against engine speed">
      {[100, 200, 300, 400].map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="#26252a" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fill="#7e7b70">
            {v}
          </text>
        </g>
      ))}
      {[1000, 2000, 3000, 4000, 5000, 6000].map((r) => (
        <text key={r} x={x(r)} y={B + 20} textAnchor="middle" fill="#7e7b70">
          {fmt(r)}
        </text>
      ))}
      <text x={R} y={B + 20} textAnchor="end" fill="#7e7b70" dx={narrow ? 70 : 88}>
        rpm
      </text>
      <line x1={x(5252)} x2={x(5252)} y1={T} y2={B} stroke="#7e7b70" strokeDasharray="2 5" />
      <text x={x(5252) + 6} y={T + 10} fill="#7e7b70">
        5,252 rpm
      </text>
      <path d={dH} fill="none" stroke="#f1e6cf" strokeWidth={1.6} />
      <path d={dT} fill="none" stroke="#f3d03e" strokeWidth={1.6} />
      <text x={R + 8} y={y(torqueAt(curve, MAX)) + 4} fill="#f3d03e" fontWeight={600}>
        lb-ft
      </text>
      <text x={R + 8} y={y(hpFromTorqueRpm(torqueAt(curve, MAX), MAX)) + 4} fill="#f1e6cf" fontWeight={600}>
        hp
      </text>
      <line x1={px} x2={px} y1={T} y2={B} stroke="#9ea87a" strokeOpacity={0.6} />
      <circle cx={px} cy={y(tq)} r={4} fill="#f3d03e" />
      <circle cx={px} cy={y(hp)} r={4} fill="#f1e6cf" />
    </svg>
  )
}

export function DynoFigure() {
  const [rpm, setRpm] = useState(3000)
  const [mode, setMode] = useState<CurveMode>('rated')
  const curve = resolveCurve(Z_ENGINE, mode)
  const tq = torqueAt(curve, rpm)
  const hp = hpFromTorqueRpm(tq, rpm)
  return (
    <Figure
      label="The Z's torque and horsepower curves"
      aspect={760 / 340}
      phoneAspect={440 / 300}
      drag={false}
      fallback={<DynoChart rpm={rpm} mode={mode} />}
      controls={
        <>
          <Readouts corner="inline" items={[{ label: 'Torque', value: `${fmt(tq)} lb-ft`, accent: true }, { label: 'Power', value: `${fmt(hp)} hp` }, { label: 'Torque × rpm ÷ 5,252', value: `${fmt(tq)} × ${fmt(rpm)} ÷ 5,252 = ${fmt(hp)}` }]} />
          <Slider id="dy-rpm" label="Engine speed" value={rpm} min={1000} max={6800} step={10} onChange={setRpm} format={(v) => `${fmt(v)} rpm`} />
          <Choice
            label="Curve"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'rated', label: "Nissan's rating" },
              { value: 'dyno', label: 'Measured on a dyno' },
            ]}
          />
        </>
      }
      caption={<>Full-throttle torque and power at the crankshaft. Stock cars measure 360 to 383 lb-ft at the wheels on chassis dynos, so the second curve raises the middle of the range to match.</>}
    />
  )
}

export { DynoChart }
