import { memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DoubleSide, ShaderMaterial, Vector3, type Group, type Object3D, type PerspectiveCamera } from 'three'
import { Figure } from '../Figure'
import { Stage } from '../gl/Stage'
import { Car } from '../gl/car'
import { createRun, type SimOptions } from '../../sim/longitudinal'
import type { Vehicle } from '../../sim/vehicles'
import { mphFromMps } from '../../sim/units'

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

export interface Racer {
  id: string
  label: string
  vehicle: Vehicle
  options?: SimOptions
  paint: string
}

interface Trace {
  t: Float32Array
  x: Float32Array
  v: Float32Array
  rpm: Float32Array
  gear: Uint8Array
  finish: number | null
  ice: boolean
}

const STEP = 0.005
const SAMPLE = 0.02

/** Runs a car at full throttle until it reaches `finishMph`, then lets it coast on at that speed so gaps stay physical. */
function simulateTrace(r: Racer, finishMph: number, endT: number): Trace {
  const run = createRun(r.vehicle, { dt: STEP, ...r.options })
  const n = Math.ceil(endT / SAMPLE) + 1
  const tr: Trace = { t: new Float32Array(n), x: new Float32Array(n), v: new Float32Array(n), rpm: new Float32Array(n), gear: new Uint8Array(n), finish: null, ice: r.vehicle.powertrain.kind === 'ice' }
  let t = 0
  let k = 0
  let cruising = false
  let x = 0
  let v = run.state.v
  const per = Math.round(SAMPLE / STEP)
  for (let i = 0; k < n; i++) {
    if (i % per === 0) {
      tr.t[k] = t
      tr.x[k] = cruising ? x : run.state.x
      tr.v[k] = cruising ? v : run.state.v
      tr.rpm[k] = run.state.rpm
      tr.gear[k] = run.state.gear
      k++
    }
    if (!cruising) {
      run.step(STEP, { throttle: 1 })
      if (mphFromMps(run.state.v) >= finishMph) {
        tr.finish = run.state.t
        cruising = true
        x = run.state.x
        v = run.state.v
      }
    } else {
      x += v * STEP
    }
    t += STEP
  }
  return tr
}

function sample(tr: Trace, t: number) {
  const f = Math.min(tr.t.length - 1.001, Math.max(0, t / SAMPLE))
  const i = Math.floor(f)
  const u = f - i
  const lerp = (a: ArrayLike<number>) => a[i] + (a[i + 1] - a[i]) * u
  return { x: lerp(tr.x), v: lerp(tr.v), rpm: lerp(tr.rpm), gear: tr.gear[Math.round(f)] }
}

const LANE = 3.6

