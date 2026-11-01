import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { Box3, BufferAttribute, BufferGeometry, Color, Group, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, Vector3, type Object3D } from 'three'
import { resolveModelUrl } from './modelUrl'

/**
 * The 2020 Z Proto model rendered as a studio shot: the model's own PBR
 * materials, the paint upgraded to a clear-coated Ikazuchi yellow, a
 * light-box environment for reflections, a contact shadow to ground it, and a
 * restrained post-processing stack (bloom on highlights only, AgX tone
 * mapping, faint chromatic aberration, film grain, vignette).
 *
 * The merged wheel mesh is split into four by position so each wheel turns on
 * its own axle with `wheelAngle` (radians, positive = rolling forward).
 */
export interface ZSceneProps {
  wheelAngle?: number
  view?: 'hero' | 'side'
  autoRotate?: boolean
  className?: string
  url?: string
}

export interface WheelGroup {
  group: Group
  center: Vector3
}

const SCALE = 100 // the Sketchfab file is authored in 1/100 units

/** Meshopt stores attributes as normalised integers; convert to floats before baking transforms so nothing is clamped or rounded. */
function dequantize(src: BufferGeometry): BufferGeometry {
  const geo = src.clone()
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name] as BufferAttribute
    if (a.array instanceof Float32Array && !a.normalized) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
    geo.setAttribute(name, new BufferAttribute(out, a.itemSize))
  }
  return geo
}

function indexedCenter(geo: BufferGeometry): Vector3 {
  const box = new Box3()
  const v = new Vector3()
  const pos = geo.attributes.position
  const idx = geo.index
  if (!idx) {
    geo.computeBoundingBox()
    return geo.boundingBox!.getCenter(new Vector3())
  }
  for (let i = 0; i < idx.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, idx.getX(i)))
  return box.getCenter(new Vector3())
}

/** Split one merged mesh holding four wheels into four meshes, by the sign of x and z of each triangle's centroid. */
function splitFour(geo: BufferGeometry): BufferGeometry[] {
  const pos = geo.attributes.position
  const index = geo.index
  if (!index) return [geo]
  const buckets: number[][] = [[], [], [], []]
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i)
    const i1 = index.getX(i + 1)
    const i2 = index.getX(i + 2)
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    const k = ((a.x + b.x + c.x) / 3 >= 0 ? 1 : 0) + ((a.z + b.z + c.z) / 3 >= 0 ? 2 : 0)
    buckets[k].push(i0, i1, i2)
  }
  return buckets
    .filter((bk) => bk.length > 0)
    .map((bk) => {
      const g = new BufferGeometry()
      for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.attributes[name])
      g.setIndex(bk)
      return g
    })
}

function upgradeMaterial(name: string, m: Material): Material {
  const std = m as MeshStandardMaterial
  if (name.includes('paint')) {
    return new MeshPhysicalMaterial({
      color: new Color('#f2c230'),
      metalness: 0.15,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1,
    })
  }
  if (name.includes('window') && std.transparent) {
    return new MeshPhysicalMaterial({ color: new Color('#05070a'), metalness: 0, roughness: 0.02, transparent: true, opacity: 0.55, envMapIntensity: 1.4, depthWrite: false })
  }
  const c = std.clone()
  c.envMapIntensity = 1
  return c
}

/** Builds the scene graph from a loaded glTF: baked transforms, upgraded paint and glass, four spinnable wheels, normalised to metres on the ground. */
export function buildZ(sceneIn: Object3D): { root: Group; wheels: WheelGroup[]; length: number } {
  const root = new Group()
  const scene = sceneIn.clone(true)
  scene.updateMatrixWorld(true)
  const wheels: WheelGroup[] = []
  const meshes: Mesh[] = []
  scene.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o)
  })
  for (const m of meshes) {
    const name = m.name.toLowerCase()
    const geo = dequantize(m.geometry).applyMatrix4(m.matrixWorld)
    const mat = upgradeMaterial(name, Array.isArray(m.material) ? m.material[0] : m.material)
    if (name.includes('wheel')) {
      for (const part of splitFour(geo)) {
        const center = indexedCenter(part)
        const g = part.toNonIndexed()
        g.translate(-center.x, -center.y, -center.z)
        const grp = new Group()
        grp.name = 'wheel'
        grp.position.copy(center)
        const mesh = new Mesh(g, mat)
        mesh.name = name
        mesh.castShadow = true
        grp.add(mesh)
        root.add(grp)
        wheels.push({ group: grp, center })
      }
      continue
    }
    const mesh = new Mesh(geo, mat)
    mesh.name = name
    mesh.renderOrder = name.includes('window') ? 2 : 0
    root.add(mesh)
  }
  root.scale.setScalar(SCALE)
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const centre = box.getCenter(new Vector3())
  root.position.set(-centre.x, -box.min.y, -centre.z)
  root.updateMatrixWorld(true)
  return { root, wheels, length: (box.max.z - box.min.z) }
}

