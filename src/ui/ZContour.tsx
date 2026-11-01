import { memo, type JSX } from 'react'
import { Z_AXLE_Y, Z_FRONT_AXLE, Z_GLASS, Z_REAR_AXLE, Z_SILHOUETTE, Z_WHEEL_R } from './zPaths'

/**
 * The 2024 Nissan Z (RZ34) in side profile as thin luminous contour lines.
 * viewBox 1000 x 340 (or 1000 x 640 when exploded) ≈ 4,380 mm x 1,490 mm
 * at 0.228 units/mm; ground at y = 318. Front axle x=217, rear x=799, r=77.
 *
 * `exploded` (0..1) pulls each wheel apart along a leader line into tyre, rim,
 * disc and hub, the way an exploded drawing does. `labels` adds bracket-cornered
 * callouts. Static line work uses the fx-forge filter (bloom + colour fringe);
 * moving parts use the cheaper fx-glow.
 */
export interface ZLabel {
  x: number
  y: number
  text: string
  color?: string
}

export interface ZContourProps {
  wheelAngle?: number
  color?: string
  className?: string
  showScale?: boolean
  exploded?: number
  labels?: ZLabel[]
}

const PART_COLOR = '#f1e6cf'

function Wheel({ cx, angle, color }: { cx: number; angle: number; color: string }) {
  const spokes: JSX.Element[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    for (const d of [-0.07, 0.07]) {
      spokes.push(<line key={`${i}${d}`} x1={Math.cos(a + d) * 10} y1={Math.sin(a + d) * 10} x2={Math.cos(a + d * 1.8) * 51} y2={Math.sin(a + d * 1.8) * 51} strokeOpacity={0.8} />)
    }
  }
  const ticks: JSX.Element[] = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const inner = i % 4 ? 74 : 71
    ticks.push(<line key={i} x1={Math.cos(a) * Z_WHEEL_R} y1={Math.sin(a) * Z_WHEEL_R} x2={Math.cos(a) * inner} y2={Math.sin(a) * inner} strokeOpacity={0.45} />)
  }
  return (
    <g transform={`translate(${cx} ${Z_AXLE_Y})`} fill="none" stroke={color} strokeWidth={1}>
      <circle r={Z_WHEEL_R} strokeWidth={1.2} />
      <circle r={71} strokeOpacity={0.3} />
      <circle r={34} strokeOpacity={0.25} strokeWidth={0.6} />
      <g transform={`rotate(${(angle * 180) / Math.PI})`}>
        <circle r={53} strokeOpacity={0.9} />
        <circle r={8} />
        {spokes}
        {ticks}
      </g>
    </g>
  )
}

/** One wheel pulled apart along a leader: tyre stays in the arch, rim, disc and hub slide out. */
function ExplodedWheel({ cx, dir, t, angle }: { cx: number; dir: -1 | 1; t: number; angle: number }) {
  const ex = cx + dir * 97
  const ey = Z_AXLE_Y + 327
  const parts: { at: number; kind: 'tyre' | 'rim' | 'disc' | 'hub'; r: number }[] = [
    { at: 0, kind: 'tyre', r: Z_WHEEL_R },
    { at: 0.36, kind: 'rim', r: 53 },
    { at: 0.68, kind: 'disc', r: 36 },
    { at: 0.95, kind: 'hub', r: 9 },
  ]
  const deg = (angle * 180) / Math.PI
  return (
    <g fill="none" stroke={PART_COLOR} strokeWidth={0.9}>
      <line x1={cx} y1={Z_AXLE_Y} x2={cx + (ex - cx) * t} y2={Z_AXLE_Y + (ey - Z_AXLE_Y) * t} stroke="#b8803a" strokeWidth={0.8} strokeDasharray="3 6" opacity={0.7 * t} />
      {parts.map((p) => {
        const k = p.at * t
        const x = cx + (ex - cx) * k
        const y = Z_AXLE_Y + (ey - Z_AXLE_Y) * k
        const sq = 1 - 0.5 * k
        if (p.kind === 'tyre') {
          const ticks: JSX.Element[] = []
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2
            const r1 = i % 4 ? 74 : 70
            ticks.push(<line key={i} x1={Math.cos(a) * p.r} y1={Math.sin(a) * p.r * sq} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1 * sq} strokeOpacity={0.5} />)
          }
          const a0 = -0.6
          const a1 = 0.2
          return (
            <g key={p.kind} transform={`translate(${x} ${y})`} filter="url(#fx-forge)">
              <ellipse rx={p.r} ry={p.r * sq} strokeWidth={1.3} />
              {ticks}
              <path d={`M${Math.cos(a0) * p.r} ${Math.sin(a0) * p.r * sq} A${p.r} ${p.r * sq} 0 0 1 ${Math.cos(a1) * p.r} ${Math.sin(a1) * p.r * sq}`} stroke="#fff4dc" strokeWidth={2.2} filter="url(#fx-hot)" />
            </g>
          )
        }
        if (p.kind === 'rim') {
          const spokes: JSX.Element[] = []
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            for (const d of [-0.07, 0.07]) {
              spokes.push(<line key={`${i}${d}`} x1={Math.cos(a + d) * 10} y1={Math.sin(a + d) * 10 * sq} x2={Math.cos(a + d * 1.8) * p.r} y2={Math.sin(a + d * 1.8) * p.r * sq} strokeOpacity={0.8} />)
            }
          }
          return (
            <g key={p.kind} transform={`translate(${x} ${y})`} filter="url(#fx-glow)">
              <ellipse rx={p.r} ry={p.r * sq} />
              <g transform={`scale(1 ${sq}) rotate(${deg}) scale(1 ${1 / sq})`}>{spokes}</g>
            </g>
          )
        }
        if (p.kind === 'disc') {
          return (
            <g key={p.kind} transform={`translate(${x} ${y})`} filter="url(#fx-forge)">
              <ellipse rx={p.r} ry={p.r * sq} strokeWidth={0.7} />
              <ellipse rx={p.r - 8} ry={(p.r - 8) * sq} strokeOpacity={0.4} strokeDasharray="1 3" />
            </g>
          )
        }
        return (
          <g key={p.kind} transform={`translate(${x} ${y})`} filter="url(#fx-forge)">
            <ellipse rx={p.r} ry={p.r * sq} />
            <ellipse rx={3} ry={3 * sq} />
          </g>
        )
      })}
    </g>
  )
}

