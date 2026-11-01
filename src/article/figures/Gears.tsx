import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ExtrudeGeometry, MeshStandardMaterial, Path, Shape, type Group } from 'three'
import { Figure, Slider, Choice, Readouts } from '../Figure'
import { Stage, useYaw } from '../gl/Stage'
import { TorqueArrow } from '../gl/Arrows'
import { Z_ENGINE, NISSAN_6MT_RATIOS } from '../../sim/vehicles'
import { torqueAt } from '../../sim/engine'
import { hpFromTorqueRpm } from '../../sim/units'

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

/** Tooth counts whose ratio is close to each of the Z's six-speed ratios (the real box uses a countershaft; one pair shows the idea). */
const PAIRS: [number, number][] = [
  [11, 42], // 3.82 vs 3.794
  [15, 35], // 2.33 vs 2.324
  [16, 26], // 1.63 vs 1.624
  [18, 23], // 1.28 vs 1.271
  [20, 20], // 1.00
  [24, 19], // 0.79 vs 0.794
]
const MODULE = 0.05
const DEPTH = 0.22
const SLOWDOWN = 220

function gearGeometry(n: number) {
  const rp = (MODULE * n) / 2
  const ra = rp + MODULE
  const rr = rp - 1.25 * MODULE
  const p = (2 * Math.PI) / n
  const shape = new Shape()
  for (let i = 0; i < n; i++) {
    const a = i * p
    const pts: [number, number][] = [
      [rr, a - p / 2],
      [rr, a - p * 0.27],
      [ra, a - p * 0.13],
      [ra, a + p * 0.13],
      [rr, a + p * 0.27],
    ]
    pts.forEach(([r, t], k) => {
      const x = Math.cos(t) * r
      const y = Math.sin(t) * r
      if (i === 0 && k === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
  }
  shape.closePath()
  const bore = new Path()
  bore.absarc(0, 0, Math.max(0.05, rr * 0.22), 0, Math.PI * 2, true)
  shape.holes.push(bore)
  const g = new ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 })
  g.translate(0, 0, -DEPTH / 2)
  return g
}

function GearsScene({ gear, rpm, yaw, torqueIn }: { gear: number; rpm: number; yaw: React.RefObject<number>; torqueIn: number }) {
  const root = useRef<Group>(null)
  const pin = useRef<Group>(null)
  const out = useRef<Group>(null)
  const phi = useRef(0)
  useYaw(root, yaw)
  const [n1, n2] = PAIRS[gear - 1]
  const geos = useMemo(() => ({ a: gearGeometry(n1), b: gearGeometry(n2) }), [n1, n2])
  const m = useMemo(
    () => ({
      input: new MeshStandardMaterial({ color: new Color('#d6d9df'), metalness: 0.6, roughness: 0.3, envMapIntensity: 1.5 }),
      output: new MeshStandardMaterial({ color: new Color('#a9acb3'), metalness: 0.6, roughness: 0.34, envMapIntensity: 1.5 }),
      shaft: new MeshStandardMaterial({ color: new Color('#55585e'), metalness: 0.5, roughness: 0.5 }),
    }),
    [],
  )
  const c = (MODULE * (n1 + n2)) / 2
  const ratio = n2 / n1
  const torqueOut = torqueIn * ratio
  useFrame((_, dt) => {
    phi.current += ((rpm * 2 * Math.PI) / 60 / SLOWDOWN) * dt
    if (pin.current) pin.current.rotation.z = -phi.current
    if (out.current) out.current.rotation.z = (phi.current * n1) / n2 + Math.PI + Math.PI / n2
  })
  const r1 = (MODULE * n1) / 2
  const r2 = (MODULE * n2) / 2
  // centre the pair in view
  const cx = -c / 2 + (r1 - r2) / 2
  return (
    <Stage camera={[0.5, 0.6, 4.4]} target={[0, 0, 0]} fov={34} floor={false} shadow={false}>
      <group ref={root}>
        <group position={[cx, 0, 0]}>
          <group ref={pin}>
            <mesh geometry={geos.a} material={m.input} />
          </group>
          <mesh material={m.shaft} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.045, 0.045, 0.9, 20]} />
          </mesh>
          <group position={[0, 0, DEPTH / 2 + 0.1]}>
            <TorqueArrow radius={r1 + 0.16} from={Math.PI * 0.85} to={Math.PI * 0.85 - Math.min(Math.PI * 1.1, 0.4 + torqueIn / 900)} thickness={Math.min(0.022, 0.006 + torqueIn / 60000)} />
          </group>
          <group position={[c, 0, 0]}>
            <group ref={out}>
              <mesh geometry={geos.b} material={m.output} />
            </group>
            <mesh material={m.shaft} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.06, 0.06, 0.9, 20]} />
            </mesh>
            <group position={[0, 0, DEPTH / 2 + 0.1]}>
              <TorqueArrow radius={r2 + 0.16} from={Math.PI * 0.15} to={Math.PI * 0.15 + Math.min(Math.PI * 1.1, 0.4 + torqueOut / 900)} thickness={Math.min(0.022, 0.006 + torqueOut / 60000)} />
            </group>
          </group>
        </group>
      </group>
    </Stage>
  )
}

export function GearsFigure() {
  const [gear, setGear] = useState(1)
  const [rpm, setRpm] = useState(3000)
  const yaw = useRef(0)
  const torqueIn = torqueAt(Z_ENGINE.curve, rpm)
  const [n1, n2] = PAIRS[gear - 1]
  const ratio = n2 / n1
  const real = NISSAN_6MT_RATIOS[gear - 1]
  const hp = hpFromTorqueRpm(torqueIn, rpm)
  return (
    <Figure
      label="Two meshing gears, the smaller one driven by the engine"
      yaw={yaw}
      aspect={16 / 9}
      phoneAspect={1.1}
      scene={<GearsScene gear={gear} rpm={rpm} yaw={yaw} torqueIn={torqueIn} />}
      overlay={
        <>
          <Readouts corner="tl" title="From the engine" items={[{ label: 'Torque', value: `${fmt(torqueIn)} lb-ft` }, { label: 'Speed', value: `${fmt(rpm)} rpm` }, { label: 'Power', value: `${fmt(hp)} hp` }]} />
          <Readouts corner="tr" title="Out of the gearbox" items={[{ label: 'Torque', value: `${fmt(torqueIn * ratio)} lb-ft`, accent: true }, { label: 'Speed', value: `${fmt(rpm / ratio)} rpm` }, { label: 'Power', value: `${fmt(hp)} hp` }]} />
        </>
      }
      controls={
        <>
          <Choice label="Gear" value={gear} onChange={setGear} options={[1, 2, 3, 4, 5, 6].map((g) => ({ value: g, label: ['1st', '2nd', '3rd', '4th', '5th', '6th'][g - 1] }))} />
          <Slider id="ge-rpm" label="Engine speed" value={rpm} min={1000} max={6800} step={10} onChange={setRpm} format={(v) => `${fmt(v)} rpm`} />
        </>
      }
      caption={
        <>
          {n1} teeth driving {n2} gives {fmt(ratio, 2)} to 1, close to the Z's {fmt(real, 3)} for this gear. Friction is left out here; the real gearbox and differential lose about 8 percent. The animation runs {SLOWDOWN} times slower than the numbers.
        </>
      }
    />
  )
}
