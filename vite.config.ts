import { createReadStream, existsSync } from "fs";
import { join, resolve } from "path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** dev サーバーで /ort/ へのリクエストを node_modules から配信するプラグイン。
 *  public/ の .mjs を Vite がモジュールとしてインポート拒否する問題を回避する。 */
const ortDevPlugin = (): Plugin => {
  const ortDist = resolve("node_modules/onnxruntime-web/dist");
  return {
    name: "ort-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const marker = "/ort/";
        const idx = url.indexOf(marker);
        if (idx === -1) { next(); return; }
        const filename = url.slice(idx + marker.length).split("?")[0];
        if (!filename) { next(); return; }
        const filePath = join(ortDist, filename);
        if (!existsSync(filePath)) { next(); return; }
        const contentType = filename.endsWith(".wasm")
          ? "application/wasm"
          : "application/javascript; charset=utf-8";
        res.setHeader("Content-Type", contentType);
        createReadStream(filePath).pipe(res);
      });
    }
  };
};

export default defineConfig(({ mode }) => {
  const isDesktop = mode === "desktop";

  return {
    base: isDesktop ? "./" : "/CreateScore/",
    build: {
      outDir: isDesktop ? "dist-desktop" : "dist"
    },
    plugins: [react(), ortDevPlugin()],
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp"
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts"
    }
  };
});
