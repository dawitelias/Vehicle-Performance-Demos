import { createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent } from 'react'

/** A very small path router: enough for a hub and a handful of demos. */

const RouterContext = createContext<{ path: string; navigate: (to: string) => void }>({
  path: '/',
  navigate: () => {},
})

function normalize(p: string): string {
  const s = p.replace(/\/+$/, '')
  return s === '' ? '/' : s
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => normalize(window.location.pathname))
  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to: string) => {
    const next = normalize(to)
    if (next === path) return
    window.history.pushState(null, '', next)
    setPath(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function useRoute() {
  return useContext(RouterContext)
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useRoute()
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  )
}
