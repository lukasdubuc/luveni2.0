import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
// Using explicit relative path to the generated file
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
