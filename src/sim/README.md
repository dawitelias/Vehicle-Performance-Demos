# `src/sim` — longitudinal performance simulator

Pure TypeScript, no React. Everything here is unit-tested with vitest
(`npm test`). The UI consumes it through `createRun` (real-time stepper) and
`simulate` / `rollingAccel` (batch runs with derived metrics).

| File | Contents |
| --- | --- |
| `units.ts` | lb-ft ↔ N·m, hp ↔ kW, mph ↔ m/s ↔ km/h, in ↔ m, lb ↔ kg, `hp = lb-ft × rpm / 5252`. |
| `engine.ts` | `TorqueCurve`, `torqueAt` (linear, clamped), `powerAt`, `peakTorque`/`peakPower` (10 rpm scan), throttle + engine-braking model, soft limiter, first-order turbo lag. |
| `vehicles.ts` | All car data with a source comment per number. `Vehicle = { chassis, powertrain: { kind: 'ice' } \| { kind: 'ev' } }`. |
| `drivetrain.ts` | rpm ↔ speed, wheel torque/force, `speedAtRpmPerGear`, `effectiveMassFactor`, `optimalShiftPoints`, `tractiveForceCurve`, `resistanceForce`. |
| `longitudinal.ts` | `createRun` stepper, `simulate` trace + metrics (0–60 with/without rollout, ¼ mile ET + trap, 0–100, 60–130, `speedToSpeed`), `rollingAccel`. |

## Model

**Forces on a point mass.** `m·a = F_tyre − ½ρ·Cd·A·v² − Crr·m·g` with
ρ = 1.225 kg/m³ and rolling resistance only when moving. Semi-implicit Euler,
default `dt = 5 ms`; the 0–60 result changes by < 0.03 s between dt = 1 ms and
5 ms (tested). A 30 s run takes well under 50 ms in node (tested).

**Engine (ICE).** `T = T_curve(rpm) · throttle · boostFactor · limiterScale +
T_brake(rpm) · (1 − throttle)`.

* `T_brake = −(0.03·T_peak + 4·10⁻⁶·rpm²)` lb-ft — a simple closed-throttle
  pumping/friction term (≈ −26 lb-ft at 2000 rpm, −195 lb-ft at 6800 for the Z).
* Soft fuel cut: drive torque fades linearly to zero over the last 50 rpm
  below `limiterRpm`, so a car held on the limiter settles a few rpm under it
  instead of bouncing. The automatic shift strategy triggers 25 rpm before the
  configured shift point so the cut never eats thrust first.
* Turbo lag (toggle per engine; on for the Z, off for every rival): the curve
  is split into a 55 % naturally-aspirated baseline that is always available and
  a 45 % boost share scaled by a first-order state `boost ∈ [0,1]`.
  `boost → 1` with τ = 0.25 s whenever the throttle is open; it decays with
  τ = 0.6 s when the throttle is closed or the clutch is open during a shift
  (the turbo shaft keeps spinning through a 0.35 s lift, so boost returns much
  faster than it builds from off-boost). Boost starts at 0 (no pre-spool).

**EV.** Motor torque = `min(T_max, P_max / ω)` × throttle (constant torque to
base speed ≈ 42 mph, constant power above), soft cut at `maxMotorRpm`, mild
lift-off regen (10 % of T_max). Single fixed ratio.

**Rotating inertia.** Gillespie (*Fundamentals of Vehicle Dynamics*, eq. 2-10):
`m_eff / m = 1 + 0.04 + k·N²`, N = gear × final drive, k = 0.0025 for the real
cars. For the Z this is 1.49 in 1st, 1.21 in 2nd, 1.06 in 6th. For the
hypothetical engines k is scaled by (6800 / limiter)² so the engine stores the
same rotational energy at the same road speed as the Z's (a 9400 rpm engine
gets a lighter flywheel, the 4500 rpm "diesel" a heavier one); the EV uses
k = 0.0006 (small rotor). **While the clutch slips the engine turns at constant
speed, so only the 0.04 driveline share is added** — this matters for the
engine-limited NA launches (370Z, ghosts).

**Traction and launch.** `F_trac = μ · F_z,driven`, with
`F_z,rear = W_rear,static + m·a·h/L` (RWD; AWD uses the whole weight). `a`
appears on both sides, so each step runs 3 fixed-point iterations starting
from the previous step's `a`. Then

```
a = min( (F_trac − R) / m ,  (F_eng − R) / m_eff )
```

i.e. when the engine could push harder than the tyres can take, the car
accelerates at the tyre limit with the translational mass only — the surplus
engine torque is burnt spinning up the rotating parts (wheelspin/clutch slip
that a driver or traction control meters). Otherwise it is engine-limited with
the full rotating mass. `state.tractionLimited` tells the UI which regime it is
in. Engine rpm follows wheel speed in both regimes (slip is assumed small).

Standing start: the clutch slips with the engine held at `launchRpm` (Z 3500,
370Z 5000, ghost high-rev 6000, diesel 2200) and transmits up to the engine's
torque at that speed; it locks when wheel speed reaches `launchRpm` (≈ 20 mph
for the Z in 1st). A slipping clutch transmits no engine braking. Below idle
with a locked clutch the engine is held at idle (slip).

**Shifts.** 0.35 s with the clutch open and zero thrust; rpm blends linearly to
the new gear's speed, the turbo de-spools. Automatic strategy: up-shift at
`shiftRpm` (`'optimal'` = `optimalShiftPoints`, `'limiter'`, a number, or one
per gear). Down-shifts (stepper paddles) are refused if they would exceed the
limiter.

**Governor.** Positive thrust fades to zero over the last 0.5 m/s below the
set speed (Z/370Z 155 mph, EV 162 mph).

