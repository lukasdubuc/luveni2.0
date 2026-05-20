import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Adding this explicit config helps the plugin find your routes
  vite: {
    plugins: [
       // The Lovable config already handles most things, 
       // but we can ensure the router plugin has the correct root:
    ],
  },
});
