import { BoxGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, BackSide, Color, type Texture, type WebGLRenderer } from 'three'

/**
 * A procedural light box for reflections: a dark room with a long overhead
 * softbox, two side strips and a faint warm and cool card, baked once into a
 * prefiltered environment map and shared by every figure. Car-studio light
 * without loading an HDR file.
 */
const cache = new WeakMap<WebGLRenderer, Texture>()

export function studioEnvironment(gl: WebGLRenderer): Texture {
  const hit = cache.get(gl)
  if (hit) return hit
  const scene = new Scene()
  const room = new Mesh(new BoxGeometry(30, 14, 30), new MeshBasicMaterial({ color: new Color('#0b0b0c'), side: BackSide }))
  room.position.y = 5
  scene.add(room)
  const card = (w: number, h: number, color: string, intensity: number, x: number, y: number, z: number, rx: number, ry: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), side: 2 }))
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, 0)
    scene.add(m)
  }
  card(5, 16, '#fff6e8', 3.2, 0, 9, 0, Math.PI / 2, 0) // overhead softbox
  card(18, 0.9, '#ffffff', 2.6, -9, 2.2, 0, 0, Math.PI / 2) // left strip
  card(18, 0.9, '#ffffff', 2.6, 9, 2.2, 0, 0, -Math.PI / 2) // right strip
  card(18, 0.4, '#ffffff', 1.4, -9, 0.6, 0, 0, Math.PI / 2) // low left strip, for sills and wheels
  card(12, 3, '#cfd8ff', 0.9, 0, 3, 12, 0, Math.PI) // cool front card
  card(12, 3, '#ffd9a0', 0.7, 0, 3, -12, 0, 0) // warm rear card
  const pmrem = new PMREMGenerator(gl)
  const tex = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  scene.traverse((o) => {
    const m = o as Mesh
    m.geometry?.dispose()
    ;(m.material as MeshBasicMaterial | undefined)?.dispose?.()
  })
  cache.set(gl, tex)
  return tex
}
