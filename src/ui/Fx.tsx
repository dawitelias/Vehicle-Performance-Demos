/**
 * Shared SVG filters, rendered once near the root so any inline SVG can use
 * them by id:
 *   fx-forge  thin line with a soft bloom and a warm/cool colour fringe either side
 *   fx-hot    an overexposed highlight: wide bloom plus a tight one
 *   fx-glow   a plain soft glow
 */
export function Fx() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="fx-forge" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="bloom" />
          <feColorMatrix in="bloom" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0" result="bloom2" />
          <feOffset in="SourceGraphic" dx="-1.2" dy="0.3" result="l" />
          <feColorMatrix in="l" values="1 0 0 0 0.25  0 0.55 0 0 0  0 0 0.2 0 0  0 0 0 0.8 0" result="warm" />
          <feOffset in="SourceGraphic" dx="1.2" dy="-0.3" result="r" />
          <feColorMatrix in="r" values="0.2 0 0 0 0  0 0.5 0 0 0.1  0 0 1 0 0.4  0 0 0 0.8 0" result="cool" />
          <feMerge>
            <feMergeNode in="bloom2" />
            <feMergeNode in="warm" />
            <feMergeNode in="cool" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="fx-hot" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b2" />
          <feMerge>
            <feMergeNode in="b1" />
            <feMergeNode in="b1" />
            <feMergeNode in="b2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="fx-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}
