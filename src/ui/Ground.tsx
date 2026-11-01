/** Fixed background layers: a skewed plane of hairlines, corner marks, vignette, dense film grain. */
export function Ground() {
  const rows = []
  for (let i = -4; i <= 18; i++) {
    const y0 = -300 + i * 90
    rows.push(<line key={`r${i}`} x1={-200} y1={y0} x2={1700} y2={y0 - 560} opacity={0.7} />)
  }
  const cols = []
  for (let k = -2; k < 18; k++) {
    const x = -200 + k * 120
    cols.push(<line key={`c${k}`} x1={x} y1={1000} x2={x + 330} y2={-100} opacity={0.45} />)
  }
  return (
    <>
      <svg className="geometry" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g stroke="#8d8676" strokeWidth="0.5" fill="none" opacity="0.26">
          {rows}
          {cols}
        </g>
        <g fill="#9a9382" opacity="0.55">
          <rect x="230" y="150" width="3.5" height="3.5" />
          <rect x="1180" y="120" width="3.5" height="3.5" />
          <rect x="1240" y="700" width="3.5" height="3.5" />
          <rect x="120" y="760" width="3.5" height="3.5" />
          <rect x="760" y="420" width="3.5" height="3.5" />
        </g>
      </svg>
      <div className="frame" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}
