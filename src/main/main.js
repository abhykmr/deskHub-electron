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
const { execFile } = require("child_process");

const scanApps = require("./appScanner");
const { getFavicon, normalizeWebUrl } = require("../utils/iconFetcher");

let mainWindow;
let tray;
let cachedSystemApps = [];

function getUserAppsFile() {
  return path.join(app.getPath("userData"), "apps.json");
}

function getUserIconsDir() {
  return path.join(app.getPath("userData"), "icons");
}

function readUserApps() {
  try {
    const appsFile = getUserAppsFile();
    const apps = JSON.parse(fs.readFileSync(appsFile, "utf-8"));
    return Array.isArray(apps) ? apps : [];
  } catch {
    return [];
  }
}

function writeUserApps(apps) {
  const appsFile = getUserAppsFile();

  fs.mkdirSync(path.dirname(appsFile), { recursive: true });
  fs.writeFileSync(appsFile, JSON.stringify(apps, null, 2), "utf-8");
}

function isWindowsShellTarget(appPath) {
  return /^shell:/i.test(appPath);
}

function expandEnvironmentVariables(value) {
  return value.replace(/%([^%]+)%/g, (match, name) => process.env[name] || match);
}

function launchWithExplorer(appPath) {
  return new Promise((resolve) => {
    execFile("explorer.exe", [appPath], (error) => {
      resolve(error ? error.message : "");
    });
  });
}

async function launchAppPath(appPath) {
  if (!appPath || typeof appPath !== "string") {
    return "Invalid app path";
  }

  if (isWindowsShellTarget(appPath)) {
    return launchWithExplorer(appPath);
  }

  const resolvedPath = expandEnvironmentVariables(appPath);

  if (!fs.existsSync(resolvedPath)) {
    return "App path no longer exists";
  }

  return shell.openPath(resolvedPath);
}

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

  // // Open DevTools only in development
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

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
  const result = await launchAppPath(appPath);

  console.log("Launch result:", result);

  if (result) {
    console.log("Error launching app:", result);
  }

  return result;
});

ipcMain.handle("open-web-app", async (event, url) => {
  let normalizedUrl;

  try {
    normalizedUrl = normalizeWebUrl(url || "");
  } catch (error) {
    return error.message;
  }

  await shell.openExternal(normalizedUrl);
  return "";
});

/*
------------------------------------------------
Add Web App
------------------------------------------------
*/
ipcMain.handle("add-web-app", async (event, newApp) => {
  const name = typeof newApp.name === "string" ? newApp.name.trim() : "";

  if (!name) {
    return { ok: false, error: "App name is required" };
  }

  let url;

  try {
    url = normalizeWebUrl(newApp.url || "");
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const apps = readUserApps();

  // 🔥 Add favicon here
  const icon = getFavicon(url);

  const appWithIcon = {
    name,
    type: "web",
    url,
    icon,
  };

  apps.push(appWithIcon);

  writeUserApps(apps);

  return { ok: true, app: appWithIcon };
});

/*
------------------------------------------------
Get Apps (system + user)
------------------------------------------------
*/

ipcMain.handle("get-apps", async () => {
  const userApps = readUserApps();

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

  scanApps(
    (apps) => {
      cachedSystemApps = apps;

      if (mainWindow) {
        mainWindow.webContents.send("apps-updated", cachedSystemApps);
      }
    },
    { iconDir: getUserIconsDir() },
  );

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
