import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import {
  Box3,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  type Object3D,
} from 'three'
import { resolveModelUrl } from './modelUrl'

/**
 * The Z as a real model, lit the way the rest of the site is drawn: a near-black
 * body whose silhouette glows Ikazuchi yellow (a fresnel rim written into the
 * standard material), crease edges as thin yellow lines pushed above white so
 * bloom catches them, then bloom, chromatic aberration, film grain and a
 * vignette as GPU post-processing passes.
 *
 * Wheels are found by name, split into four by position, spin with `wheelAngle`
 * and slide outward with `exploded` (0..1) for the exploded hero.
 */
export interface ZSceneProps {
  wheelAngle?: number
  exploded?: number
  view?: 'hero' | 'side'
  autoRotate?: boolean
  labels?: { text: string; at: [number, number, number]; color?: string }[]
  className?: string
  url?: string
}

const YELLOW = new Color('#f2c230')
const SCALE = 100 // the Sketchfab file is in 1/100 units; this brings a 4.38 m car to 4.38 units

function patchRim(mat: MeshStandardMaterial, rim: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim
    shader.uniforms.uRimColor = { value: YELLOW }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float fr = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRimColor * fr * uRim;`,
      )
  }
  mat.customProgramCacheKey = () => 'rim'
}

export interface WheelGroup {
  group: Group
  center: Vector3
  side: 1 | -1
}

function splitWheels(mesh: Mesh): Mesh[] {
  // Split one merged wheel mesh into four by the sign of x and z of each triangle's centroid.
  const geo = mesh.geometry
  const pos = geo.attributes.position
  const index = geo.index
  if (!index) return [mesh]
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
    const cx = (a.x + b.x + c.x) / 3
    const cz = (a.z + b.z + c.z) / 3
    const k = (cx >= 0 ? 1 : 0) + (cz >= 0 ? 2 : 0)
    buckets[k].push(i0, i1, i2)
  }
  return buckets
    .filter((bk) => bk.length > 0)
    .map((bk) => {
      const g = new BufferGeometry()
      for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.attributes[name])
      g.setIndex(bk)
      g.computeBoundingBox()
      const m = new Mesh(g, mesh.material)
      m.position.copy(mesh.position)
      m.quaternion.copy(mesh.quaternion)
      m.scale.copy(mesh.scale)
      return m
    })
}


/** Builds the lit, edged, wheel-split Z from a loaded glTF scene. Shared by the live scene and the sprite renderer. */
export function buildZ(sceneIn: Object3D, rim: { value: number }): { root: Group; wheels: WheelGroup[] } {
    const gltf = { scene: sceneIn }

    const root = new Group()
    const scene = gltf.scene.clone(true)
    scene.updateMatrixWorld(true)
    const bodyMat = new MeshStandardMaterial({ color: new Color('#0a0a0b'), roughness: 0.6, metalness: 0.25 })
    const glassMat = new MeshStandardMaterial({ color: new Color('#0a0a0c'), roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.55 })
    const trimMat = new MeshStandardMaterial({ color: new Color('#141414'), roughness: 0.7, metalness: 0.2 })
    for (const m of [bodyMat, glassMat, trimMat]) patchRim(m, rim)
    const edgeMat = new LineBasicMaterial({ color: new Color(2.4, 1.75, 0.45), transparent: true, opacity: 0.45, toneMapped: false })
    const wheels: WheelGroup[] = []
    const meshes: Mesh[] = []
    scene.traverse((o: Object3D) => {
      if (o instanceof Mesh) meshes.push(o)
    })
    for (const m of meshes) {
      const name = m.name.toLowerCase()
      const world = m.matrixWorld.clone()
      if (name.includes('wheel')) {
        // bake the world transform, then split into four wheels
        const g = m.geometry.clone().applyMatrix4(world)
        const baked = new Mesh(g, trimMat)
        for (const part of splitWheels(baked)) {
          const center = indexedCenter(part.geometry)
          part.geometry = part.geometry.toNonIndexed()
          part.geometry.translate(-center.x, -center.y, -center.z)
          part.geometry.computeBoundingBox()
          part.material = trimMat
          const grp = new Group()
          grp.position.copy(center)
          grp.add(part)
          const edges = new LineSegments(new EdgesGeometry(part.geometry, 40), edgeMat)
          grp.add(edges)
          root.add(grp)
          wheels.push({ group: grp, center, side: center.x >= 0 ? 1 : -1 })
        }
        continue
      }
      const g = m.geometry.clone().applyMatrix4(world)
      const isGlass = name.includes('window')
      const isPaint = name.includes('paint') || name.includes('coloured') || name.includes('light') || name.includes('base')
      const mesh = new Mesh(g, isGlass ? glassMat : isPaint ? bodyMat : trimMat)
      root.add(mesh)
      if (isPaint || isGlass) root.add(new LineSegments(new EdgesGeometry(g, isGlass ? 50 : 32), edgeMat))
    }
    // normalise: scale to metres, sit on the ground, centre on x/z
    root.scale.setScalar(SCALE)
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root)
    const centre = box.getCenter(new Vector3())
    root.position.set(-centre.x, -box.min.y, -centre.z)
    return { root, wheels }
}

function indexedCenter(geo: BufferGeometry): Vector3 {
  const box = new Box3()
  const v = new Vector3()
  const pos = geo.attributes.position
  const idx = geo.index!
  for (let i = 0; i < idx.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, idx.getX(i)))
  return box.getCenter(new Vector3())
}

function Model({ wheelAngle = 0, exploded = 0, url = '/models/z.glb' }: { wheelAngle?: number; exploded?: number; url?: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => loader.setMeshoptDecoder(MeshoptDecoder))
  const rim = useMemo(() => ({ value: 0.45 }), [])
  const { root, wheels } = useMemo(() => buildZ(gltf.scene, rim), [gltf, rim])

  useFrame(() => {
    for (const w of wheels) {
      w.group.rotation.x = -wheelAngle
      w.group.position.x = w.center.x + (w.side * 0.75 * exploded) / SCALE
    }
  })

  return <primitive object={root} />
}

function CameraRig({ view }: { view: 'hero' | 'side' }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const cam = camera as unknown as { fov: number; updateProjectionMatrix: () => void }
    cam.fov = aspect < 1.4 ? 36 : 24
    cam.updateProjectionMatrix()
    const k = aspect < 1.4 ? 0.82 : 1
    if (view === 'side') camera.position.set(-7.6 * k, 1.15, 0.6)
    else camera.position.set(-5.2 * k, 1.7 * k, 5.6 * k)
    camera.lookAt(0, 0.55, 0)
  }, [camera, view, size.width, size.height])
  return null
}

function Effects() {
  const offset = useMemo(() => new Vector2(0.0011, 0.0007), [])
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={1.0} mipmapBlur radius={0.65} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.3} />
      <Noise opacity={0.22} premultiply blendFunction={BlendFunction.SCREEN} />
      <Vignette eskil={false} offset={0.28} darkness={0.85} />
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

export function ZScene({ wheelAngle = 0, exploded = 0, view = 'hero', autoRotate = true, labels, className, url, fallback }: ZSceneProps & { fallback: ReactNode }) {
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [resolved, setResolved] = useState<string | null>(url ?? null)
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
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // keep the WebGL canvas from running while off screen
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-off', !e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`zscene ${className ?? ''}`}>
      <Boundary fallback={fallback}>
        <Canvas dpr={[1, 1.5]} camera={{ fov: 24, near: 0.1, far: 100 }} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'} style={{ background: 'transparent' }}>
          <CameraRig view={view} />
          <ambientLight intensity={0.12} color="#f1e6cf" />
          <directionalLight position={[-6, 8, 4]} intensity={0.7} color="#fff1d6" />
          <directionalLight position={[8, 3, -6]} intensity={0.6} color="#9bb6ff" />
          <Suspense fallback={null}>
            {resolved && <Model wheelAngle={wheelAngle} exploded={exploded} url={resolved} />}
            {labels?.map((l, i) => (
              <Html key={l.text} position={l.at} center={false} distanceFactor={undefined} style={{ pointerEvents: 'none', opacity: Math.min(1, Math.max(0, (exploded - i * 0.25) / 0.35)), transition: 'opacity 120ms linear' }} zIndexRange={[2, 0]}>
                <span className="zlabel" style={{ color: l.color ?? '#9ea87a', borderColor: l.color ?? '#9ea87a' }}>
                  {l.text}
                </span>
              </Html>
            ))}
          </Suspense>
          <Effects />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.5} minPolarAngle={1.15} maxPolarAngle={1.5} target={[0, 0.55, 0]} />
        </Canvas>
      </Boundary>
    </div>
  )
}

export default ZScene
