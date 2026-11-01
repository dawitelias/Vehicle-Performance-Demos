import { useMemo } from 'react'
import { Color, MeshBasicMaterial, Quaternion, TorusGeometry, Vector3 } from 'three'
import { haloMaterial } from './Stage'

export const YELLOW = '#f2c230'
export const WARM = '#f1e6cf'

function glowMat(color: string) {
  // brighter than white so it reads as light, not paint
  return new MeshBasicMaterial({ color: new Color(color).multiplyScalar(1.6), toneMapped: false })
}

/**
 * A straight force arrow from `from` along `dir`, `length` long. Thin and
 * bright, with a soft additive halo so it reads as glowing without a bloom pass.
 */
export function ForceArrow({
  from,
  dir,
  length,
  color = YELLOW,
  radius = 0.025,
  head = 0.14,
  opacity = 1,
}: {
  from: [number, number, number]
  dir: [number, number, number]
  length: number
  color?: string
  radius?: number
  head?: number
  opacity?: number
}) {
  const mats = useMemo(() => ({ core: glowMat(color), halo: haloMaterial(color, 0.5), halo2: haloMaterial(color, 0.18) }), [color])
  const q = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...dir).normalize()), [dir])
  const L = Math.max(0.0001, length)
  const headLen = Math.min(head, L * 0.6)
  const shaft = Math.max(0.0001, L - headLen)
  if (length < 0.002) return null
  return (
    <group position={from} quaternion={q} visible={opacity > 0.01}>
      <mesh position-y={shaft / 2} material={mats.core}>
        <cylinderGeometry args={[radius, radius, shaft, 12]} />
      </mesh>
      <mesh position-y={shaft + headLen / 2} material={mats.core}>
        <coneGeometry args={[radius * 3, headLen, 20]} />
      </mesh>
      <mesh position-y={shaft / 2} material={mats.halo}>
        <cylinderGeometry args={[radius * 2.6, radius * 2.6, shaft, 16]} />
      </mesh>
      <mesh position-y={shaft / 2} material={mats.halo2}>
        <cylinderGeometry args={[radius * 5, radius * 5, shaft, 16]} />
      </mesh>
      <mesh position-y={shaft + headLen / 2} material={mats.halo}>
        <coneGeometry args={[radius * 5, headLen * 1.3, 20]} />
      </mesh>
    </group>
  )
}

/**
 * A curved torque arrow around an axis: an arc of `sweep` radians at
 * `radius`, lying in the plane perpendicular to the group's local z axis.
 * Rotate the group to place the axis. Positive sweep turns counter-clockwise
 * when seen looking down -z.
 */
export function TorqueArrow({
  radius = 0.5,
  sweep = Math.PI * 1.2,
  start = 0,
  thickness = 0.022,
  color = YELLOW,
}: {
  radius?: number
  sweep?: number
  start?: number
  thickness?: number
  color?: string
}) {
  const mats = useMemo(() => ({ core: glowMat(color), halo: haloMaterial(color, 0.5), halo2: haloMaterial(color, 0.18) }), [color])
  const s = Math.max(0.05, Math.abs(sweep))
  const sign = sweep < 0 ? -1 : 1
  const arc = useMemo(() => new TorusGeometry(radius, thickness, 10, 64, s), [radius, thickness, s])
  const halo = useMemo(() => new TorusGeometry(radius, thickness * 2.6, 10, 64, s), [radius, thickness, s])
  const halo2 = useMemo(() => new TorusGeometry(radius, thickness * 5, 10, 64, s), [radius, thickness, s])
  const end = start + s
  const hx = Math.cos(end) * radius
  const hy = Math.sin(end) * radius
  const headLen = Math.min(0.16, radius * 0.5)
  return (
    <group scale={[1, sign, 1]}>
      <group rotation-z={start}>
        <mesh geometry={arc} material={mats.core} />
        <mesh geometry={halo} material={mats.halo} />
        <mesh geometry={halo2} material={mats.halo2} />
      </group>
      <mesh position={[hx, hy, 0]} rotation-z={end} material={mats.core}>
        <coneGeometry args={[thickness * 3.2, headLen, 20]} />
      </mesh>
    </group>
  )
}
