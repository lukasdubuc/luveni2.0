import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // This tells the generator explicitly where to look and what to output
    router: {
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    },
  },
});
