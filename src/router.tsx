import { createRouter as createTanStackRouter } from '@tanstack/react-router'

// We are defining a "Dummy" route tree here to stop the plugin from crawling
// and crashing your build.
const rootRoute = { id: '__root', children: [] }
const dummyRouteTree = rootRoute as any

export function createRouter() {
  return createTanStackRouter({
    routeTree: dummyRouteTree,
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
