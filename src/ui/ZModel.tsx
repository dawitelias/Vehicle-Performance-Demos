import { Suspense, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Center, OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh } from 'three'

/**
 * A glTF model of the Z rendered only as its edges, in Ikazuchi yellow, so a
 * real 3D model reads like the hand-drawn contour lines elsewhere on the site.
 * Loaded lazily; the page only imports three.js when a model exists.
 */
function Edges({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url)
  const group = useMemo(() => {
    const g = new Group()
    gltf.scene.updateMatrixWorld(true)
    const mat = new LineBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.85 })
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh) {
        const edges = new EdgesGeometry(o.geometry, 24)
        const lines = new LineSegments(edges, mat)
        lines.applyMatrix4(o.matrixWorld)
        g.add(lines)
      }
    })
    return g
  }, [gltf])
  return (
    <Center>
      <primitive object={group} />
    </Center>
  )
}

export default function ZModel({ url = '/models/z.glb', className }: { url?: string; className?: string }) {
  return (
    <div className={className} style={{ width: '100%', aspectRatio: '1000 / 340', maxWidth: '100%' }}>
      <Canvas dpr={[1, 2]} camera={{ position: [6, 1.6, 4.5], fov: 28 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Suspense fallback={null}>
          <Edges url={url} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={1.1} maxPolarAngle={1.5} />
      </Canvas>
    </div>
  )
}
