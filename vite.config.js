import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 10000 },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // se registra desde src/pwa.js
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Nito",
        short_name: "Nito",
        description: "Compañero de apoyo emocional con IA local, sin internet.",
        lang: "es",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#17122b",
        theme_color: "#17122b",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // La app completa (incluido el motor de IA) queda en caché para abrir sin conexión.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {allowedHosts:[ "reliable-shipment-smtp-refugees.trycloudflare.com", "https://nito-v2.onrender.com/"],},
  test: { environment: "jsdom", include: ["tests/**/*.test.js"] },
});
