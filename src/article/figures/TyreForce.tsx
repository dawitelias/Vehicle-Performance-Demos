import { Suspense, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshBasicMaterial, type Group, type Object3D } from 'three'
import { Figure, Slider, Choice, Readouts } from '../Figure'
import { Stage, useYaw } from '../gl/Stage'
import { ForceArrow, WARM } from '../gl/Arrows'
import { Car, useCarInfo } from '../gl/car'
import { nissanZ, simMassKg } from '../../sim/vehicles'
import { effectiveMassFactor, fullThrottleTorqueLbft, overallRatios, resistanceForce, rpmAtMph } from '../../sim/drivetrain'
import { G, mpsFromMph } from '../../sim/units'

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
const N_PER_LB = 4.4482
const LB_TO_LEN = 1 / 1500 // scene metres of arrow per pound of force

export interface TyreState {
  rpm: number
  inRange: boolean
  wheelTq: number // lb-ft
  push: number // lb, what the axle asks of the tyres
  grip: number // lb, what the rear tyres can take
  used: number // lb, what actually reaches the road
  drag: number // lb
  g: number
}

/** Full-throttle push, grip and acceleration for the Z at a road speed in a gear, following the simulator's model. */
export function tyreState(mph: number, gear: number): TyreState {
  const v = nissanZ
  const pt = v.powertrain
  if (pt.kind !== 'ice') throw new Error('ice only')
  const ratios = overallRatios(v)
  const rpm = rpmAtMph(v, mph, gear - 1)
  const inRange = rpm >= pt.engine.idleRpm && rpm <= pt.engine.limiterRpm
  const tq = inRange ? fullThrottleTorqueLbft(v, rpm) : 0
  const wheelTq = tq * ratios[gear - 1] * pt.efficiency
  const rFt = v.chassis.tireRadiusM / 0.3048
  const push = wheelTq / rFt
  const mass = simMassKg(v)
  const vMps = mpsFromMph(mph)
  const dragN = resistanceForce(v, vMps)
  const ch = v.chassis
  const rearStatic = mass * G * (1 - ch.frontWeightFraction)
  let a = 0
  let gripN = 0
  let usedN = 0
  for (let i = 0; i < 4; i++) {
    gripN = ch.mu * (rearStatic + (mass * ch.cgHeightM * a) / ch.wheelbaseM)
    const pushN = push * N_PER_LB
    const tractionLimited = pushN > gripN
    usedN = tractionLimited ? gripN : pushN
    a = tractionLimited ? (gripN - dragN) / mass : (pushN - dragN) / (mass * effectiveMassFactor(v, gear - 1))
  }
  return { rpm, inRange, wheelTq, push, grip: gripN / N_PER_LB, used: usedN / N_PER_LB, drag: dragN / N_PER_LB, g: a / G }
}

function TyreScene({ mph, gear, yaw }: { mph: number; gear: number; yaw: React.RefObject<number> }) {
  const root = useRef<Group>(null)
  useYaw(root, yaw)
  const info = useCarInfo('full')
  const st = tyreState(mph, gear)
  const angle = useRef(0)
  const marker = useMemo(() => new MeshBasicMaterial({ color: new Color(WARM), transparent: true, opacity: 0.6, toneMapped: false }), [])
  useFrame((_, dt) => {
    angle.current += (mpsFromMph(mph) / info.wheelR / 40) * dt
  })
  const spin = (_g: Group, wheels: Object3D[]) => {
    for (const w of wheels) w.rotation.x = angle.current
  }
  const x = -info.halfWidth - 0.18
  const pushLen = Math.min(st.push, 4200) * LB_TO_LEN
  const gripLen = st.grip * LB_TO_LEN
  return (
    <Stage camera={[-6.2, 1.15, 0.9]} target={[0, 0.62, 0.35]} fov={30} shadowScale={8}>
      <group ref={root}>
        <Car detail="full" onFrame={spin} />
        {/* push at the rear contact patch, and the grip limit as a tick */}
        <ForceArrow from={[x, 0.03, info.rearZ]} dir={[0, 0, 1]} length={pushLen} radius={0.02} head={0.16} />
        <mesh material={marker} position={[x, 0.12, info.rearZ + gripLen]}>
          <boxGeometry args={[0.02, 0.24, 0.02]} />
        </mesh>
        {/* drag and rolling resistance, pushing back at the nose */}
        <ForceArrow from={[x, 0.55, info.frontZ + 0.9]} dir={[0, 0, -1]} length={st.drag * LB_TO_LEN} radius={0.012} head={0.1} color={WARM} />
      </group>
    </Stage>
  )
}

const GEAR_NAMES = ['1st', '2nd', '3rd', '4th', '5th', '6th']

export function TyreForceFigure() {
  const [gear, setGear] = useState(3)
  const [mph, setMph] = useState(50)
  const yaw = useRef(0)
  const st = tyreState(mph, gear)
  const note = !st.inRange ? (st.rpm < 700 ? `In ${GEAR_NAMES[gear - 1]}, ${fmt(mph)} mph is below idle.` : `In ${GEAR_NAMES[gear - 1]}, ${fmt(mph)} mph is past the limiter.`) : null
  return (
    <Figure
      label="The Z side-on, with the push of the rear tyre on the road and the drag on the car"
      yaw={yaw}
      aspect={16 / 8}
      phoneAspect={4 / 3}
      scene={
        <Suspense fallback={null}>
          <TyreScene mph={mph} gear={gear} yaw={yaw} />
        </Suspense>
      }
      controls={
        <>
        <Readouts
          corner="inline"
          items={[
            { label: 'Engine', value: st.inRange ? `${fmt(st.rpm)} rpm` : `${fmt(st.rpm)} rpm, out of range` },
            { label: 'At the wheels', value: `${fmt(st.wheelTq)} lb-ft` },
            { label: 'Push', value: `${fmt(st.push)} lb`, accent: true },
            { label: 'Rear grip', value: `${fmt(st.grip)} lb` },
            { label: 'Drag', value: `${fmt(st.drag)} lb` },
            { label: 'Acceleration', value: `${fmt(st.g, 2)} g` },
          ]}
        />
          <Choice label="Gear" value={gear} onChange={setGear} options={[1, 2, 3, 4, 5, 6].map((g) => ({ value: g, label: GEAR_NAMES[g - 1] }))} />
          <Slider id="ty-mph" label="Road speed" value={mph} min={5} max={155} onChange={setMph} format={(v) => `${fmt(v)} mph`} />
        </>
      }
      caption={
        <>
          {note ?? (st.push > st.grip ? 'The axle asks for more push than the rear tyres can give, so a full-throttle run here spins them. ' : '')}The yellow arrow is the push of the rear tyres on the road at full throttle; the pale tick marks how much they can take before they spin. The pale arrow at the nose is drag and rolling resistance.
        </>
      }
    />
  )
}
