import { useMemo, useRef, useState } from 'react'
import { Color, MeshStandardMaterial, type Group } from 'three'
import { Figure, Slider, Readouts } from '../Figure'
import { Stage, useYaw } from '../gl/Stage'
import { ForceArrow, TorqueArrow, WARM } from '../gl/Arrows'

/**
 * One cylinder of the VR30DDTT, simplified: bore and stroke 86 mm, a 145 mm
 * connecting rod, compression ratio 10.3. Drawn at 10 units per metre.
 *
 * Cylinder pressure on the power stroke is a simple model: it peaks 15° after
 * top dead centre at a value that grows with boost, then falls as the gas
 * expands (pV^1.3 constant). Torque on the crank is the force on the piston
 * times the effective lever, r·sin(θ+β)/cos(β), where β is the rod's angle.
 */
const R = 0.043 // crank radius, m (half the 86 mm stroke)
const L = 0.145 // rod length, m
const BORE = 0.086
const AREA = Math.PI * (BORE / 2) ** 2
const CR = 10.3
const VC = (AREA * 2 * R) / (CR - 1)
const S = 10 // scene units per metre
const BAR = 1e5
const NM_PER_LBFT = 1.3558
const N_PER_LB = 4.4482

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

function kinematics(theta: number) {
  const sinB = (R / L) * Math.sin(theta)
  const beta = Math.asin(sinB)
  const pinY = R * Math.cos(theta) + Math.sqrt(L * L - R * R * Math.sin(theta) ** 2) // piston pin above crank centre
  const drop = R + L - pinY // piston travel from top dead centre
  const lever = (R * Math.sin(theta + beta)) / Math.cos(beta) // effective wrench length
  return { beta, pinY, drop, lever }
}

export function cylinderPressureBar(theta: number, boostBar: number) {
  const peak = 48 * (1 + boostBar) // bar, a simplified full-load figure
  const t15 = (15 * Math.PI) / 180
  if (theta <= t15) return peak * (0.72 + 0.28 * (theta / t15))
  const v15 = VC + AREA * kinematics(t15).drop
  const v = VC + AREA * kinematics(theta).drop
  return peak * Math.pow(v15 / v, 1.3)
}

