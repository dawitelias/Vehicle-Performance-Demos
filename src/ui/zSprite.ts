import { NeutralToneMapping, Box3, OrthographicCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildZ } from './ZScene'
import { resolveModelUrl } from './modelUrl'

/**
 * Renders the real model side-on, once per page load, for the small cars in
 * the race diagrams: a body image with the wheels removed and a single wheel
 * image, so the diagram can turn the wheels as the car moves.
 *
 * All coordinates are in sprite pixels at PX_PER_M pixels per metre.
 */
export interface ZSprite {
  body: string
  wheel: string
  width: number
  height: number
  /** sprite-pixel x of the front bumper and y of the ground line */
  noseX: number
  groundY: number
  /** sprite-pixel centres of the two near-side wheels */
  wheels: { x: number; y: number }[]
  /** wheel image is a square of this many pixels, centred on the hub */
  wheelSize: number
}

const PX_PER_M = 220
const W = 1100
const H = 400

let promise: Promise<ZSprite | null> | null = null

export function zSprite(url?: string): Promise<ZSprite | null> {
  if (promise) return promise
  promise = (url ? Promise.resolve(url) : resolveModelUrl()).then(
    (modelUrl) =>
      new Promise<ZSprite | null>((resolve) => {
        let renderer: WebGLRenderer
        try {
          renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
        } catch {
          resolve(null)
          return
        }
        renderer.setPixelRatio(1)
        renderer.setClearColor(0x000000, 0)
        renderer.toneMapping = NeutralToneMapping
        new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
          modelUrl,
          (gltf) => {
            const scene = new Scene()
            const pmrem = new PMREMGenerator(renderer)
            scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
            const { root, wheels } = buildZ(gltf.scene)
            scene.add(root)

            // camera on the car's left looking across it: nose (+z) points right
            const halfW = W / 2 / PX_PER_M
            const halfH = H / 2 / PX_PER_M
            const midY = halfH - 0.25 // ground sits 0.25 m above the bottom edge
            const cam = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 60)
            cam.position.set(-20, midY, 0)
            cam.lookAt(0, midY, 0)
            cam.updateMatrixWorld(true)
            const toPx = (p: Vector3) => {
              const v = p.clone().project(cam)
              return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H }
            }

            // body without wheels
            wheels.forEach((w) => (w.group.visible = false))
            renderer.setSize(W, H, false)
            renderer.render(scene, cam)
            const body = renderer.domElement.toDataURL('image/png')

            // the near-side wheels (x < 0 faces the camera) in world space
            const near = wheels
              .map((w) => ({ w, p: w.group.getWorldPosition(new Vector3()) }))
              .filter((o) => o.p.x < 0)
              .sort((a, b) => a.p.z - b.p.z)
            const centres = near.map((o) => toPx(o.p))

            // one wheel, alone, centred
            const wheelSize = 180
            const one = near[near.length - 1]
            wheels.forEach((w) => (w.group.visible = false))
            root.children.forEach((c) => (c.visible = false))
            one.w.group.visible = true
            const half = wheelSize / 2 / PX_PER_M
            const wcam = new OrthographicCamera(-half, half, half, -half, 0.1, 60)
            wcam.position.set(-20, one.p.y, one.p.z)
            wcam.lookAt(0, one.p.y, one.p.z)
            renderer.setSize(wheelSize, wheelSize, false)
            renderer.render(scene, wcam)
            const wheel = renderer.domElement.toDataURL('image/png')

            // front bumper and ground line, measured on the whole car
            root.children.forEach((c) => (c.visible = true))
            wheels.forEach((w) => (w.group.visible = true))
            const b = new Box3().setFromObject(root)
            const nose = toPx(new Vector3(0, 0, b.max.z))
            const ground = toPx(new Vector3(0, 0, 0))
            renderer.dispose()
            pmrem.dispose()
            resolve({ body, wheel, width: W, height: H, noseX: nose.x, groundY: ground.y, wheels: centres, wheelSize })
          },
          undefined,
          () => {
            renderer.dispose()
            resolve(null)
          },
        )
      }),
  )
  return promise
}