function Bracket({ x, y, text, color = '#9ea87a' }: ZLabel) {
  const w = text.length * 6.6 + 16
  const h = 18
  const c = 5
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 ${c} V0 H${c} M${w - c} 0 H${w} V${c} M0 ${h - c} V${h} H${c} M${w - c} ${h} H${w} V${h - c}`} fill="none" stroke={color} strokeWidth={0.9} />
      <text x={8} y={12.5} fill={color} fontSize={11} letterSpacing={0.6}>
        {text}
      </text>
    </g>
  )
}

export const ZContour = memo(function ZContour({ wheelAngle = 0, color = '#f3d03e', className, showScale = true, exploded, labels }: ZContourProps) {
  const H = exploded !== undefined ? 640 : 340
  const t = exploded ?? 0
  const ticks: JSX.Element[] = []
  for (let x = 10; x <= 990; x += 20) {
    const maj = (x - 10) % 100 === 0
    ticks.push(<line key={x} x1={x} x2={x} y1={318} y2={318 + (maj ? 8 : 4)} />)
  }
  return (
    <svg className={className} viewBox={`0 0 1000 ${H}`} role="img" aria-label="Nissan Z, side profile, drawn as contour lines">
      {showScale && (
        <>
          <g stroke="#5a5748" strokeWidth={0.7}>
            <line x1={10} y1={318} x2={990} y2={318} />
            {ticks}
          </g>
          <g stroke="#6b6a5a" strokeWidth={0.6} strokeDasharray="2 5">
            <line x1={Z_FRONT_AXLE} y1={40} x2={Z_FRONT_AXLE} y2={330} />
            <line x1={Z_REAR_AXLE} y1={40} x2={Z_REAR_AXLE} y2={330} />
          </g>
        </>
      )}
      <g fill="none" stroke={color} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" filter="url(#fx-forge)">
        <path d={Z_SILHOUETTE} />
        <path d={Z_GLASS} />
        <path d="M590 95 C591 150 589 230 585 282" strokeOpacity={0.5} />
        <path d="M395 90 C425 74 458 54 482 38" strokeOpacity={0.5} />
        <path d="M140 134 C220 122 300 104 388 92" strokeOpacity={0.4} />
        <path d="M54 152 C84 142 124 136 166 134 C154 142 112 150 74 156 C64 158 58 157 54 152 Z" />
        <path d="M406 88 C412 80 422 76 430 78 C434 84 430 92 420 94 Z" strokeOpacity={0.7} />
        <path d="M928 80 C940 84 946 100 947 126 L947 136 C935 138 912 136 900 132" strokeOpacity={0.6} />
        <path d="M905 118 C920 116 936 116 946 118" strokeWidth={2.2} />
        <path d="M940 212 C930 232 918 252 902 268" strokeOpacity={0.5} />
        <path d="M170 150 C320 150 470 154 600 158 C680 160 735 170 740 190" strokeOpacity={0.35} />
        <path d="M300 270 L720 270" strokeOpacity={0.35} />
      </g>
      <path d="M490 40 C545 35 605 35 636 42 C688 54 732 70 764 84" fill="none" stroke="#fff4dc" strokeWidth={1.6} strokeLinecap="round" filter="url(#fx-hot)" />
      {t > 0.001 ? (
        <>
          <ExplodedWheel cx={Z_FRONT_AXLE} dir={-1} t={t} angle={wheelAngle} />
          <ExplodedWheel cx={Z_REAR_AXLE} dir={1} t={t} angle={wheelAngle} />
        </>
      ) : (
        <g filter="url(#fx-glow)">
          <Wheel cx={Z_FRONT_AXLE} angle={wheelAngle} color={color} />
          <Wheel cx={Z_REAR_AXLE} angle={wheelAngle} color={color} />
        </g>
      )}
      {labels && (
        <g fontFamily="inherit" opacity={exploded !== undefined ? t : 1}>
          {labels.map((l) => (
            <Bracket key={l.text} {...l} />
          ))}
        </g>
      )}
    </svg>
  )
})
