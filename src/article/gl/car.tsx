import { use, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PlaneGeometry, Vector3, type Object3D } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { buildZ } from '../../ui/ZScene'

/**
 * The 2020 Z Proto model, loaded once per detail level and shared. Each
 * <Car> is a clone that shares geometry and materials with the original, so
 * five cars cost five sets of draw calls but one copy of the data. A car can
 * be repainted, and its wheels turn with `wheelAngle`.
 */
export interface CarInfo {
  root: Group
  length: number
  /** axle positions along the car (z, metres), and the wheel radius */
  frontZ: number
  rearZ: number
  wheelR: number
  halfWidth: number
}

const loads = new Map<string, Promise<CarInfo>>()

function loadCar(url: string) {
  let p = loads.get(url)
  if (!p) {
    p = new Promise<GLTF>((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, resolve, undefined, reject)).then((gltf) => {
      const { root, length } = buildZ(gltf.scene)
      root.updateMatrixWorld(true)
      const zs: number[] = []
      let wheelR = 0.34
      let halfWidth = 0.95
      root.traverse((o) => {
        if (o.name === 'wheel') {
          const p = o.getWorldPosition(new Vector3())
          zs.push(p.z)
          halfWidth = Math.max(halfWidth, Math.abs(p.x))
          wheelR = p.y
        }
      })
      return { root, length, frontZ: Math.max(...zs), rearZ: Math.min(...zs), wheelR, halfWidth }
    })
    loads.set(url, p)
  }
  return p
}

export const CAR_URL = { full: '/models/z.glb', lite: '/models/z-lite.glb' }

/** Dimensions of the loaded model; suspends until it has loaded. */
export function useCarInfo(detail: 'full' | 'lite' = 'full'): CarInfo {
  return use(loadCar(CAR_URL[detail]))
}

/** A soft dark ellipse under the car, standing in for a contact shadow that would cost a render per car. */
let shadowTex: CanvasTexture | null = null
function shadowTexture() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 128, 10, 64, 128, 128)
  grd.addColorStop(0, 'rgba(0,0,0,0.85)')
  grd.addColorStop(0.55, 'rgba(0,0,0,0.5)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.save()
  g.scale(1, 1)
  g.fillRect(0, 0, 128, 256)
  g.restore()
  shadowTex = new CanvasTexture(c)
  return shadowTex
}

export function Car({
  detail = 'full',
  paint,
  wheelAngle = 0,
  position = [0, 0, 0],
  rotationY = 0,
  shadow = true,
  onFrame,
}: {
  detail?: 'full' | 'lite'
  paint?: string
  wheelAngle?: number
  position?: [number, number, number]
  rotationY?: number
  shadow?: boolean
  /** called every frame with the car's outer group and its wheels, for cars driven from a timeline */
  onFrame?: (group: Group, wheels: Object3D[]) => void
}) {
  const base = use(loadCar(CAR_URL[detail]))
  const { car, wheels } = useMemo(() => {
    const car = base.root.clone(true)
    const wheels: Object3D[] = []
    car.traverse((o) => {
      if (o.name === 'wheel') wheels.push(o)
    })
    return { car, wheels }
  }, [base])
  useLayoutEffect(() => {
    if (!paint) return
    car.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.name.includes('paint')) {
        const mat = (m.material as MeshPhysicalMaterial).clone()
        mat.color = new Color(paint)
        m.material = mat
      }
    })
  }, [car, paint])
  const shadowMat = useMemo(() => new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false }), [])
  const shadowGeo = useMemo(() => new PlaneGeometry(2.3, base.length * 1.1), [base.length])
  const outer = useMemo(() => new Group(), [])
  // place the car from props only when nothing drives it frame by frame; otherwise a re-render would snap it back
  useLayoutEffect(() => {
    if (onFrame) return
    outer.position.set(...position)
    outer.rotation.y = rotationY
  }, [outer, onFrame, position[0], position[1], position[2], rotationY]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    if (onFrame) onFrame(outer, wheels)
    else for (const w of wheels) w.rotation.x = wheelAngle
  })
  return (
    <primitive object={outer}>
      <primitive object={car} />
      {shadow && <mesh geometry={shadowGeo} material={shadowMat} rotation-x={-Math.PI / 2} position-y={0.004} />}
    </primitive>
  )
}
