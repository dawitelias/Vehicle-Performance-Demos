import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { View } from '@react-three/drei'
import { hasWebGL } from '../ui/ZScene'

/**
 * A figure in the reading column: a stage drawn by the shared WebGL canvas,
 * optional HTML overlays (readouts) on top of it, controls beneath, then a
 * caption. Dragging sideways on the stage turns the scene: the drag writes
 * into `yaw`, which the scene reads every frame. Vertical drags still scroll
 * the page.
 */
export function Figure({
  scene,
  overlay,
  controls,
  caption,
  aspect = 16 / 9,
  phoneAspect,
  drag = true,
  yaw,
  wide = false,
  fallback,
  label,
}: {
  scene?: ReactNode
  overlay?: ReactNode
  controls?: ReactNode
  caption?: ReactNode
  aspect?: number
  phoneAspect?: number
  drag?: boolean
  yaw?: React.RefObject<number>
  wide?: boolean
  fallback?: ReactNode
  label: string
}) {
  const [gl] = useState(() => hasWebGL())
  const start = useRef<{ x: number; yaw: number } | null>(null)
  const style = { '--fig-aspect': aspect, '--fig-aspect-phone': phoneAspect ?? aspect } as CSSProperties
  const onDown = (e: React.PointerEvent) => {
    if (!drag || !yaw) return
    start.current = { x: e.clientX, yaw: yaw.current }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current || !yaw) return
    const w = (e.currentTarget as HTMLElement).clientWidth
    yaw.current = start.current.yaw + ((e.clientX - start.current.x) / w) * Math.PI * 1.4
  }
  const onUp = () => {
    start.current = null
  }
  return (
    <figure className={`fig ${wide ? 'fig-wide' : ''}`}>
      <div
        className={`fig-stage ${drag && yaw ? 'is-draggable' : ''}`}
        style={style}
        role="img"
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      >
        {gl && scene ? <View className="fig-view">{scene}</View> : fallback}
        {overlay && <div className="fig-overlay">{overlay}</div>}
      </div>
      {controls && <div className="fig-controls">{controls}</div>}
      {caption && <figcaption className="fig-caption">{caption}</figcaption>}
    </figure>
  )
}

/** A labelled slider in the Ciechanowski manner: name on the left, value on the right, a hairline track between. */
export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <label htmlFor={id} className="slider-label">
        {label}
      </label>
      <input id={id} className="slider-input" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ '--pct': `${pct}%` } as CSSProperties} />
      <output htmlFor={id} className="slider-value">
        {format(value)}
      </output>
    </div>
  )
}

/** A row of choices, for gears and engines. */
export function Choice<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      <span className="slider-label">{label}</span>
      <div className="choice-options">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={`choice-btn ${o.value === value ? 'is-on' : ''}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Small corner readouts drawn over a figure. */
export function Readouts({ items, corner = 'tl', title }: { items: { label: string; value: string; accent?: boolean }[]; corner?: 'tl' | 'tr' | 'bl' | 'br' | 'inline'; title?: string }) {
  return (
    <dl className={`readouts readouts-${corner}`}>
      {title && <div className="readouts-title">{title}</div>}
      {items.map((i) => (
        <div key={i.label} className="readouts-row">
          <dt>{i.label}</dt>
          <dd className={i.accent ? 'is-accent' : undefined}>{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}
