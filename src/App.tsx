import { RouterProvider, useRoute } from './app/router'
import { Ground } from './ui/Ground'
import { Fx } from './ui/Fx'
import { Hub } from './pages/Hub'
import { Article } from './article/Article'

function Routes() {
  const { path } = useRoute()
  if (path === '/torque-vs-horsepower') return <Article />
  return <Hub />
}

export default function App() {
  return (
    <RouterProvider>
      <Fx />
      <Ground />
      <Routes />
    </RouterProvider>
  )
}
