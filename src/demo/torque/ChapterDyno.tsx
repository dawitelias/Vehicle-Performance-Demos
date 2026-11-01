import { useFreeRev } from '../../hooks/useFreeRev'
import { Z_ENGINE } from '../../sim/vehicles'
import { RingTach } from '../../ui/RingTach'
import { CurveChart } from '../../ui/CurveChart'
import { BigNumber } from '../../ui/BigNumber'
import { ThrottleBar } from '../../ui/ThrottleBar'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function ChapterDyno() {
  const rev = useFreeRev(Z_ENGINE, 'rated', 3200)
  const energy = Math.min(1, Math.max(0, (rev.rpm - 1000) / 5800))

  return (
    <section className="chapter" id="dyno">
      <div className="wrap chapter-head">
        <h2 className="display display-l">Read the dyno sheet.</h2>
        <p className="lede measure">Torque is how hard the engine twists. Horsepower is that twist, times how fast it's turning.</p>
        <p className="body measure">
          Nissan rates the Z at 350 lb-ft from 1,600 to 5,200 rpm, and 400 hp at 6,400. Those aren't rival stats. They're the same pull, measured two ways. Hold the throttle and watch both move.
        </p>
      </div>

      <div className="wrap dyno-stage">
        <RingTach rpm={rev.rpm} redlineRpm={Z_ENGINE.redlineRpm} onLimiter={rev.onLimiter} band={{ from: 1600, to: 5200, label: 'peak torque, 1,600 to 5,200' }} className="dyno-ring" />
        <CurveChart curve={Z_ENGINE.curve} rpm={rev.rpm} maxRpm={Z_ENGINE.limiterRpm} className="dyno-chart" />
      </div>

      <div className="wrap dyno-moment">
        <BigNumber value={fmt(rev.hp)} energy={energy} label={`${fmt(rev.hp)} horsepower at ${fmt(rev.rpm)} rpm`} />
        <div className="dyno-moment-caption">
          <div>
            <b>Horsepower, right now</b>
            <span>At {fmt(rev.rpm)} rpm, with {fmt(rev.tq)} lb-ft of torque</span>
          </div>
          <div>
            <b>Torque</b>
            <span>{fmt(rev.tq)} lb-ft</span>
          </div>
          <div>
            <b>At 5,252 rpm</b>
            <span>The two numbers are equal. Always.</span>
          </div>
          <div className="num">{fmt(rev.rpm)}</div>
        </div>
      </div>

      <div className="wrap dyno-after">
        <p className="lede measure">Flat torque means horsepower climbs in a straight line.</p>
        <p className="body measure">
          That's the twin-turbo plateau, and it's why the Z pulls hard almost everywhere. Past 5,500 rpm the turbos stop keeping up and torque eases off. Horsepower keeps rising to 6,400 anyway, because the engine is spinning faster than the torque is falling.
        </p>
      </div>

      <ThrottleBar
        rpm={rev.rpm}
        minRpm={1000}
        maxRpm={Z_ENGINE.limiterRpm}
        onRpm={rev.setRpm}
        holding={rev.holding}
        onHold={rev.hold}
        onRelease={rev.release}
        readouts={[
          { value: fmt(rev.rpm), unit: 'rpm', accent: true },
          { value: fmt(rev.tq), unit: 'lb-ft' },
          { value: fmt(rev.hp), unit: 'hp' },
        ]}
      />
    </section>
  )
}
