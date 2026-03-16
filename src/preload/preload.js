const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  launchApp: (appPath) => ipcRenderer.invoke("launch-app", appPath),

  addWebApp: (app) => ipcRenderer.send("add-web-app", app),

  getApps: () => ipcRenderer.invoke("get-apps"),

  onAppsUpdated: (callback) =>
    ipcRenderer.on("apps-updated", (_, apps) => callback(apps)),
});
