import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'

const rootRouteChildren = [indexRoute]
export const routeTree = rootRoute.addChildren(rootRouteChildren)
