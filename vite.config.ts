import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server", host: "0.0.0.0", port: 8080, allowedHosts: true },
    // REMOVE or COMMENT OUT the router block below to prevent the build-time crawl
    /*
    router: {
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    },
    */
  },
});
