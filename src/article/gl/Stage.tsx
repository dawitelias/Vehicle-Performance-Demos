import { useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, PerspectiveCamera } from '@react-three/drei'
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, type Group } from 'three'
import { studioEnvironment } from './env'

/** Shared look for every figure: studio reflections, a key light, a soft contact shadow and a fading floor grid. */
export function Stage({
  children,
  camera = [4, 2.4, 5],
  target = [0, 0.4, 0],
  fov = 30,
  floor = true,
  shadow = true,
  shadowScale = 6,
  floorSize = 20,
}: {
  children: ReactNode
  camera?: [number, number, number]
  target?: [number, number, number]
  fov?: number
  floor?: boolean
  shadow?: boolean
  shadowScale?: number
  floorSize?: number
}) {
  const { gl, scene, size } = useThree()
  // keep the subject's width in frame on narrow figures by widening the vertical field of view
  const aspect = size.width / Math.max(1, size.height)
  const REF = 1.8
  const effFov = aspect >= REF ? fov : Math.min(70, (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (REF / aspect)) * 180) / Math.PI)
  useLayoutEffect(() => {
    scene.environment = studioEnvironment(gl)
    scene.environmentIntensity = 1.2
  }, [gl, scene])
  return (
    <>
      <PerspectiveCamera makeDefault position={camera} fov={effFov} near={0.05} far={300} onUpdate={(c) => c.lookAt(...target)} />
      <hemisphereLight args={['#fff3e0', '#1a1a1e', 0.7]} />
      <directionalLight position={[-3, 5, 4]} intensity={1.8} color="#fff1dc" />
      <directionalLight position={[4, 2, -3]} intensity={0.6} color="#bcd0ff" />
      {children}
      {shadow && <ContactShadows position={[0, 0.001, 0]} opacity={0.7} scale={shadowScale} blur={2.2} far={2} resolution={256} frames={1} />}
      {floor && <FloorGrid size={floorSize} />}
    </>
  )
}

/** A hairline grid on the floor that fades out with distance, drawn in one shader pass. */
export function FloorGrid({ size = 20, cell = 0.5, offsetZ = 0 }: { size?: number; cell?: number; offsetZ?: number }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uCell: { value: cell }, uColor: { value: new Color('#8d8676') }, uRadius: { value: size * 0.42 }, uOffset: { value: offsetZ } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uCell; uniform vec3 uColor; uniform float uRadius; uniform float uOffset; varying vec3 vW;
          void main(){
            vec2 p = vec2(vW.x, vW.z + uOffset) / uCell;
            vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
            float line = 1.0 - min(min(g.x, g.y), 1.0);
            vec2 q = vec2(vW.x, vW.z + uOffset) / (uCell * 4.0);
            vec2 g2 = abs(fract(q - 0.5) - 0.5) / fwidth(q);
            float major = 1.0 - min(min(g2.x, g2.y), 1.0);
            float fade = 1.0 - smoothstep(uRadius * 0.35, uRadius, length(vW.xz));
            float a = (line * 0.10 + major * 0.18) * fade;
            gl_FragColor = vec4(uColor, a);
          }`,
      }),
    [cell, size, offsetZ],
  )
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.0005} material={mat}>
      <planeGeometry args={[size, size]} />
    </mesh>
  )
}

/** Turns a group with a horizontal drag on the figure, and eases it back toward rest when idle if `settle` is set. */
export function useYaw(group: React.RefObject<Group | null>, yaw: React.RefObject<number>) {
  useFrame(() => {
    if (group.current) group.current.rotation.y += (yaw.current - group.current.rotation.y) * 0.18
  })
}

/** Glow material for halos around force arrows: additive, soft, no depth write. */
export function haloMaterial(color: string, opacity: number) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(uColor, f * uOpacity); }`,
  })
}
