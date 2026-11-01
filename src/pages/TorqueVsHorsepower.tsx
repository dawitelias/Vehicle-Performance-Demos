import { Link } from '../app/router'
import { Hero } from '../demo/torque/Hero'
import { ChapterDyno } from '../demo/torque/ChapterDyno'
import { ChapterGears } from '../demo/torque/ChapterGears'
import { ChapterPass } from '../demo/torque/ChapterPass'
import { ChapterEngines } from '../demo/torque/ChapterEngines'
import { ChapterDrive } from '../demo/torque/ChapterDrive'
import './TorqueVsHorsepower.css'

export function TorqueVsHorsepower() {
  return (
    <main className="page">
      <header className="wrap nav">
        <Link to="/">Vehicle Performance Demos</Link>
        <span>Torque and horsepower</span>
      </header>
      <Hero />
      <ChapterDyno />
      <ChapterGears />
      <ChapterPass />
      <ChapterEngines />
      <ChapterDrive />
      <footer className="wrap demo-foot">
        <hr className="rule" />
        <p className="small">Every number here comes from one model: Nissan's published curve, the six-speed's ratios, a 275/35R19 rear tyre, 3,536 lb plus a driver, and a drag coefficient of 0.31. The simulated Z does 0 to 60 in 4.8 seconds and the quarter mile in 13.0 at 111 mph; Car and Driver measured 4.5 and 13.0 at 111. The 3D model is the{' '}
          <a href="https://sketchfab.com/3d-models/2020-nissan-z-proto-concept-03606ad387374824af0df58b6ca5f574">2020 Nissan Z Proto concept on Sketchfab</a>, used under its Sketchfab licence.
        </p>
      </footer>
    </main>
  )
}
