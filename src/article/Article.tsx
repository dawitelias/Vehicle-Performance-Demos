import { useMemo, useState } from 'react'
import { Link } from '../app/router'
import { GLHost } from './gl/GLHost'
import { HeroCarFigure } from './figures/HeroCar'
import { WrenchFigure } from './figures/Wrench'
import { WinchFigure } from './figures/Winch'
import { CrankFigure } from './figures/Crank'
import { DynoFigure } from './figures/Dyno'
import { GearsFigure } from './figures/Gears'
import { TyreForceFigure } from './figures/TyreForce'
import { ThrustFigure } from './figures/Thrust'
import { RaceFigure, type Racer } from './figures/Race'
import { EnvelopeFigure } from './figures/Envelope'
import { Choice } from './Figure'
import { nissanZ, z370, ghostHighRevRegeared, ghostDiesel, ev } from '../sim/vehicles'
import { mpsFromMph } from '../sim/units'
import './article.css'

const PAINT = { z: '#f2c230', z370: '#b9bcc2', screamer: '#e8e3d6', monster: '#5f6670', ev: '#9fb6d8' }
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth']

function PassRace() {
  const [low, setLow] = useState(3)
  const racers = useMemo<Racer[]>(
    () => [
      { id: 'six', label: 'Held in sixth', vehicle: nissanZ, paint: PAINT.z, options: { startSpeedMps: mpsFromMph(50), startGear: 6, shiftStrategy: 'hold' } },
      { id: 'low', label: `Shifted to ${ORD[low]}`, vehicle: nissanZ, paint: PAINT.screamer, options: { startSpeedMps: mpsFromMph(50), startGear: low, shiftStrategy: 'hold' } },
    ],
    [low],
  )
  return (
    <RaceFigure racers={racers} finishMph={80} maxT={14} label="Two Zs accelerating from 50 to 80 mph, one in sixth gear and one in a lower gear" caption={<>Both cars start at 50 mph with the throttle fully open and stay in their gear. Second gear runs out at 63 mph, so that car never reaches 80.</>}>
      <Choice label="Lower gear" value={low} onChange={setLow} options={[2, 3, 4, 5].map((g) => ({ value: g, label: ['', '1st', '2nd', '3rd', '4th', '5th'][g] }))} />
    </RaceFigure>
  )
}

function RivalRace() {
  const [gear, setGear] = useState(6)
  const racers = useMemo<Racer[]>(
    () => [
      { id: 'z', label: 'Your Z', vehicle: nissanZ, paint: PAINT.z, options: { startSpeedMps: mpsFromMph(50), startGear: gear, shiftStrategy: 'hold' } },
      { id: 'z370', label: '370Z', vehicle: z370, paint: PAINT.z370, options: { startSpeedMps: mpsFromMph(50), startGear: gear, shiftStrategy: 'hold' } },
    ],
    [gear],
  )
  return (
    <RaceFigure racers={racers} finishMph={80} maxT={14} label="The Z and the 370Z accelerating from 50 to 80 mph in the same gear" caption={<>Both cars use the same six-speed gearbox ratios. The 370Z is about 240 lb lighter and has a slightly shorter final drive.</>}>
      <Choice label="Both in" value={gear} onChange={setGear} options={[{ value: 6, label: '6th' }, { value: 3, label: '3rd' }]} />
    </RaceFigure>
  )
}

const ENGINES = [
  { label: 'Your Z', vehicle: nissanZ, color: PAINT.z, hp: 400, lbft: 350 },
  { label: '370Z engine', vehicle: z370, color: PAINT.z370, hp: 332, lbft: 270 },
  { label: 'High-revving', vehicle: ghostHighRevRegeared, color: PAINT.screamer, hp: 400, lbft: 233 },
  { label: '450 lb-ft', vehicle: ghostDiesel, color: PAINT.monster, hp: 250, lbft: 450 },
  { label: 'Electric', vehicle: ev, color: PAINT.ev, hp: 450, lbft: 480 },
]

