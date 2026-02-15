const path = require("node:path");
const { app, BrowserWindow, shell, session } = require("electron");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const isMediaPermission = (permission) =>
  permission === "media" || permission === "microphone";

const setupPermissions = () => {
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    isMediaPermission(permission)
  );
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isMediaPermission(permission));
  });
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#f4f8fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await win.loadFile(path.join(__dirname, "..", "dist-desktop", "index.html"));
};

app.whenReady().then(async () => {
  setupPermissions();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
