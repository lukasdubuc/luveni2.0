import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// vite.config.ts
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      // Explicitly tell the router to only look in src/routes
      routesDirectory: './src/routes',
    }),
    // ...
  ],
})
    // Keep this clean. The plugin handles the route tree automatically.
  },
});
