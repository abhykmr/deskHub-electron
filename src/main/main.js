const { app, BrowserWindow, Tray, Menu, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: true,
    // icon: "tray.png",
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // mainWindow.webContents.openDevTools();

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

app.whenReady().then(() => {
  createWindow();

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
    mainWindow.isVisible() ? mainWindow.hide : mainWindow.show();
  });
});
