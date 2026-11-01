import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'
import { NeutralToneMapping } from 'three'

/**
 * One WebGL canvas for the whole article, fixed behind the page. Every figure
 * renders into its own <View>, which draws its scene into the rectangle of a
 * DOM element with the scissor test. One context, one renderer, any number of
 * figures, and figures scrolled out of sight cost nothing.
 */
export function GLHost() {
  return (
    <Canvas
      className="gl-host"
      eventSource={document.getElementById('root') ?? undefined}
      eventPrefix="client"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping, toneMappingExposure: 1 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      <View.Port />
    </Canvas>
  )
}
