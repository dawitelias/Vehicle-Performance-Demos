import { Link } from '../app/router'
import { Hero } from '../demo/torque/Hero'
import { ChapterDyno } from '../demo/torque/ChapterDyno'
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
      <footer className="wrap demo-foot">
        <hr className="rule" />
        <p className="small">Chapters two to five are on the way: how gears multiply torque, the highway pass, four engines in one Z, and a sandbox you can drive.</p>
      </footer>
    </main>
  )
}
