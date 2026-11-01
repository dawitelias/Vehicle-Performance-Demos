/** Fixed background layers: dashed geometry, vignette, animated film grain. */
export function Ground() {
  return (
    <>
      <svg className="geometry" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g stroke="#6f6c5c" strokeWidth="0.6" fill="none" strokeDasharray="3 8" opacity="0.5">
          <path d="M-100 700 L1500 140" />
          <path d="M-100 860 L1500 300" />
          <path d="M-100 560 L1500 0" />
          <path d="M260 -60 L640 960" />
          <path d="M880 -60 L1260 960" />
        </g>
        <g fill="#8a8773" opacity="0.5">
          <rect x="200" y="140" width="3" height="3" />
          <rect x="1130" y="96" width="3" height="3" />
          <rect x="1250" y="720" width="3" height="3" />
          <rect x="110" y="790" width="3" height="3" />
          <rect x="700" y="450" width="3" height="3" />
        </g>
      </svg>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}
