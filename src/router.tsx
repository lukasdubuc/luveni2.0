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
    // Applies to EVERY navigation, including browser back/forward — exiting a
    // product via history.back() morphs the image back into its grid tile
    // instead of hard-swapping. Per-transition CSS lives in styles.css.
    defaultViewTransition: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPreloadDelay: 30,
  });

  return router;
};
