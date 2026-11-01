import type { JSX } from 'react'
import { Z_AXLE_Y, Z_FRONT_AXLE, Z_GLASS, Z_REAR_AXLE, Z_SILHOUETTE, Z_WHEEL_R } from './zPaths'

/**
 * A small Z for diagrams: silhouette, glass and two wheels, drawn as a group
 * inside a parent SVG. Scale with `scale` (1 = 1000 units wide).
 */
export function ZGlyph({ x = 0, y = 0, scale = 0.2, wheelAngle = 0, color = '#f2c230', opacity = 1, strokeWidth = 1, flip = false, href }: { x?: number; y?: number; scale?: number; wheelAngle?: number; color?: string; opacity?: number; strokeWidth?: number; /** mirror so the nose points right */ flip?: boolean; /** a side-on sprite of the real model (nose right, 1000 x 400, ground at y 350, nose at x 940) */ href?: string | null }) {
  if (href) {
    // sprite space: 1000 x 400, ground at 350, nose at 940; `x` is the nose, `y` the drawing's top (ground - 318 * scale)
    const ix = flip ? x - 940 * scale : x - 60 * scale
    return <image href={href} x={ix} y={y - 32 * scale} width={1000 * scale} height={400 * scale} opacity={opacity} transform={flip ? undefined : `translate(${2 * ix + 1000 * scale} 0) scale(-1 1)`} style={{ filter: 'url(#fx-glow)' }} />
  }
  const sw = strokeWidth / scale
  const deg = (wheelAngle * 180) / Math.PI
  const spokes: JSX.Element[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    spokes.push(<line key={i} x1={Math.cos(a) * 10} y1={Math.sin(a) * 10} x2={Math.cos(a) * 52} y2={Math.sin(a) * 52} />)
  }
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} ${Z_AXLE_Y})`}>
      <circle r={Z_WHEEL_R} />
      <g transform={`rotate(${deg})`} strokeOpacity={0.8}>
        <circle r={53} />
        {spokes}
      </g>
    </g>
  )
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" opacity={opacity}>
      <path d={Z_SILHOUETTE} />
      <path d={Z_GLASS} strokeOpacity={0.8} />
      {wheel(Z_FRONT_AXLE)}
      {wheel(Z_REAR_AXLE)}
    </g>
  )
}
