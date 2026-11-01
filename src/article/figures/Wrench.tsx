import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial, type Group } from 'three'
import { Figure, Slider, Choice, Readouts } from '../Figure'
import { Stage, useYaw } from '../gl/Stage'
import { ForceArrow, TorqueArrow } from '../gl/Arrows'

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

const steel = () => new MeshStandardMaterial({ color: new Color('#d8dbe1'), metalness: 0.55, roughness: 0.3, envMapIntensity: 1.6 })
const darkSteel = () => new MeshStandardMaterial({ color: new Color('#9a9da4'), metalness: 0.5, roughness: 0.4, envMapIntensity: 1.4 })
const flangeMat = () => new MeshStandardMaterial({ color: new Color('#5a5d63'), metalness: 0.4, roughness: 0.6, envMapIntensity: 1.2 })

const FORCE_SCALE = 0.008 // units of length per lb
const HANDLE = 1.6 // ft

function WrenchScene({ force, dist, free, yaw, angle }: { force: number; dist: number; free: boolean; yaw: React.RefObject<number>; angle: React.RefObject<number> }) {
  const root = useRef<Group>(null)
  const wrench = useRef<Group>(null)
  const m = useMemo(() => ({ steel: steel(), dark: darkSteel(), flange: flangeMat() }), [])
  useYaw(root, yaw)
  useFrame((_, dt) => {
    if (free && force > 0) angle.current += dt * 0.6
    if (wrench.current) wrench.current.rotation.z = -angle.current
  })
  const torque = force * dist
  return (
    <Stage camera={[0.8, 0.75, 2.25]} target={[0.62, -0.02, 0]} fov={34} floor={false} shadow={false}>
      <group ref={root}>
        {/* a round flange the bolt is threaded into */}
        <mesh material={m.flange} rotation-x={Math.PI / 2} position={[0, 0, -0.03]}>
          <cylinderGeometry args={[0.42, 0.42, 0.06, 64]} />
        </mesh>
        {/* bolt: shaft into the wall, hex head */}
        <mesh material={m.dark} rotation-x={Math.PI / 2} position={[0, 0, 0.04]}>
          <cylinderGeometry args={[0.055, 0.055, 0.12, 24]} />
        </mesh>
        <group ref={wrench}>
          <mesh material={m.steel} rotation-x={Math.PI / 2} rotation-y={Math.PI / 6} position={[0, 0, 0.13]}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 6]} />
          </mesh>
          {/* box-end ring and handle */}
          <mesh material={m.steel} position={[0, 0, 0.14]}>
            <torusGeometry args={[0.13, 0.04, 16, 48]} />
          </mesh>
          <mesh material={m.steel} position={[0.13 + HANDLE / 2, 0, 0.14]}>
            <boxGeometry args={[HANDLE, 0.085, 0.035]} />
          </mesh>
          {/* where the hand pushes */}
          <mesh material={m.dark} position={[dist, 0, 0.14]}>
            <boxGeometry args={[0.07, 0.11, 0.06]} />
          </mesh>
          <ForceArrow from={[dist, 0.06 + force * FORCE_SCALE, 0.14]} dir={[0, -1, 0]} length={force * FORCE_SCALE} radius={0.014} head={0.09} />
          {/* distance marker along the handle */}
          <ForceArrow from={[0, -0.16, 0.14]} dir={[1, 0, 0]} length={dist} radius={0.004} head={0.05} color="#f1e6cf" />
        </group>
        <group position={[0, 0, 0.26]}>
          <TorqueArrow radius={0.3} from={Math.PI * 0.8} to={Math.PI * 0.8 - Math.min(Math.PI * 1.6, 0.7 + torque / 80)} thickness={0.007 + torque / 26000} />
        </group>
      </group>
    </Stage>
  )
}

export function WrenchFigure() {
  const [force, setForce] = useState(50)
  const [dist, setDist] = useState(1)
  const [free, setFree] = useState<'seized' | 'free'>('seized')
  const yaw = useRef(0)
  const angle = useRef(0)
  const [turns, setTurns] = useState(0)
  const torque = force * dist
  // sample the turned angle a few times a second for the readout
  useEffect(() => {
    if (free !== 'free') return
    const id = window.setInterval(() => setTurns(angle.current / (Math.PI * 2)), 100)
    return () => window.clearInterval(id)
  }, [free])
  const work = torque * turns * Math.PI * 2
  return (
    <Figure
      label="A wrench on a bolt with a force pushing down on the handle"
      yaw={yaw}
      aspect={2}
      phoneAspect={4 / 3}
      scene={<WrenchScene force={force} dist={dist} free={free === 'free'} yaw={yaw} angle={angle} />}
      overlay={
        <Readouts
          items={[
            { label: 'Torque', value: `${fmt(torque)} lb-ft`, accent: true },
            ...(free === 'free' ? [{ label: 'Turned', value: `${fmt(turns, 2)} turns` }, { label: 'Work done', value: `${fmt(work)} ft-lb` }] : []),
          ]}
        />
      }
      controls={
        <>
          <Slider id="wr-force" label="Push" value={force} min={0} max={120} onChange={setForce} format={(v) => `${fmt(v)} lb`} />
          <Slider id="wr-dist" label="Distance from the bolt" value={dist} min={0.2} max={1.6} step={0.05} onChange={setDist} format={(v) => `${fmt(v, 2)} ft`} />
          <Choice
            label="Bolt"
            value={free}
            onChange={(v) => {
              angle.current = 0
              setTurns(0)
              setFree(v)
            }}
            options={[
              { value: 'seized', label: 'Seized' },
              { value: 'free', label: 'Free to turn' },
            ]}
          />
        </>
      }
      caption={
        <>
          {fmt(force)} lb pushed at {fmt(dist, 2)} ft from the bolt gives {fmt(torque)} lb-ft. Drag the figure sideways to turn it.
        </>
      }
    />
  )
}
