import { AmbientLight, DirectionalLight, OrthographicCamera, Scene, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { buildZ } from './ZScene'

/**
 * Renders the real model once, side-on, to a transparent PNG for use as a
 * small glyph in SVG diagrams (the race lanes). One offscreen render per page
 * load, shared by every consumer. Resolves to null when WebGL is unavailable.
 */
let promise: Promise<string | null> | null = null

export function zSprite(url = '/models/z.glb'): Promise<string | null> {
  if (promise) return promise
  promise = new Promise((resolve) => {
    let renderer: WebGLRenderer | null = null
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    } catch {
      resolve(null)
      return
    }
    const W = 1000
    const H = 400
    renderer.setSize(W, H, false)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
      url,
      (gltf) => {
        const scene = new Scene()
        const { root } = buildZ(gltf.scene, { value: 1.0 })
        scene.add(root)
        scene.add(new AmbientLight('#f1e6cf', 0.15))
        const key = new DirectionalLight('#fff1d6', 0.8)
        key.position.set(-6, 8, 4)
        scene.add(key)
        const fill = new DirectionalLight('#9bb6ff', 0.5)
        fill.position.set(8, 3, -6)
        scene.add(fill)
        // side view, nose to the right: look along +x from the left
        const half = 2.5
        const cam = new OrthographicCamera(-half, half, half * (H / W), -half * (H / W), 0.1, 50)
        cam.position.set(-20, 0.75, 0)
        cam.lookAt(0, 0.75, 0)
        renderer!.render(scene, cam)
        const data = renderer!.domElement.toDataURL('image/png')
        renderer!.dispose()
        resolve(data)
      },
      undefined,
      () => {
        renderer?.dispose()
        resolve(null)
      },
    )
  })
  return promise
}
