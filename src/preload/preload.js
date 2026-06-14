const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  launchApp: (appPath) => ipcRenderer.invoke("launch-app", appPath),

  openWebApp: (url) => ipcRenderer.invoke("open-web-app", url),

  addWebApp: (app) => ipcRenderer.invoke("add-web-app", app),

  getApps: () => ipcRenderer.invoke("get-apps"),

  onAppsUpdated: (callback) =>
    ipcRenderer.on("apps-updated", (_, apps) => callback(apps)),
});
