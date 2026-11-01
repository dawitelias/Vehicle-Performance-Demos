import { memo, useId } from 'react'

/** A 270° tachometer ring: thin ticks, a bright live arc, a needle, the rpm in the middle. */
export interface RingTachProps {
  rpm: number
  maxRpm?: number
  redlineRpm?: number
  /** highlight band, e.g. the torque plateau */
  band?: { from: number; to: number; label?: string }
  onLimiter?: boolean
  className?: string
}

const A0 = 135
const SWEEP = 270
const CX = 170
const CY = 170
const R = 148

function pol(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}
function arcSq(r: number, a0: number, a1: number, sq: number): string {
  const [x0, y0] = pol(r, a0)
  const [x1, y1] = pol(r, a1)
  return `M${x0.toFixed(2)} ${(CY + (y0 - CY) * sq).toFixed(2)} A${r} ${r * sq} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${(CY + (y1 - CY) * sq).toFixed(2)}`
}
function echoTicks(sq: number) {
  const out = []
  for (let r = 0; r <= 8000; r += 250) {
    const t = A0 + (SWEEP * r) / 8000
    const [x0, y0] = pol(R, t)
    const [x1, y1] = pol(R - (r % 1000 ? 5 : 12), t)
    out.push(<line key={r} x1={x0} y1={CY + (y0 - CY) * sq} x2={x1} y2={CY + (y1 - CY) * sq} strokeOpacity={0.6} />)
  }
  return out
}
function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = pol(r, a0)
  const [x1, y1] = pol(r, a1)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export const RingTach = memo(function RingTach({ rpm, maxRpm = 8000, redlineRpm = 7000, band, onLimiter, className }: RingTachProps) {
  const id = useId()
  const ang = (r: number) => A0 + (SWEEP * r) / maxRpm
  const a = ang(Math.min(rpm, maxRpm))
  const ticks = []
  for (let r = 0; r <= maxRpm; r += 100) {
    const t = ang(r)
    const maj = r % 1000 === 0
    const mid = r % 500 === 0
    const [x0, y0] = pol(R, t)
    const [x1, y1] = pol(R - (maj ? 14 : mid ? 8 : 4), t)
    const red = r >= redlineRpm
    ticks.push(<line key={r} x1={x0} y1={y0} x2={x1} y2={y1} stroke={red ? '#e8453c' : maj ? '#f1e6cf' : '#6e6a60'} strokeWidth={maj ? 1.2 : 0.7} />)
    if (maj) {
      const [tx, ty] = pol(100, t)
      ticks.push(
        <text key={`t${r}`} x={tx} y={ty + 5} textAnchor="middle" fill={red ? '#e8453c' : '#d9d4c7'} fontSize={14} fontWeight={600}>
          {r / 1000}
        </text>,
      )
    }
  }
  const [nx0, ny0] = pol(126, a)
  const [nx1, ny1] = pol(152, a)
  return (
    <svg className={className} viewBox="0 0 340 340" role="img" aria-label={`Engine speed ${Math.round(rpm)} rpm`}>
      <defs>
        <filter id={`g${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[3, 2, 1].map((i) => (
        <g key={i} transform={`translate(${i * 22} ${-i * 18})`} opacity={0.12 + 0.1 / i} fill="none" stroke="#f1e6cf" strokeWidth={0.8}>
          <path d={arcSq(R, A0, A0 + SWEEP, 0.55)} strokeDasharray={i === 2 ? '2 4' : undefined} />
          {echoTicks(0.55)}
        </g>
      ))}
      <path d={arc(R, A0, A0 + SWEEP)} fill="none" stroke="#3a3833" strokeWidth={0.8} />
      <path d={arc(118, A0, A0 + SWEEP)} fill="none" stroke="#2a2926" strokeWidth={0.6} strokeDasharray="1 4" />
      <g filter="url(#fx-forge)">{ticks}</g>
      {band && (
        <>
          <path d={arc(R, ang(band.from), ang(band.to))} fill="none" stroke="#f2c230" strokeWidth={1.4} opacity={0.6} />
          {band.label && (
            <text x={CX} y={CY + 64} textAnchor="middle" fill="#f2c230" fontSize={10.5} fontWeight={500} opacity={0.9}>
              {band.label}
            </text>
          )}
        </>
      )}
      <path d={arc(R, A0, a)} fill="none" stroke={onLimiter ? '#ff6a5c' : '#fff4dc'} strokeWidth={2.6} strokeLinecap="round" filter="url(#fx-hot)" />
      <line x1={nx0} y1={ny0} x2={nx1} y2={ny1} stroke="#fff4dc" strokeWidth={1.2} filter={`url(#g${id})`} />
      <circle cx={nx1} cy={ny1} r={2.5} fill="#fff6e0" />
      <text x={CX} y={CY + 12} textAnchor="middle" fill="#ede9e0" fontSize={44} fontWeight={740} letterSpacing="-1.5" style={{ fontVariantNumeric: 'tabular-nums', fontStretch: '112%' }}>
        {Math.round(rpm).toLocaleString('en-US')}
      </text>
      <text x={CX} y={CY + 34} textAnchor="middle" fill="#6b685f" fontSize={12} fontWeight={500}>
        rpm
      </text>
    </svg>
  )
})
