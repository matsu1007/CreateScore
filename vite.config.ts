import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isDesktop = mode === "desktop";

  return {
    base: isDesktop ? "./" : "/CreateScore/",
    build: {
      outDir: isDesktop ? "dist-desktop" : "dist"
    },
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts"
    }
  };
});
