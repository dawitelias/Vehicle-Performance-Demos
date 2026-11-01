import { RouterProvider, useRoute } from './app/router'
import { Ground } from './ui/Ground'
import { Hub } from './pages/Hub'
import { TorqueVsHorsepower } from './pages/TorqueVsHorsepower'

function Routes() {
  const { path } = useRoute()
  if (path === '/torque-vs-horsepower') return <TorqueVsHorsepower />
  return <Hub />
}

export default function App() {
  return (
    <RouterProvider>
      <Ground />
      <Routes />
    </RouterProvider>
  )
}
