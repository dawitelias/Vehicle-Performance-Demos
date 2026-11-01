import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Figure } from '../Figure'
import { Stage } from '../gl/Stage'
import { Car } from '../gl/car'

/** The car, turning slowly until the reader drags it. */
function HeroScene({ yaw }: { yaw: React.RefObject<number> }) {
  const root = useRef<Group>(null)
  const idle = useRef(true)
  const last = useRef(yaw.current)
  useFrame((_, dt) => {
    if (yaw.current !== last.current) idle.current = false
    if (idle.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) yaw.current += dt * 0.12
    last.current = yaw.current
    if (root.current) root.current.rotation.y += (yaw.current - root.current.rotation.y) * 0.15
  })
  return (
    <Stage camera={[-5.6, 1.5, 4.6]} target={[0, 0.55, 0]} fov={28} shadowScale={7}>
      <group ref={root} rotation-y={-0.5}>
        <Suspense fallback={null}>
          <Car detail="full" />
        </Suspense>
      </group>
    </Stage>
  )
}

export function HeroCarFigure() {
  const yaw = useRef(-0.5)
  return <Figure label="The 2024 Nissan Z, which you can turn by dragging" yaw={yaw} aspect={16 / 8} phoneAspect={4 / 3} wide scene={<HeroScene yaw={yaw} />} />
}
