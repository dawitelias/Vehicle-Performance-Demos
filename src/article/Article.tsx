import { Link } from '../app/router'
import { GLHost } from './gl/GLHost'
import { WrenchFigure } from './figures/Wrench'
import './article.css'

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

      <article className="col prose">
        <p>
          Nissan rates the VR30DDTT engine in your Z at 350 lb-ft of torque from 1,600 to 5,200 rpm and 400 horsepower at 6,400 rpm. Most people who know cars can repeat a rule of thumb about those two numbers, usually something like "torque is what you feel and horsepower is how fast you go." The rule points in a useful direction, but it leaves out what each number measures and when one of them matters more than the other.
        </p>
        <p>
          This article builds both ideas from the ground up, starting with a wrench and ending with your car on the road. Every figure is interactive: drag a figure sideways to turn it, and use the sliders underneath to change what it shows.
        </p>

        <h2>Torque is a twisting force</h2>
        <p>
          Pushing on the end of a wrench turns a bolt. How hard the bolt is twisted depends on two things: how hard you push, and how far from the bolt you push. Multiply the force by that distance and you get torque.
        </p>
        <WrenchFigure />
        <p>
          With a force in pounds and a distance in feet, the unit is the pound-foot. Fifty pounds on the end of a wrench one foot long is 50 lb-ft. The same fifty pounds at half the distance gives half the torque, so moving your hand closer to the bolt makes it harder to loosen even though you are pushing just as hard.
        </p>
      </article>
    </main>
  )
}
