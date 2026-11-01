import { useCallback, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ControlBar, type Readout } from './ControlBar'

/** A control bar with a hairline rpm slider and a pill you hold to rev. */
export interface ThrottleBarProps {
  rpm: number
  minRpm: number
  maxRpm: number
  onRpm: (rpm: number) => void
  holding: boolean
  onHold: () => void
  onRelease: () => void
  readouts: Readout[]
  holdLabel?: string
  sliderLabel?: string
  sliderId: string
  /** extra controls rendered before the slider (e.g. a gear picker) */
  extra?: ReactNode
}

export function HoldButton({ holding, onHold, onRelease, label, className }: { holding: boolean; onHold: () => void; onRelease: () => void; label: string; className?: string }) {
  const down = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onHold()
    },
    [onHold],
  )
  const key = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        onHold()
      }
    },
    [onHold],
  )
  return (
    <button
      type="button"
      className={`btn ${holding ? 'is-on' : ''} ${className ?? ''}`}
      onPointerDown={down}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onKeyDown={key}
      onKeyUp={onRelease}
      onBlur={onRelease}
      aria-pressed={holding}
    >
      {label}
    </button>
  )
}

export function ThrottleBar({ rpm, minRpm, maxRpm, onRpm, holding, onHold, onRelease, readouts, holdLabel = 'Hold to rev', sliderLabel = 'Engine speed', sliderId, extra }: ThrottleBarProps) {
  return (
    <ControlBar readouts={readouts}>
      {extra}
      <div className="slider">
        <label className="sr" htmlFor={sliderId}>
          {sliderLabel}
        </label>
        <input id={sliderId} className="range" type="range" min={minRpm} max={maxRpm} step={10} value={Math.round(rpm)} onChange={(e) => onRpm(+e.target.value)} />
      </div>
      <HoldButton holding={holding} onHold={onHold} onRelease={onRelease} label={holdLabel} />
    </ControlBar>
  )
}