function EnginesRace() {
  const racers = useMemo<Racer[]>(() => ENGINES.map((e) => ({ id: e.label, label: e.label, vehicle: e.vehicle, paint: e.color, options: { shiftRpm: 'optimal' } })), [])
  return (
    <RaceFigure
      racers={racers}
      finishMph={130}
      maxT={30}
      label="Five cars with the same body and different engines accelerating from a standstill to 130 mph"
      rows={(r) => {
        const e = ENGINES.find((x) => x.label === r.label)!
        return `${e.hp} hp, ${e.lbft} lb-ft`
      }}
      caption={<>Every car has your Z's body, tyres and aerodynamics. Each shifts at the point that keeps its push highest. The electric car is heavier, as a real one would be.</>}
    />
  )
}

export function Article() {
  return (
    <main className="article">
      <GLHost />
      <header className="wrap nav">
        <Link to="/">Vehicle Performance Demos</Link>
        <span>2024 Nissan Z Performance, six-speed manual</span>
      </header>

      <div className="col article-head">
        <h1 className="article-title">Torque and horsepower in a 2024 Nissan Z</h1>
      </div>

      <div className="col-wide">
        <HeroCarFigure />
      </div>

      <article className="col prose">
        <p>
          Nissan rates the VR30DDTT engine in your Z at 350 lb-ft of torque from 1,600 to 5,200 rpm and 400 horsepower at 6,400 rpm. Most people who know cars can repeat a rule of thumb about those two numbers, usually something like "torque is what you feel and horsepower is how fast you go." The rule points in a useful direction, but it leaves out what each number measures and when one of them matters more than the other.
        </p>
        <p>
          This article works through both ideas from the beginning, starting with a wrench and ending with your car on the road. Every figure can be changed with the sliders beneath it, and the three-dimensional ones can be turned by dragging sideways. The car numbers come from Nissan's published figures, run through a simulation whose 0 to 60 mph and quarter-mile times land within a few tenths of a second of Car and Driver's test of the same car.
        </p>

        <h2>Torque is a twisting force</h2>
        <p>
          Pushing on the end of a wrench turns a bolt. How hard the bolt is twisted depends on two things: how hard you push, and how far from the bolt you push. Multiplying the force by that distance gives the torque.
        </p>
        <WrenchFigure />
        <p>
          With the force in pounds and the distance in feet, the unit is the pound-foot. Fifty pounds on the end of a wrench one foot long is 50 lb-ft. The same fifty pounds at half the distance gives half the torque, so moving your hand toward the bolt makes it harder to loosen even though you are pushing just as hard.
        </p>
        <p>
          Your Z's engine produces 350 lb-ft at its crankshaft. Matching that by hand would mean hanging 350 pounds, roughly two adults, from the end of a wrench one foot long.
        </p>
        <p>
          Torque describes a twist and says nothing about movement. With the bolt set to seized in the figure, you can push as hard as you like and nothing turns. Set it free to turn and the wrench starts moving, and the readout begins counting the work done, which is where the next idea starts.
        </p>

        <h2>Work and power</h2>
        <p>
          Work is done when a force moves something. For a turning shaft, the work is the torque multiplied by the angle it turns through, measured in radians. One full turn is about 6.28 radians, so one revolution at 350 lb-ft does about 2,200 foot-pounds of work. That much energy would lift a 220 lb person ten feet.
        </p>
        <p>
          Power is the rate at which work is done. A winch shows this clearly. The drum below is twisted with a set torque, and the rope winding onto it lifts a weight. The torque decides how heavy a weight the drum can hold. How fast the drum turns decides how fast the weight rises.
        </p>
        <WinchFigure />
        <p>
          With the torque fixed, doubling the drum speed makes the weight rise twice as fast, and the power doubles with it. With the speed fixed, doubling the torque lifts twice the weight at the same pace, and the power doubles again. Power depends on both.
        </p>
        <p>
          The horsepower is a unit from the age of steam engines, chosen so that one horsepower equals 33,000 foot-pounds of work per minute. For a turning shaft, the arithmetic reduces to a short formula:
        </p>
        <span className="formula">
          <b>horsepower</b> = torque in lb-ft × rpm ÷ 5,252
        </span>
        <p>
          The 5,252 is 33,000 divided by 2π, the conversion from revolutions to radians. The formula has two direct consequences. A torque figure without an engine speed can't tell you the power. And at exactly 5,252 rpm, the torque in lb-ft and the power in horsepower are always the same number.
        </p>

        <h2>Where an engine's torque comes from</h2>
        <p>
          Inside each cylinder, burning fuel and air pushes the piston down. The connecting rod passes that push to the crankshaft, which works like a wrench whose length changes as it turns. At the top of the stroke the rod pushes straight through the centre of the shaft, the lever has no length, and no torque results. Partway down, the lever is at its longest.
        </p>
        <CrankFigure />
        <p>
          The pressure in the cylinder depends on how much air and fuel are burned in it. Your Z's two turbochargers push extra air in, which raises the pressure, the push on each piston, and the torque. The boost slider shows the effect directly.
        </p>
        <p>
          A single cylinder produces short, strong pulses, far above 350 lb-ft for a moment and nothing at all for most of the cycle. Six cylinders firing in turn blend those pulses into the steady average a dyno reports. The engine computer limits boost so that this average stays near 350 lb-ft over a wide range of engine speeds. Above about 5,200 rpm, the turbochargers can no longer supply enough air for every cycle, and the torque starts to fall.
        </p>

        <h2>Reading the Z's dyno sheet</h2>
        <p>Here are both curves for your engine at full throttle, plotted on one scale so the numbers can be compared directly.</p>
        <DynoFigure />
        <p>
          While torque is flat, horsepower grows in proportion to engine speed, so the horsepower line rises straight through the middle of the range. Past 5,200 rpm the torque eases off, but the engine's speed is rising by a larger proportion than its torque is falling, so horsepower keeps climbing until 6,400 rpm. Beyond that, falling torque outweighs rising speed, and power drops slightly before the limiter cuts in at 6,800.
        </p>
        <p>
          The two curves describe the same engine in two ways. The torque curve says how hard the engine twists at each speed. The horsepower curve says how much work it can do each second at each speed. The rest of this article shows that the second one decides how quickly the car can gain speed, and that the first still matters a great deal in the gear you happen to be in.
        </p>

        <h2>Gears trade torque for speed</h2>
        <p>When a small gear drives a larger one, the larger gear turns more slowly and with more torque. If it has 3.8 times as many teeth, it turns at a 3.8th of the speed with 3.8 times the torque.</p>
        <GearsFigure />
        <p>
          Your Z's first gear is 3.794 to 1, and the differential multiplies again by 3.538, so in first gear the rear axle receives the engine's torque multiplied by 13.4. In sixth the total is 2.8.
        </p>
        <p>
          The torque goes up by the same factor that the speed goes down, so their product, the power, is unchanged. A gearbox cannot add power. Apart from about 8 percent lost to friction in the gearbox and differential, the power at the wheels is whatever the engine is making at that moment, in every gear.
        </p>

        <h2>From torque at the axle to a push on the road</h2>
        <p>
          A rear tyre works like a wrench used in reverse. The axle twists the wheel, and the tyre pushes backward on the road with a force equal to the axle torque divided by the tyre's radius. The road pushes the car forward by the same amount. Your Z's 275/35R19 rear tyres measure a little over a foot from the centre of the wheel to the road, so each lb-ft at the axle becomes slightly less than a pound of push.
        </p>
        <TyreForceFigure />
        <p>
          In first gear at 3,000 rpm, the engine's 350 lb-ft becomes about 4,000 lb of push. The rear tyres can take roughly half of that before they lose grip, so a full-throttle start in first spins them, and grip, not the engine, sets the acceleration. In sixth gear at the same engine speed the push is about 840 lb. Drag grows with the square of speed, so at high speed a growing share of the push goes into pushing air aside.
        </p>

        <h2>Why horsepower sets the limit</h2>
        <p>
          Plotting the push in every gear against road speed gives six overlapping curves. At any speed, one gear gives the most push. Move the slider and the best gear turns out to be the one that puts the engine closest to 6,400 rpm, where it makes the most power.
        </p>
        <ThrustFigure />
        <p>
          The upper edge of the six curves follows a single dashed line: the push that 400 horsepower can provide at each speed. Because power is force multiplied by speed, that line falls as speed rises. At 60 mph the most push any gear can give is about 2,300 lb; at 120 mph it is about half that. The torque figure does not appear in that limit at all. Power and road speed set it, and the gearbox can only bring the engine close to its power peak or take it away.
        </p>

        <h2>When torque matters</h2>
        <p>
          Most of the time you are not in the ideal gear. Suppose you are cruising in sixth at 50 mph with the engine turning about 1,800 rpm, and you want to pass. You can stay in sixth and use the push the engine makes at 1,800 rpm, or shift down to third and use the push it makes at 3,750 rpm.
        </p>
        <PassRace />
        <p>
          Third reaches 80 mph in 3.7 seconds and sixth takes 7.6. The engine makes nearly the same torque at both speeds, but third gear multiplies it by 5.7 and sixth by 2.8. In third the engine also turns twice as fast and makes twice the power, which is the same fact seen from the other side.
        </p>
        <p>
          Torque at low engine speed decides how much the car does when you don't shift, and here your Z differs most from the car it replaced. The 370Z's naturally aspirated 3.7-litre V6 makes its torque higher in the rev range. Compare the two cars held in the same gear from 50 mph.
        </p>
        <RivalRace />
        <p>
          In sixth, your Z reaches 80 mph in 7.6 seconds against the 370Z's 10.5. At about 1,800 rpm the VR30 is already making 340 lb-ft, while the 370Z's engine makes about 230. Shifted down to third, the gap narrows to 3.7 against 4.4 seconds, because both engines are now turning fast enough to make most of their power. A torque curve that is high from low engine speeds gives you most of the car's ability without a downshift. In everyday driving, at part throttle and without changing gear, you feel the difference most.
        </p>
        <p>
          The same flat curve helps when you do shift. Each upshift drops the revs, from the limiter in first to about 4,200 rpm in second and from second to about 4,750 in third. Because your Z's torque is already at full strength at those speeds, the engine lands where it is still making most of its power. An engine whose torque arrives late would land in a weaker part of its range after every shift. What sets the time from one speed to another is the power the engine makes across the band of revs it actually uses, often called the area under the power curve, rather than the single peak figure.
        </p>

        <h2>Five engines in one car</h2>
        <p>
          To separate the engine from everything else, the next figure puts five engines in your Z's body, with the same tyres, weight and aerodynamics, each shifting where it gives the most push.
        </p>
        <ul>
          <li>Your Z's engine, with 400 hp and 350 lb-ft.</li>
          <li>The 370Z's engine, with 332 hp and 270 lb-ft.</li>
          <li>An imaginary high-revving engine making the same 400 hp at 9,000 rpm with two-thirds of the torque, given shorter gearing so it reaches the same speed in each gear.</li>
          <li>An imaginary engine with 450 lb-ft at 1,800 rpm that runs out of breath at 4,500 rpm and makes 250 hp, given taller gearing to match.</li>
          <li>An electric motor with 480 lb-ft from a standstill, 450 hp and a single gear.</li>
        </ul>
        <EnginesRace />
        <p>
          The finishing order closely follows horsepower. The high-revving engine finishes a little behind yours despite having two-thirds of the torque, because its shorter gearing multiplies that torque more and it has the same power to spend. Your engine edges ahead of it because its flat torque keeps its power higher across the range after each shift. The 450 lb-ft engine twists hardest of all but turns slowly, so it has the least power, and it finishes last by a wide margin. The electric car leads from the start because all of its torque is available from zero speed with no shifts, and it stays ahead because it also has the most power.
        </p>
        <EnvelopeFigure entries={ENGINES} />
        <p>The chart shows the same result directly. Each line is the most push one engine can give at each road speed, in its best gear, and the lines stack up in the order of the race.</p>

        <h2>What the two numbers tell you</h2>
        <p>
          Horsepower tells you how much push the car can produce at a given road speed when you are in the right gear. It decides acceleration once the tyres can hold the push, passing times when you downshift, and top speed.
        </p>
        <p>
          Torque, read off the curve at the engine speed you are using, tells you how much push you get in the gear you are already in. A curve that is high from low engine speeds makes a car strong without downshifting and keeps its power high after each upshift. A large peak torque figure by itself says little. Where in the rev range it arrives, and how long it lasts, says much more.
        </p>
        <p>
          In your Z the two numbers work together. The 350 lb-ft from 1,600 rpm gives strong response in any gear, and the 400 hp at 6,400 rpm sets how fast the car can gain speed when you choose the right one.
        </p>
      </article>

      <footer className="col article-foot">
        <hr className="rule" />
        <p className="small">
          Car figures: Nissan's published specifications for the 2024 Z Performance with the six-speed manual (350 lb-ft, 400 hp, gear ratios, final drive 3.538, 275/35R19 rear tyres, 3,536 lb), with a drag coefficient of 0.31 and an estimated frontal area of 2.0 m². The simulated car runs 0 to 60 mph in 4.8 s and the quarter mile in 13.0 s at 111 mph; Car and Driver measured 4.5 s and 13.0 s at 111 mph. The 3D model is the{' '}
          <a href="https://sketchfab.com/3d-models/2020-nissan-z-proto-concept-03606ad387374824af0df58b6ca5f574">2020 Nissan Z Proto concept on Sketchfab</a>, used under its Sketchfab licence.
        </p>
      </footer>
    </main>
  )
}
