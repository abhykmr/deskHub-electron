const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  launchApp: (appPath) => ipcRenderer.send("launch-app", appPath),
  addWebApp: (app) => ipcRenderer.send("add-web-app", app),
  getApps: () => ipcRenderer.invoke("get-apps"),
});
