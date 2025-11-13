// Nuxt 3 config
export default defineNuxtConfig({
  compatibilityDate: "2025-09-28",
  ssr: false,
  app: {
    head: {
      title: "OSM - DPE",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
    },
  },
  vite: {
    esbuild: {
      drop: ["console"],
    },
  },
  nitro: {
    esbuild: {
      options: {
        drop: ["console"],
      },
    },
  },
});