function Model({ wheelAngle = 0, url }: { wheelAngle?: number; url: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => loader.setMeshoptDecoder(MeshoptDecoder))
  const { root, wheels } = useMemo(() => buildZ(gltf.scene), [gltf])
  useFrame(() => {
    for (const w of wheels) w.group.rotation.x = wheelAngle
  })
  return <primitive object={root} />
}

function CameraRig({ view }: { view: 'hero' | 'side' }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const cam = camera as unknown as { fov: number; updateProjectionMatrix: () => void }
    cam.fov = aspect < 1.4 ? 34 : 26
    cam.updateProjectionMatrix()
    const k = aspect < 1.4 ? 0.92 : 0.82
    if (view === 'side') camera.position.set(-8.2 * k, 0.85, 0.15)
    else camera.position.set(-5.4 * k, 1.3 * k, 5.2 * k)
    camera.lookAt(0, 0.6, 0)
  }, [camera, view, size.width, size.height])
  return null
}

/** Car-studio lighting: a long overhead softbox and two side strips, rendered once into the environment map. */
function Studio() {
  return (
    <Environment resolution={512} frames={1} environmentIntensity={1.5}>
      <Lightformer form="rect" intensity={2.4} color="#fff6e8" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[4, 12, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-6, 1.6, 0]} rotation-y={Math.PI / 2} scale={[14, 0.6, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[-6, 0.4, 0]} rotation-y={Math.PI / 2} scale={[14, 0.3, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[6, 1.6, 0]} rotation-y={-Math.PI / 2} scale={[14, 0.5, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#cfd8ff" position={[0, 2, 8]} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffd9a0" position={[0, 2, -8]} rotation-y={Math.PI} scale={[10, 2, 1]} />
    </Environment>
  )
}

function Effects({ high }: { high: boolean }) {
  const offset = useMemo(() => new Vector2(0.0006, 0.0004), [])
  return (
    <EffectComposer multisampling={high ? 4 : 0}>
      <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.1} intensity={0.55} mipmapBlur radius={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.45} />
      <Noise opacity={0.07} premultiply blendFunction={BlendFunction.SCREEN} />
      <Vignette eskil={false} offset={0.3} darkness={0.6} />
    </EffectComposer>
  )
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function ZScene({ wheelAngle = 0, view = 'hero', autoRotate = true, className, url, fallback }: ZSceneProps & { fallback: ReactNode }) {
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [resolved, setResolved] = useState<string | null>(url ?? null)
  const [visible, setVisible] = useState(true)
  // Start at full quality; drop multisampling and pixel ratio if the device can't hold a steady frame rate.
  const [high, setHigh] = useState(() => !new URLSearchParams(window.location.search).has('lowfx'))
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (url) return
    let live = true
    resolveModelUrl().then((u) => {
      if (live) setResolved(u)
    })
    return () => {
      live = false
    }
  }, [url])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`zscene ${className ?? ''}`}>
      <Boundary fallback={fallback}>
        <Canvas
          flat
          shadows={false}
          dpr={high ? [1, 2] : 1}
          camera={{ fov: 26, near: 0.1, far: 100 }}
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          frameloop={visible ? 'always' : 'never'}
          style={{ background: 'transparent' }}
        >
          <PerformanceMonitor onDecline={() => setHigh(false)} flipflops={1} />
          <CameraRig view={view} />
          <Studio />
          <Suspense fallback={null}>
            {resolved && <Model wheelAngle={wheelAngle} url={resolved} />}
            <ContactShadows position={[0, 0.001, 0]} opacity={0.75} scale={9} blur={2.4} far={1.6} resolution={512} frames={1} color="#000000" />
          </Suspense>
          <Effects high={high} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.35} minPolarAngle={1.2} maxPolarAngle={1.5} target={[0, 0.6, 0]} enableRotate={view === 'hero'} />
        </Canvas>
      </Boundary>
    </div>
  )
}

export default ZScene
