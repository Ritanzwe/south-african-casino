import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the game server runs separately on port 4100 (see server/src/index.ts).
    // Passing /socket.io on to it means the browser always talks to the same address,
    // just like in production.
    proxy: {
      "/socket.io": { target: "http://localhost:4100", ws: true },
    },
  },
});
