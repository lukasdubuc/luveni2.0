import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { 
      entry: "server", 
      host: "0.0.0.0", 
      port: 8080, 
      allowedHosts: true 
    },
    // Keep this clean. The plugin handles the route tree automatically.
  },
});
