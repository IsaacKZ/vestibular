import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export const offlineAssetPatterns = [
  "**/*.{js,css,html,json,woff2}",
  "content/documents/gabaritos/**/*.pdf",
  "**/*.{[sS][vV][gG],[pP][nN][gG],[jJ][pP][gG],[jJ][pP][eE][gG],[wW][eE][bB][pP],[aA][vV][iI][fF],[gG][iI][fF]}",
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["favicon.svg", "icons/*.png", "content/*.json"],
      manifest: {
        name: "Caderno UDESC",
        short_name: "Caderno",
        description: "Questões e revisões para o vestibular UDESC.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F7F5EF",
        theme_color: "#1B6658",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: offlineAssetPatterns,
        maximumFileSizeToCacheInBytes: 8_000_000,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: "es2023" },
});
