const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  shell,
} = require("electron");

const path = require("path");
const fs = require("fs");

const scanApps = require("./appScanner");
const { getFavicon } = require("../utils/iconFetcher");

let mainWindow;
let tray;
let cachedSystemApps = [];

const appsFile = path.join(__dirname, "../../data/apps.json");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    center: true,
    show: true,
    frame: false,
    transparent: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../../assets/tray.png"),

    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Open DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Prevent closing → hide instead
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Hide launcher when focus lost (optional but nice UX)
  mainWindow.on("blur", () => {
    mainWindow.hide();
  });
}

/*
------------------------------------------------
Launch Desktop Apps
------------------------------------------------
*/

ipcMain.handle("launch-app", async (event, appPath) => {
  console.log("Launch request:", appPath);
  const result = await shell.openPath(appPath);

  console.log("Launch result:", result);

  if (result) {
    console.log("Error launching app:", result);
  }
});

/*
------------------------------------------------
Add Web App
------------------------------------------------
*/
ipcMain.on("add-web-app", (event, newApp) => {
  let apps = [];

  try {
    apps = JSON.parse(fs.readFileSync(appsFile));
  } catch {
    apps = [];
  }

  // 🔥 Add favicon here
  const icon = getFavicon(newApp.url);

  const appWithIcon = {
    ...newApp,
    icon,
  };

  apps.push(appWithIcon);

  fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2));
});

/*
------------------------------------------------
Get Apps (system + user)
------------------------------------------------
*/

ipcMain.handle("get-apps", async () => {
  let userApps = [];

  try {
    userApps = JSON.parse(fs.readFileSync(appsFile));
  } catch {
    userApps = [];
  }

  return [...cachedSystemApps, ...userApps];
});

/*
------------------------------------------------
App Ready
------------------------------------------------
*/

app.whenReady().then(async () => {
  createWindow();

  /*
  ---------------------------------------------
  Progressive App Scan
  ---------------------------------------------
  */

  scanApps((apps) => {
    cachedSystemApps = apps;

    if (mainWindow) {
      mainWindow.webContents.send("apps-updated", cachedSystemApps);
    }
  });

  /*
  ---------------------------------------------
  Global Shortcut
  ---------------------------------------------
  */

  globalShortcut.register("Control+Space", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  /*
  ---------------------------------------------
  System Tray
  ---------------------------------------------
  */

  tray = new Tray(path.join(__dirname, "../../assets/tray.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open DeskHub",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
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
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});
/*
------------------------------------------------
Cleanup
------------------------------------------------
*/

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
