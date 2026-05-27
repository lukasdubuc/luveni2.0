import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
    }),
  ],
  tanstackStart: {
    server: { 
      entry: "server", 
      host: "0.0.0.0", 
      port: 8080, 
      allowedHosts: true 
    },
  },
});
