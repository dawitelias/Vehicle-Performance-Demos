import type { ReactNode } from 'react'

export interface Readout {
  value: string
  unit: string
  accent?: boolean
}

/** The sticky strip at the bottom of a chapter: live readouts on top, controls below. */
export function ControlBar({ readouts, children }: { readouts: Readout[]; children: ReactNode }) {
  return (
    <div className="controls">
      <div className="wrap controls-inner">
        <div className="readouts">
          {readouts.map((r, i) => (
            <div className="readout" key={`${r.unit}${i}`}>
              <span className={`v num ${r.accent ? 'yellow' : ''}`}>{r.value}</span>
              <span className="u">{r.unit}</span>
            </div>
          ))}
        </div>
        <div className="controls-row">{children}</div>
      </div>
    </div>
  )
}
