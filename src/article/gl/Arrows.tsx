import { useMemo } from 'react'
import { Color, Curve, MeshBasicMaterial, Quaternion, TubeGeometry, Vector3 } from 'three'
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
}: {
  from: [number, number, number]
  dir: [number, number, number]
  length: number
  color?: string
  radius?: number
  head?: number
}) {
  const mats = useMemo(() => ({ core: glowMat(color), halo: haloMaterial(color, 0.35), halo2: haloMaterial(color, 0.1) }), [color])
  const q = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...dir).normalize()), [dir[0], dir[1], dir[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  if (length < 0.002) return null
  const headLen = Math.min(head, length * 0.6)
  const shaft = Math.max(0.0001, length - headLen)
  return (
    <group position={from} quaternion={q}>
      <mesh position-y={shaft / 2} material={mats.core}>
        <cylinderGeometry args={[radius, radius, shaft, 12]} />
      </mesh>
      <mesh position-y={shaft + headLen / 2} material={mats.core}>
        <coneGeometry args={[radius * 3, headLen, 20]} />
      </mesh>
      <mesh position-y={shaft / 2} material={mats.halo}>
        <cylinderGeometry args={[radius * 2, radius * 2, shaft, 16]} />
      </mesh>
      <mesh position-y={shaft / 2} material={mats.halo2}>
        <cylinderGeometry args={[radius * 3.6, radius * 3.6, shaft, 16]} />
      </mesh>
      <mesh position-y={shaft + headLen / 2} material={mats.halo}>
        <coneGeometry args={[radius * 4, headLen * 1.2, 20]} />
      </mesh>
    </group>
  )
}

class ArcCurve extends Curve<Vector3> {
  constructor(
    private r: number,
    private a0: number,
    private a1: number,
  ) {
    super()
  }
  getPoint(t: number, target = new Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t
    return target.set(Math.cos(a) * this.r, Math.sin(a) * this.r, 0)
  }
}

/**
 * A curved torque arrow in the local xy plane, around the local z axis: an arc
 * of radius `radius` from angle `from` to angle `to` (radians, counter-clockwise
 * positive), with the head at `to`. Place and orient it with a parent group.
 */
export function TorqueArrow({ radius = 0.5, from = 0, to = Math.PI, thickness = 0.022, color = YELLOW }: { radius?: number; from?: number; to?: number; thickness?: number; color?: string }) {
  const mats = useMemo(() => ({ core: glowMat(color), halo: haloMaterial(color, 0.35), halo2: haloMaterial(color, 0.1) }), [color])
  const dir = to >= from ? 1 : -1
  const headLen = Math.min(0.16, radius * 0.45, Math.abs(to - from) * radius * 0.5)
  // stop the tube where the head begins
  const headAngle = headLen / radius
  const tubeEnd = to - dir * headAngle
  const geos = useMemo(() => {
    const curve = new ArcCurve(radius, from, tubeEnd)
    const segs = Math.max(8, Math.round(Math.abs(tubeEnd - from) * 24))
    return {
      core: new TubeGeometry(curve, segs, thickness, 10, false),
      halo: new TubeGeometry(curve, segs, thickness * 2, 10, false),
      halo2: new TubeGeometry(curve, segs, thickness * 3.6, 10, false),
    }
  }, [radius, from, tubeEnd, thickness])
  if (Math.abs(to - from) < 0.02) return null
  // head sits at the end of the tube, pointing along the tangent
  const hx = Math.cos(tubeEnd) * radius
  const hy = Math.sin(tubeEnd) * radius
  const tangent = new Vector3(-Math.sin(tubeEnd) * dir, Math.cos(tubeEnd) * dir, 0)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tangent)
  return (
    <group>
      <mesh geometry={geos.core} material={mats.core} />
      <mesh geometry={geos.halo} material={mats.halo} />
      <mesh geometry={geos.halo2} material={mats.halo2} />
      <group position={[hx, hy, 0]} quaternion={q}>
        <mesh position-y={headLen / 2} material={mats.core}>
          <coneGeometry args={[thickness * 3.2, headLen, 20]} />
        </mesh>
        <mesh position-y={headLen / 2} material={mats.halo}>
          <coneGeometry args={[thickness * 5.5, headLen * 1.3, 20]} />
        </mesh>
      </group>
    </group>
  )
}