function CrankScene({ theta, boost, yaw }: { theta: number; boost: number; yaw: React.RefObject<number> }) {
  const root = useRef<Group>(null)
  useYaw(root, yaw)
  const m = useMemo(
    () => ({
      steel: new MeshStandardMaterial({ color: new Color('#d3d6dc'), metalness: 0.55, roughness: 0.3, envMapIntensity: 1.5 }),
      dark: new MeshStandardMaterial({ color: new Color('#6d7077'), metalness: 0.5, roughness: 0.45 }),
      glass: new MeshStandardMaterial({ color: new Color('#9aa3b5'), metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }),
      gas: new MeshStandardMaterial({ color: new Color('#ff9a3c'), emissive: new Color('#ff7a1a'), emissiveIntensity: 1, transparent: true, opacity: 0.5, depthWrite: false }),
    }),
    [],
  )
  const k = kinematics(theta)
  const p = cylinderPressureBar(theta, boost)
  const force = Math.max(0, p - 1) * BAR * AREA // N
  const torque = force * k.lever // N·m
  const pinX = R * Math.sin(theta) * S
  const pinY = R * Math.cos(theta) * S
  const pistonY = k.pinY * S
  const rodLen = L * S
  const rodAngle = Math.atan2(pinX, pistonY - pinY) // from vertical
  const headY = (R + L) * S + 0.38 // cylinder head, above piston at top dead centre
  const pistonTop = pistonY + 0.3
  m.gas.emissiveIntensity = 0.2 + p / 60
  m.gas.opacity = 0.15 + Math.min(0.5, p / 200)
  // lever arm: the perpendicular from the crank centre to the line the rod pushes along
  const ux = -pinX / rodLen
  const uy = (pistonY - pinY) / rodLen
  const along = pinX * ux + pinY * uy
  const fx = pinX - along * ux
  const fy = pinY - along * uy
  const leverLen = Math.hypot(fx, fy)
  return (
    <Stage camera={[2.0, 2.1, 3.9]} target={[0, 1.05, 0]} fov={34} floor={false} shadow={false}>
      <group ref={root}>
        {/* cylinder wall and head */}
        <mesh material={m.glass} position-y={(headY + pistonTop - 1.5) / 2 + 0.2}>
          <cylinderGeometry args={[(BORE / 2) * S + 0.03, (BORE / 2) * S + 0.03, headY - 0.6, 48, 1, true]} />
        </mesh>
        <mesh material={m.dark} position-y={headY + 0.06}>
          <cylinderGeometry args={[(BORE / 2) * S + 0.12, (BORE / 2) * S + 0.12, 0.12, 48]} />
        </mesh>
        {/* burning gas between head and piston */}
        <mesh material={m.gas} position-y={(headY + pistonTop) / 2}>
          <cylinderGeometry args={[(BORE / 2) * S - 0.01, (BORE / 2) * S - 0.01, Math.max(0.01, headY - pistonTop), 48]} />
        </mesh>
        {/* piston */}
        <mesh material={m.steel} position-y={pistonY + 0.1}>
          <cylinderGeometry args={[(BORE / 2) * S - 0.012, (BORE / 2) * S - 0.012, 0.4, 48]} />
        </mesh>
        {/* connecting rod */}
        <group position={[pinX / 2, (pistonY + pinY) / 2, 0.12]} rotation-z={rodAngle}>
          <mesh material={m.steel}>
            <boxGeometry args={[0.1, rodLen, 0.06]} />
          </mesh>
        </group>
        {/* crank: main journal, web and pin */}
        <mesh material={m.dark} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.16, 0.16, 0.5, 32]} />
        </mesh>
        <group rotation-z={-theta}>
          <mesh material={m.steel} position={[0, R * S * 0.5, 0.05]}>
            <boxGeometry args={[0.36, R * S + 0.36, 0.1]} />
          </mesh>
          <mesh material={m.steel} position={[0, R * S, 0.12]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.1, 0.1, 0.22, 24]} />
          </mesh>
        </group>
        {/* force on the piston, and torque on the crank */}
        <ForceArrow from={[0, pistonTop + 0.05 + Math.min(1.2, force / 40000), 0.55]} dir={[0, -1, 0]} length={Math.min(1.2, force / 40000)} radius={0.016} head={0.1} />
        <group position={[0, 0, 0.3]}>
          <TorqueArrow radius={0.72} from={Math.PI * 0.62} to={Math.PI * 0.62 - Math.min(Math.PI * 1.5, 0.15 + torque / 900)} thickness={0.008 + torque / 90000} />
        </group>
        {/* the effective lever: from the crank centre, square to the rod */}
        {leverLen > 0.01 && <ForceArrow from={[0, 0, 0.62]} dir={[fx / leverLen, fy / leverLen, 0]} length={leverLen} radius={0.01} head={0.07} color={WARM} />}
      </group>
    </Stage>
  )
}

export function CrankFigure() {
  const [angle, setAngle] = useState(30)
  const [boost, setBoost] = useState(0.8)
  const yaw = useRef(0)
  const theta = (angle * Math.PI) / 180
  const k = kinematics(theta)
  const p = cylinderPressureBar(theta, boost)
  const forceN = Math.max(0, p - 1) * BAR * AREA
  const torqueNm = forceN * k.lever
  return (
    <Figure
      label="A piston, connecting rod and crankshaft, with the force on the piston and the torque on the crank"
      yaw={yaw}
      aspect={16 / 11}
      phoneAspect={0.95}
      scene={<CrankScene theta={theta} boost={boost} yaw={yaw} />}
      overlay={
        <Readouts
          items={[
            { label: 'Pressure', value: `${fmt(p * 14.504)} psi` },
            { label: 'Push on piston', value: `${fmt(forceN / N_PER_LB)} lb` },
            { label: 'Lever', value: `${fmt((k.lever / 0.0254) * 1, 2)} in` },
            { label: 'Torque', value: `${fmt(torqueNm / NM_PER_LBFT)} lb-ft`, accent: true },
          ]}
        />
      }
      controls={
        <>
          <Slider id="cr-angle" label="Crank angle after the top" value={angle} min={0} max={180} onChange={setAngle} format={(v) => `${fmt(v)}°`} />
          <Slider id="cr-boost" label="Boost" value={boost} min={0} max={1.2} step={0.05} onChange={setBoost} format={(v) => `${fmt(v * 14.504)} psi`} />
        </>
      }
      caption={<>One cylinder during its power stroke, with a simplified pressure model. The white arrow is the effective lever: the distance from the crank's centre to the line the rod pushes along. Each cylinder only pushes for part of the cycle, so its brief peaks average out with the other five to the steady figure a dyno reports.</>}
    />
  )
}
