import { memo, useEffect, useRef, useState } from 'react'
import { torqueAt, type TorqueCurve } from '../sim/engine'
import { hpFromTorqueRpm } from '../sim/units'

/**
 * Torque and horsepower against engine speed on one shared scale, so the
 * 5,252 rpm crossover is literally where the lines cross. Drawn straight on
 * the page: faint horizontal gridlines, direct labels at the line ends, and a
 * live marker with bracket-cornered readouts.
 */
export interface CurveChartProps {
  curve: TorqueCurve
  rpm: number
  minRpm?: number
  maxRpm?: number
  maxValue?: number
  crossover?: boolean
  className?: string
  /** a second, dimmer curve for comparison (e.g. the dyno curve) */
  ghost?: TorqueCurve
  /** 0..1. The curves are full-throttle values; with the throttle closed the markers dim, because the engine isn't making them. */
  throttle?: number
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export const CurveChart = memo(function CurveChart({ curve, rpm, minRpm = 1000, maxRpm = 6800, maxValue = 450, crossover = true, className, ghost, throttle = 1 }: CurveChartProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = narrow ? 440 : 760
  const H = narrow ? 270 : 300
  const L = narrow ? 44 : 64
  const Rr = W - (narrow ? 86 : 104)
  const T = 18
  const B = H - 34
  const x = (r: number) => L + ((r - minRpm) / (maxRpm - minRpm)) * (Rr - L)
  const y = (v: number) => B - (v / maxValue) * (B - T)

  const pathFor = (_c: TorqueCurve, f: (r: number) => number) => {
    let d = ''
    for (let r = minRpm; r <= maxRpm; r += 25) d += (r === minRpm ? 'M' : 'L') + x(r).toFixed(1) + ' ' + y(f(r)).toFixed(1)
    return d
  }
  const tqOf = (c: TorqueCurve) => (r: number) => torqueAt(c, r)
  const hpOf = (c: TorqueCurve) => (r: number) => hpFromTorqueRpm(torqueAt(c, r), r)

  const px = x(Math.min(Math.max(rpm, minRpm), maxRpm))
  const tv = torqueAt(curve, rpm)
  const hv = hpFromTorqueRpm(tv, rpm)
  let yT = y(tv) - 16
  let yH = y(hv) + 16
  if (yH - yT < 30) {
    const m = (yT + yH) / 2
    yT = m - 15
    yH = m + 15
  }
  const side = rpm > 5000 ? -1 : 1
  const fs = narrow ? 11.5 : 12.5

  const Label = ({ py, text, color }: { py: number; text: string; color: string }) => {
    const w = text.length * fs * 0.6 + 16
    const h = 22
    const bx = side < 0 ? px - w - 12 : px + 12
    const by = py - h / 2
    const c = 6
    return (
      <g>
        <path
          d={`M${bx} ${by + c} V${by} H${bx + c} M${bx + w - c} ${by} H${bx + w} V${by + c} M${bx} ${by + h - c} V${by + h} H${bx + c} M${bx + w - c} ${by + h} H${bx + w} V${by + h - c}`}
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
        <line x1={px} y1={py} x2={side < 0 ? bx + w : bx} y2={py} stroke={color} strokeWidth={1} strokeDasharray="2 3" />
        <text x={bx + 8} y={by + 15} fill={color} fontSize={fs} fontWeight={600}>
          {text}
        </text>
      </g>
    )
  }

  const gridVals = [100, 200, 300, 400].filter((v) => v < maxValue)
  const axisRpm = [1000, 2000, 3000, 4000, 5000, 6000].filter((r) => r >= minRpm && r <= maxRpm)

  return (
    <svg ref={ref} className={className} viewBox={`0 0 ${W} ${H}`} fontFamily="inherit" fontSize={fs} role="img" aria-label="Torque and horsepower against engine speed">
      {gridVals.map((v, i) => (
        <g key={v}>
          <line x1={L} x2={Rr} y1={y(v)} y2={y(v)} stroke="#232320" strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fill="#7e7b70">
            {i === gridVals.length - 1 && !narrow ? `${v} lb-ft or hp` : v}
          </text>
        </g>
      ))}
      {axisRpm.map((r) => (
        <text key={r} x={x(r)} y={B + 18} textAnchor={r === minRpm ? 'start' : 'middle'} fill="#7e7b70">
          {r === minRpm && !narrow ? `${fmt(r)} rpm` : fmt(r)}
        </text>
      ))}
      {crossover && (
        <>
          <line x1={x(5252)} x2={x(5252)} y1={T} y2={B} stroke="#7e7b70" strokeDasharray="2 5" strokeWidth={1} opacity={0.8} />
          <text x={x(5252) + 6} y={T + 12} fill="#7e7b70">
            5,252
          </text>
        </>
      )}
      {ghost && (
        <>
          <path d={pathFor(ghost, hpOf(ghost))} fill="none" stroke="#f3efe4" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3 4" />
          <path d={pathFor(ghost, tqOf(ghost))} fill="none" stroke="#f2c230" strokeWidth={1} strokeOpacity={0.35} strokeDasharray="3 4" />
        </>
      )}
      <g filter="url(#fx-forge)">
        <path d={pathFor(curve, hpOf(curve))} fill="none" stroke="#f1e6cf" strokeWidth={1.3} />
        <path d={pathFor(curve, tqOf(curve))} fill="none" stroke="#f2c230" strokeWidth={1.3} />
      </g>
      <text x={Rr + 8} y={y(torqueAt(curve, maxRpm)) + 4} fill="#f2c230" fontWeight={600}>
        torque
      </text>
      <text x={Rr + 8} y={y(hpFromTorqueRpm(torqueAt(curve, maxRpm), maxRpm)) + 4} fill="#f1e6cf" fontWeight={600}>
        horsepower
      </text>
      <line x1={px} x2={px} y1={T} y2={B} stroke="#9ea87a" strokeWidth={1} opacity={0.7} />
      <g opacity={throttle > 0.05 ? 1 : 0.35}>
        <circle cx={px} cy={y(tv)} r={3} fill="#fff4dc" filter="url(#fx-hot)" />
        <circle cx={px} cy={y(hv)} r={3} fill="#fff4dc" filter="url(#fx-hot)" />
        <Label py={yT} text={`${fmt(tv)} lb-ft`} color="#f2c230" />
        <Label py={yH} text={`${fmt(hv)} hp`} color="#f1e6cf" />
      </g>
    </svg>
  )
})
