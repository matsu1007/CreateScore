const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const PORT = 5173;
const DEV_URL = `http://${HOST}:${PORT}`;
const IS_WIN = process.platform === "win32";

const npmCmd = IS_WIN ? "npm.cmd" : "npm";
const electronBin = IS_WIN
  ? path.join(process.cwd(), "node_modules", ".bin", "electron.cmd")
  : path.join(process.cwd(), "node_modules", ".bin", "electron");

const waitForVite = async (timeoutMs = 60000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(DEV_URL, (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Vite dev server failed to start within timeout");
};

const viteProc = spawn(
  npmCmd,
  ["run", "dev", "--", "--host", HOST, "--port", String(PORT), "--strictPort"],
  {
    stdio: "inherit",
    env: process.env,
    shell: IS_WIN
  }
);

viteProc.on("error", (error) => {
  console.error(`Failed to start Vite: ${error.message}`);
  process.exit(1);
});

const shutdown = () => {
  if (!viteProc.killed) {
    viteProc.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

(async () => {
  try {
    await waitForVite();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    shutdown();
    process.exit(1);
  }

  if (!fs.existsSync(electronBin)) {
    console.error(
      "Electron binary not found. Install it with: npm install -D electron electron-builder"
    );
    shutdown();
    process.exit(1);
  }

  const electronProc = spawn(electronBin, ["electron/main.cjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_URL
    },
    shell: IS_WIN
  });

  electronProc.on("error", (error) => {
    console.error(`Failed to start Electron: ${error.message}`);
    shutdown();
    process.exit(1);
  });

  electronProc.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
})();
