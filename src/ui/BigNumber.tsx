import { memo, useMemo } from 'react'
import './BigNumber.css'

/**
 * A poster-scale numeral seen through sliced glass: the figure is split into
 * horizontal bands, each refracted sideways by a different amount, with the
 * red, green and blue channels pulled apart so the edges fringe. `energy`
 * (0..1) drives how far the bands shift; at 0 the number sits still.
 */
export interface BigNumberProps {
  value: string
  energy?: number
  slices?: number
  className?: string
  label?: string
}

export const BigNumber = memo(function BigNumber({ value, energy = 0, slices = 7, className, label }: BigNumberProps) {
  const seeds = useMemo(() => Array.from({ length: slices }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1), [slices])
  return (
    <div className={`bignum ${className ?? ''}`} role="img" aria-label={label ?? value}>
      {seeds.map((seed, i) => {
        const top = (i / slices) * 100
        const bottom = (1 - (i + 1) / slices) * 100
        const shift = Math.sin(energy * 5.5 + seed * 6.28) * 26 * (0.35 + energy)
        const sep = 2 + 10 * energy
        const blur = 0.3 + 1.6 * energy
        return (
          <div key={i} className="bignum-slice" style={{ clipPath: `inset(${top.toFixed(2)}% 0 ${bottom.toFixed(2)}% 0)` }}>
            <div className="bignum-ch r" style={{ transform: `translateX(${(shift - sep).toFixed(1)}px)`, filter: `blur(${blur.toFixed(2)}px)` }}>
              <span>{value}</span>
            </div>
            <div className="bignum-ch g" style={{ transform: `translateX(${shift.toFixed(1)}px)` }}>
              <span>{value}</span>
            </div>
            <div className="bignum-ch b" style={{ transform: `translateX(${(shift + sep).toFixed(1)}px)`, filter: `blur(${blur.toFixed(2)}px)` }}>
              <span>{value}</span>
            </div>
          </div>
        )
      })}
      {seeds.slice(1).map((_, i) => (
        <div key={`c${i}`} className="bignum-cut" style={{ top: `${(((i + 1) / slices) * 100).toFixed(2)}%` }} />
      ))}
    </div>
  )
})
