import { useCallback, type KeyboardEvent, type PointerEvent } from 'react'

/** The sticky control strip: a hairline slider for precision, a pill you hold to rev, live readouts. */
export interface ThrottleBarProps {
  rpm: number
  minRpm: number
  maxRpm: number
  onRpm: (rpm: number) => void
  holding: boolean
  onHold: () => void
  onRelease: () => void
  readouts: { value: string; unit: string; accent?: boolean }[]
  holdLabel?: string
  sliderLabel?: string
}

export function ThrottleBar({ rpm, minRpm, maxRpm, onRpm, holding, onHold, onRelease, readouts, holdLabel = 'Hold to rev', sliderLabel = 'Engine speed' }: ThrottleBarProps) {
  const down = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onHold()
    },
    [onHold],
  )
  const up = useCallback(() => onRelease(), [onRelease])
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
    <div className="controls">
      <div className="wrap controls-inner">
        <div className="readouts">
          {readouts.map((r) => (
            <div className="readout" key={r.unit}>
              <span className={`v num ${r.accent ? 'yellow' : ''}`}>{r.value}</span>
              <span className="u">{r.unit}</span>
            </div>
          ))}
        </div>
        <div>
          <label className="sr" htmlFor="rpm-slider">
            {sliderLabel}
          </label>
          <input id="rpm-slider" className="range" type="range" min={minRpm} max={maxRpm} step={10} value={Math.round(rpm)} onChange={(e) => onRpm(+e.target.value)} />
        </div>
        <button
          type="button"
          className={`btn ${holding ? 'is-on' : ''}`}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
          onKeyDown={key}
          onKeyUp={up}
          onBlur={up}
          aria-pressed={holding}
        >
          {holdLabel}
        </button>
      </div>
    </div>
  )
}