**Metrics.** `zeroToSixtyS` is from a true standstill; `zeroToSixtyRolloutS`
subtracts the time to roll the first foot (US magazine convention).
`quarterMile.timeS` is the drag-strip ET (clock starts after 1 ft of rollout,
which is how every published ¼-mile time is measured); `timeFromRestS` is
from t = 0. Trap speed is the average over the last 66 ft.

## Tuned constants and their sources

| Constant | Value | Source / reasoning |
| --- | --- | --- |
| Z torque curves | see `vehicles.ts` | Rated: Nissan 350 lb-ft @ 1600–5200, 400 hp @ 6400. Dyno: stock chassis dynos 360–383 wtq ⇒ +12 % midrange. **Not altered during tuning.** |
| Z gearing | 3.794/2.324/1.624/1.271/1.000/0.794, 3.538 | Nissan spec sheet. |
| Z tyre radius | 0.327 m | 275/35R19, 784 rev/mile (Bridgestone S007 data). |
| Z mass | 1604 + 90 kg | Nissan curb 3536 lb + driver/fuel allowance. |
| Weight distribution | 56.4 / 43.6 | task brief (static). |
| Cd·A, Crr | 0.31 × 2.0 m², 0.012 | Nissan Cd; A and Crr estimates. |
| Wheelbase, CG height | 2.55 m, 0.48 m | Nissan; CG height estimate. |
| Driveline efficiency | 0.92 | typical manual RWD. |
| Shift time | 0.35 s | task brief. |
| Rotating mass factor | 1.04 + 0.0025·N² | Gillespie eq. 2-10. |
| Launch rpm | Z 3500 | task brief default. |
| **μ (tyre–road)** | **1.25** | Started at 1.05 (brief). With 1.05 the Z needed 5.5 s to 60 and the 370Z > 6 s, far outside published tests. Max-performance summer tyres (Potenza S007, PS4S class) stop from 60 mph in 105–110 ft in TireRack/magazine tests (≈ 1.1–1.15 g *average* under ABS), implying a peak dry μ of ~1.2–1.3. Sensitivity (rated curve, true standstill): μ 1.20 → 0–60 4.93 s / ¼ 13.38 s; **1.25 → 4.84 / 13.30 (ET 13.0)**; 1.30 → ≈ 4.75 / 13.2. |
| **Turbo decay τ** | **0.6 s** | Added during tuning. The brief gives the 0.25 s build constant only; a symmetric 0.25 s decay dropped boost to 25 % during every 0.35 s shift, which does not match how quickly boost returns after a fast shift on a modern twin-turbo. Worth ≈ 0.05 s per shift. |
| **Clutch-slip inertia** | 1.04·m while slipping | Added during tuning (physics fix): the engine does not accelerate while the clutch slips at constant rpm, so its reflected inertia must not be charged to the car. Z: 5.07 → 4.84 s (first 0.2 s of launch is engine-limited while boost builds); 370Z: 5.62 → 5.18 s. |
| 370Z launch rpm | 5000 | our choice (near peak torque); VQ37 makes little below 4000. |
| 370Z weight distribution | 54 / 46 | Nissan 370Z coupe spec. |
| Ghost inertia k | 0.0025·(6800/limiter)² | our choice, see above. |
| EV efficiency | 0.95 | single-stage reduction + inverter/motor at peak load; higher than a manual box + hypoid diff (estimate). |
| EV k | 0.0006 | small rotor inertia (~0.05–0.1 kg·m²) vs the ~0.45 kg·m² implied by k = 0.0025 for the Z (estimate). |

## Results (rated curve, dt 5 ms, true standstill unless noted)

| Vehicle | 0–60 s (rollout) | ¼ mile ET @ trap | 60–130 s | 50→80 mph by gear (s) |
| --- | --- | --- | --- | --- |
| Z (rated) | 4.84 (4.54) | 12.99 @ 111.5 | 13.2 | 3rd 3.70 · 4th 4.65 · 5th 5.92 · 6th 7.61 |
| Z (dyno) | 4.71 | 12.83 @ 112.9 | 12.6 | — |
| 370Z | 5.18 (4.89) | 13.30 @ 105.8 | 15.2 | 3rd 4.41 · 4th 5.74 · 5th 7.67 · 6th 10.47 |
| Ghost high-rev, stock gearing | 5.27 | 13.21 @ 107.9 | 13.8 | 2nd 3.88 · 3rd 6.13 · 4th 8.84 · 5th 13.16 · 6th 20.16 |
| Ghost high-rev, re-geared | 5.01 | 13.17 @ 109.7 | 13.8 | 3rd 4.03 · 4th 5.49 · 5th 7.76 · 6th 11.21 |
| Ghost diesel, re-geared | 6.32 | 14.25 @ 97.0 | 20.4 | 3rd 4.77 · 4th 5.41 · 5th 7.10 · 6th 10.26 |
| Ghost diesel, stock gearing | 6.65 | 14.67 @ 97.8 | n/a (tops out 122 mph) | 5th 4.83 · 6th 5.74 |
| EV | 3.62 (3.34) | 11.62 @ 120.3 | 10.1 | 2.71 |

(1st/2nd gear 50→80 entries are omitted where the gear hits its limiter first.
Regenerate with `npm test` — the numbers in `longitudinal.test.ts` bound these.)

## Known simplifications

* No tyre slip dynamics, no clutch thermal model, no gear-dependent efficiency.
* Load transfer uses the rigid-body term only (no suspension pitch dynamics).
* Launch rpm is constant while slipping; a real driver feathers it.
* EV traction uses the whole weight (ideal torque split); no launch-control overboost.
