const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron
});
