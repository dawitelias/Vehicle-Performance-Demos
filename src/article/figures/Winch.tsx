import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial, type Group, type Mesh } from 'three'
import { Figure, Slider, Readouts } from '../Figure'
import { Stage, useYaw } from '../gl/Stage'
import { ForceArrow, TorqueArrow } from '../gl/Arrows'

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

const DRUM_R = 0.5 // ft
const DRUM_Y = 2.3
const DRUM_W = 1.1
const BOTTOM = 0.25 // lowest point of the weight's base
const SLOWDOWN = 150 // the animation runs this many times slower than the numbers

function WinchScene({ torque, rpm, yaw }: { torque: number; rpm: number; yaw: React.RefObject<number> }) {
  const root = useRef<Group>(null)
  const drum = useRef<Group>(null)
  const weight = useRef<Group>(null)
  const rope = useRef<Mesh>(null)
  const lift = useRef(0)
  const m = useMemo(
    () => ({
      steel: new MeshStandardMaterial({ color: new Color('#c9ccd2'), metalness: 0.55, roughness: 0.32, envMapIntensity: 1.5 }),
      frame: new MeshStandardMaterial({ color: new Color('#55585e'), metalness: 0.4, roughness: 0.6 }),
      rope: new MeshStandardMaterial({ color: new Color('#d9cfb8'), metalness: 0, roughness: 0.8 }),
      block: new MeshStandardMaterial({ color: new Color('#2b2c30'), metalness: 0.3, roughness: 0.55 }),
      band: new MeshStandardMaterial({ color: new Color('#f3d03e'), metalness: 0.2, roughness: 0.5 }),
    }),
    [],
  )
  useYaw(root, yaw)
  const lbs = torque / DRUM_R
  // a cube whose volume grows with the weight it represents
  const side = 0.22 + Math.cbrt(Math.max(lbs, 1) / 800) * 0.45
  const travel = DRUM_Y - DRUM_R - 0.35 - BOTTOM - side
  useFrame((_, dt) => {
    const omega = (rpm * 2 * Math.PI) / 60 / SLOWDOWN // rad/s on screen
    if (drum.current) drum.current.rotation.x -= omega * dt
    lift.current += omega * DRUM_R * dt
    if (lift.current > travel) lift.current = 0
    const y = BOTTOM + lift.current
    if (weight.current) weight.current.position.y = y
    if (rope.current) {
      const top = DRUM_Y
      const bottom = y + side
      rope.current.scale.y = Math.max(0.001, top - bottom)
      rope.current.position.y = (top + bottom) / 2
    }
  })
  return (
    <Stage camera={[3.4, 2.6, 4.6]} target={[0, 1.35, 0]} fov={32} shadowScale={5}>
      <group ref={root}>
        {/* frame */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={m.frame} position={[sx * (DRUM_W / 2 + 0.12), DRUM_Y / 2, 0]}>
            <boxGeometry args={[0.08, DRUM_Y, 0.16]} />
          </mesh>
        ))}
        {/* drum, with a painted band so its rotation is visible */}
        <group ref={drum} position={[0, DRUM_Y, 0]}>
          <mesh material={m.steel} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[DRUM_R, DRUM_R, DRUM_W, 64]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={m.steel} rotation-z={Math.PI / 2} position-x={sx * (DRUM_W / 2)}>
              <cylinderGeometry args={[DRUM_R + 0.08, DRUM_R + 0.08, 0.04, 64]} />
            </mesh>
          ))}
          <mesh material={m.band} position={[0, 0, DRUM_R + 0.001]}>
            <boxGeometry args={[DRUM_W * 0.98, 0.06, 0.004]} />
          </mesh>
          <mesh material={m.band} position={[0, 0, -(DRUM_R + 0.001)]}>
            <boxGeometry args={[DRUM_W * 0.98, 0.06, 0.004]} />
          </mesh>
        </group>
        {/* rope from the front of the drum down to the weight */}
        <mesh ref={rope} material={m.rope} position={[0, 1, DRUM_R]}>
          <cylinderGeometry args={[0.018, 0.018, 1, 10]} />
        </mesh>
        <group ref={weight} position={[0, BOTTOM, DRUM_R]}>
          <mesh material={m.block} position-y={side / 2}>
            <boxGeometry args={[side, side, side]} />
          </mesh>
          <ForceArrow from={[0, side + 0.04, 0]} dir={[0, 1, 0]} length={Math.min(0.9, 0.1 + lbs / 1100)} radius={0.016} head={0.1} />
        </group>
        {/* torque on the drum, drawn around its axis at the near end */}
        <group position={[DRUM_W / 2 + 0.2, DRUM_Y, 0]} rotation-y={Math.PI / 2}>
          <TorqueArrow radius={DRUM_R + 0.12} from={-Math.PI * 0.25} to={-Math.PI * 0.25 + Math.min(Math.PI * 1.5, 0.6 + torque / 160)} thickness={0.008 + torque / 28000} />
        </group>
      </group>
    </Stage>
  )
}

export function WinchFigure() {
  const [torque, setTorque] = useState(200)
  const [rpm, setRpm] = useState(3000)
  const yaw = useRef(0)
  const lbs = torque / DRUM_R
  const speedFtS = (rpm * 2 * Math.PI * DRUM_R) / 60
  const hp = (torque * rpm) / 5252
  return (
    <Figure
      label="A winch drum lifting a weight on a rope"
      yaw={yaw}
      aspect={16 / 10}
      phoneAspect={1}
      scene={<WinchScene torque={torque} rpm={rpm} yaw={yaw} />}
      overlay={
        <Readouts
          items={[
            { label: 'Weight held', value: `${fmt(lbs)} lb` },
            { label: 'Rope speed', value: `${fmt(speedFtS)} ft/s` },
            { label: 'Power', value: `${fmt(hp)} hp`, accent: true },
          ]}
        />
      }
      controls={
        <>
          <Slider id="wi-torque" label="Torque on the drum" value={torque} min={0} max={400} step={5} onChange={setTorque} format={(v) => `${fmt(v)} lb-ft`} />
          <Slider id="wi-rpm" label="Drum speed" value={rpm} min={0} max={7000} step={50} onChange={setRpm} format={(v) => `${fmt(v)} rpm`} />
        </>
      }
      caption={
        <>
          The drum is 1 ft across, so it holds twice its torque in pounds. The animation runs {SLOWDOWN} times slower than the numbers.
        </>
      }
    />
  )
}
