import { memo, useId } from 'react'

/**
 * The 2024 Nissan Z (RZ34) in side profile as thin luminous contour lines.
 * viewBox 1000 x 340 ≈ 4,380 mm x 1,490 mm at 0.228 units/mm; ground at y=318.
 * Wheel groups rotate by `wheelAngle` (radians). Front axle x=217, rear x=799, r=77.
 */
export interface ZContourProps {
  wheelAngle?: number
  color?: string
  /** 0..1 strength of the outer glow */
  glow?: number
  className?: string
  /** draw the ground scale and axle section lines */
  showScale?: boolean
}

const FRONT = 217
const REAR = 799
const AXLE_Y = 233
const R = 77

function Wheel({ cx, angle, color }: { cx: number; angle: number; color: string }) {
  const spokes = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    for (const d of [-0.07, 0.07]) {
      spokes.push(
        <line
          key={`${i}${d}`}
          x1={Math.cos(a + d) * 10}
          y1={Math.sin(a + d) * 10}
          x2={Math.cos(a + d * 1.8) * 51}
          y2={Math.sin(a + d * 1.8) * 51}
          strokeOpacity={0.8}
        />,
      )
    }
  }
  const ticks = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const inner = i % 4 ? 74 : 71
    ticks.push(
      <line key={i} x1={Math.cos(a) * R} y1={Math.sin(a) * R} x2={Math.cos(a) * inner} y2={Math.sin(a) * inner} strokeOpacity={0.45} />,
    )
  }
  return (
    <g transform={`translate(${cx} ${AXLE_Y})`} fill="none" stroke={color} strokeWidth={1}>
      <circle r={R} strokeWidth={1.2} />
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

export const ZContour = memo(function ZContour({ wheelAngle = 0, color = '#f2c230', glow = 1, className, showScale = true }: ZContourProps) {
  const id = useId()
  const glowId = `g${id}`
  const glow2Id = `h${id}`
  const ticks = []
  for (let x = 10; x <= 990; x += 20) {
    const maj = (x - 10) % 100 === 0
    ticks.push(<line key={x} x1={x} x2={x} y1={318} y2={318 + (maj ? 8 : 4)} />)
  }
  return (
    <svg className={className} viewBox="0 0 1000 340" role="img" aria-label="Nissan Z, side profile, drawn as contour lines">
      <defs>
        <filter id={glowId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={1.6 * glow} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={glow2Id} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={4 * glow} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {showScale && (
        <>
          <g stroke="#5a5748" strokeWidth={0.7}>
            <line x1={10} y1={318} x2={990} y2={318} />
            {ticks}
          </g>
          <g stroke="#6b6a5a" strokeWidth={0.6} strokeDasharray="2 5">
            <line x1={FRONT} y1={40} x2={FRONT} y2={330} />
            <line x1={REAR} y1={40} x2={REAR} y2={330} />
          </g>
        </>
      )}
      <g fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" filter={`url(#${glowId})`}>
        <path d="M34 264 C26 246 26 214 34 184 C38 170 42 158 50 148 C100 136 160 128 217 122 C270 116 340 100 395 90 L482 38 C512 22 536 14 556 13 C610 11 666 22 730 50 C770 66 806 78 840 82 C870 85 900 82 926 78 C940 82 946 100 948 130 C949 165 946 190 940 210 C932 240 920 260 900 274 C892 280 884 284 876 284 L871 284 A88 88 0 0 1 727 284 L289 284 A88 88 0 0 1 145 284 L74 284 C58 282 44 276 34 264 Z" />
        <path d="M412 94 L488 42 C540 36 600 36 632 42 C686 54 732 70 766 84 C690 92 560 94 412 94 Z" />
        <path d="M590 95 C591 150 589 230 585 282" strokeOpacity={0.6} />
        <path d="M395 90 C425 74 458 54 482 38" strokeOpacity={0.5} />
        <path d="M140 134 C220 122 300 104 388 92" strokeOpacity={0.45} />
        <path d="M54 152 C84 142 124 136 166 134 C154 142 112 150 74 156 C64 158 58 157 54 152 Z" strokeOpacity={0.9} />
        <path d="M406 88 C412 80 422 76 430 78 C434 84 430 92 420 94 Z" strokeOpacity={0.7} />
        <path d="M928 80 C940 84 946 100 947 126 L947 136 C935 138 912 136 900 132" strokeOpacity={0.6} />
        <path d="M905 118 C920 116 936 116 946 118" strokeWidth={2.2} strokeOpacity={0.95} />
        <path d="M940 212 C930 232 918 252 902 268" strokeOpacity={0.5} />
        <path d="M170 150 C320 150 470 154 600 158 C680 160 735 170 740 190" strokeOpacity={0.35} />
        <path d="M300 270 L720 270" strokeOpacity={0.35} />
      </g>
      <path d="M490 40 C545 35 605 35 636 42 C688 54 732 70 764 84" fill="none" stroke="#f6eedd" strokeWidth={1.6} strokeLinecap="round" filter={`url(#${glow2Id})`} />
      <g filter={`url(#${glowId})`}>
        <Wheel cx={FRONT} angle={wheelAngle} color={color} />
        <Wheel cx={REAR} angle={wheelAngle} color={color} />
      </g>
    </svg>
  )
})
