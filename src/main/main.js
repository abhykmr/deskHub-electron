const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
} = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const scanApps = require("./appScanner");
let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: true,
    frame: false,
    icon: path.join(__dirname, "../../assets/tray.png"),
    transparent: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.webContents.openDevTools();

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

ipcMain.on("launch-app", (event, appPath) => {
  console.log("Launching: ", appPath);
  exec(`"${appPath}"`, (error) => {
    if (error) {
      console.log("Error launching app: ", error);
    }
  });
});

const appsFile = path.join(__dirname, "../../data/apps.json");
ipcMain.on("add-web-app", (event, newApp) => {
  const apps = JSON.parse(fs.readFileSync(appsFile));
  apps.push(newApp);
  fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2));
});

// ipcMain.handle("scan-apps", async () => {
//   const apps = await scanApps();
//   fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2));
//   return apps;
// });

// const appsFile = path.join(__dirname, "../../data/apps.json");
ipcMain.handle("get-apps", async () => {
  const systemApps = await scanApps();
  // console.log(systemApps);
  const userApps = JSON.parse(fs.readFileSync(appsFile));
  // console.log(userApps);

  return [...systemApps, ...userApps];
});

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("Control+Space", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray = new Tray(path.join(__dirname, "../../assets/tray.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open DeskHub",
      click: () => mainWindow.show(),
    },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("DeskHub");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
