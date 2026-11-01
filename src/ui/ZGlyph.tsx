import type { JSX } from 'react'
import { Z_AXLE_Y, Z_FRONT_AXLE, Z_GLASS, Z_REAR_AXLE, Z_SILHOUETTE, Z_WHEEL_R } from './zPaths'
import type { ZSprite } from './zSprite'

/**
 * A small Z for diagrams: silhouette, glass and two wheels, drawn as a group
 * inside a parent SVG. Scale with `scale` (1 = 1000 units wide).
 */
export function ZGlyph({ x = 0, y = 0, scale = 0.2, wheelAngle = 0, color = '#f2c230', opacity = 1, strokeWidth = 1, flip = false, href }: { x?: number; y?: number; scale?: number; wheelAngle?: number; color?: string; opacity?: number; strokeWidth?: number; /** mirror so the nose points right */ flip?: boolean; /** side-on renders of the real model; when present they replace the line drawing */ href?: ZSprite | null }) {
  if (href) {
    // `x` is where the nose sits, `y + 318 * scale` is the ground line (the line drawing's convention)
    const k = (scale * 1000) / 964 // the drawing is 1000 units per car length; the render is 220 px/m x 4.38 m
    const ground = y + 318 * scale
    const ix = x - href.noseX * k
    const iy = ground - href.groundY * k
    const ws = href.wheelSize * k
    const deg = (wheelAngle * 180) / Math.PI
    return (
      <g opacity={opacity}>
        <image href={href.body} x={ix} y={iy} width={href.width * k} height={href.height * k} />
        {href.wheels.map((c, i) => {
          const cx = ix + c.x * k
          const cy = iy + c.y * k
          return <image key={i} href={href.wheel} x={cx - ws / 2} y={cy - ws / 2} width={ws} height={ws} transform={`rotate(${deg.toFixed(1)} ${cx} ${cy})`} />
        })}
      </g>
    )
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