/** A floor that slides under the cars: world-anchored grid lines every 5 m with a stronger line every 50 m, faded around the camera's focus. */
function Road({ focus }: { focus: React.RefObject<number> }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uColor: { value: new Color('#8d8676') }, uFocus: { value: 0 } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uFocus; varying vec3 vW;
          float grid(vec2 p, float cell){ vec2 q = p / cell; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y), 1.0); }
          void main(){
            float a = grid(vW.xz, 5.0) * 0.10 + grid(vec2(0.0, vW.z), 50.0) * 0.35;
            float fade = 1.0 - smoothstep(18.0, 60.0, abs(vW.z - uFocus));
            gl_FragColor = vec4(uColor, a * fade);
          }`,
      }),
    [],
  )
  const mesh = useRef<Group>(null)
  useFrame(() => {
    mat.uniforms.uFocus.value = focus.current
    if (mesh.current) mesh.current.position.z = focus.current
  })
  return (
    <group ref={mesh}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} material={mat}>
        <planeGeometry args={[60, 140]} />
      </mesh>
    </group>
  )
}

const RaceScene = memo(function RaceScene({ racers, traces, time }: { racers: Racer[]; traces: Trace[]; time: React.RefObject<number> }) {
  const focus = useRef(0)
  const { camera } = useThree()
  const lanes = racers.length
  const width = (lanes - 1) * LANE
  const target = useMemo(() => new Vector3(), [])
  useFrame(() => {
    const xs = traces.map((tr) => sample(tr, time.current).x)
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    // frame the whole field when it fits; past that, keep the leader in view and let the slowest leave the frame (the table keeps their gap)
    const MAX_SPAN = 50
    const spread = hi - lo
    const span = Math.min(MAX_SPAN, Math.max(20, spread + 14))
    // when the field is too long to show, follow the first car (your Z) instead of the leader
    const centre = spread + 14 <= MAX_SPAN ? (lo + hi) / 2 : xs[0]
    focus.current = centre
    const cam = camera as PerspectiveCamera
    const vfov = (cam.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect)
    const dist = span / 2 / Math.tan(hfov / 2)
    const elev = 0.44
    cam.position.set(width / 2 - dist * Math.cos(elev), 0.6 + dist * Math.sin(elev), focus.current - dist * 0.08)
    target.set(width / 2, 0.6, focus.current)
    cam.lookAt(target)
  })
  return (
    <Stage camera={[-12, 4, -6]} target={[0, 0.5, 0]} fov={26} floor={false} shadow={false}>
      <Road focus={focus} />
      <Suspense fallback={null}>
        {racers.map((r, i) => (
          <Car
            key={r.id}
            detail="lite"
            paint={r.paint}
            onFrame={(g: Group, wheels: Object3D[]) => {
              const s = sample(traces[i], time.current)
              g.position.set(i * LANE, 0, s.x)
              for (const w of wheels) w.rotation.x = s.x / 0.327
            }}
          />
        ))}
      </Suspense>
    </Stage>
  )
})

export function RaceFigure({
  racers,
  finishMph,
  label,
  caption,
  maxT = 30,
  rows,
  children,
}: {
  racers: Racer[]
  finishMph: number
  label: string
  caption?: ReactNode
  maxT?: number
  /** extra columns for the results table */
  rows?: (r: Racer, finish: number | null) => ReactNode
  children?: ReactNode
}) {
  const traces = useMemo(() => {
    const raw = racers.map((r) => simulateTrace(r, finishMph, maxT))
    return raw
  }, [racers, finishMph, maxT])
  const endT = useMemo(() => Math.min(maxT, Math.max(...traces.map((t) => t.finish ?? maxT)) + 0.8), [traces, maxT])
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const time = useRef(0)
  time.current = t
  useEffect(() => {
    setT(0)
    setPlaying(false)
  }, [racers])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((prev) => {
        const next = prev + dt
        if (next >= endT) {
          setPlaying(false)
          return endT
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, endT])
  const now = traces.map((tr) => sample(tr, t))
  const lead = Math.max(...now.map((s) => s.x))
  return (
    <Figure
      label={label}
      aspect={16 / 8}
      phoneAspect={4 / 3}
      drag={false}
      scene={<RaceScene racers={racers} traces={traces} time={time} />}
      controls={
        <>
          {children}
          <div className="play">
            <button
              type="button"
              className="play-btn"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => {
                if (!playing && t >= endT - 0.01) setT(0)
                setPlaying((p) => !p)
              }}
            >
              {playing ? (
                <svg viewBox="0 0 14 14">
                  <rect x="2" y="1" width="3.5" height="12" fill="currentColor" />
                  <rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 14 14">
                  <path d="M3 1 L13 7 L3 13 Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <input
              className="slider-input"
              type="range"
              min={0}
              max={endT}
              step={0.01}
              value={t}
              aria-label="Time"
              onChange={(e) => {
                setPlaying(false)
                setT(+e.target.value)
              }}
              style={{ '--pct': `${(t / endT) * 100}%` } as React.CSSProperties}
            />
            <output className="slider-value">{fmt(t, 1)} s</output>
          </div>
          <div className="results-wrap">
            <table className="results">
              <thead>
                <tr>
                  <th />
                  <th className="num-col">mph</th>
                  <th className="num-col">rpm</th>
                  <th className="num-col">gear</th>
                  <th className="num-col">behind</th>
                  <th className="num-col">{finishMph} mph at</th>
                  {rows && <th className="num-col" />}
                </tr>
              </thead>
              <tbody>
                {racers.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className="swatch" style={{ background: r.paint }} />
                      {r.label}
                    </td>
                    <td className="num-col">{fmt(mphFromMps(now[i].v))}</td>
                    <td className="num-col">{traces[i].ice ? fmt(now[i].rpm) : ''}</td>
                    <td className="num-col">{traces[i].ice ? now[i].gear : ''}</td>
                    <td className="num-col">{lead - now[i].x < 0.5 ? 'leads' : `${fmt(lead - now[i].x)} m`}</td>
                    <td className="num-col">{traces[i].finish !== null ? `${fmt(traces[i].finish!, 1)} s` : `over ${maxT} s`}</td>
                    {rows && <td className="num-col">{rows(r, traces[i].finish)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
      caption={caption}
    />
  )
}
