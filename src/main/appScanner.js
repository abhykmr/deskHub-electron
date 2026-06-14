const fs = require("fs");
const path = require("path");
const ws = require("windows-shortcuts");
const extractIcon = require("extract-file-icon");
const WinReg = require("winreg");
const { exec } = require("child_process");
const { pathToFileURL } = require("url");

/*
------------------------------------------------
Hidden App Detection
------------------------------------------------
*/

const HIDDEN_KEYWORDS = [
  "uninstall",
  "update",
  "updater",
  "install",
  "compiler",
  "readme",
  "documentation",
  "license",
  "changelog",
  "help",
];

function isHidden(name) {
  const lower = name.toLowerCase();
  return HIDDEN_KEYWORDS.some((k) => lower.includes(k));
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, "-").trim();
}

function getIconUrl(target, name, iconDir) {
  if (!iconDir) return null;

  const safeName = sanitizeFileName(name);
  if (!safeName) return null;

  const iconPath = path.join(iconDir, safeName + ".png");

  try {
    fs.mkdirSync(iconDir, { recursive: true });

    const hasValidCachedIcon =
      fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0;

    if (!hasValidCachedIcon) {
      if (fs.existsSync(iconPath)) {
        fs.unlinkSync(iconPath);
      }

      const iconBuffer = extractIcon(target, 32);

      if (!iconBuffer || !iconBuffer.length) {
        return null;
      }

      fs.writeFileSync(iconPath, iconBuffer);
    }

    if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
      return null;
    }

    return pathToFileURL(iconPath).href;
  } catch {
    return null;
  }
}

function expandEnvironmentVariables(value) {
  return value.replace(/%([^%]+)%/g, (match, name) => process.env[name] || match);
}

function stripQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function resolveExecutablePath(value) {
  if (!value || typeof value !== "string") return null;

  let cleanedValue = value.trim();
  if (!cleanedValue) return null;

  cleanedValue = expandEnvironmentVariables(cleanedValue);

  if (cleanedValue.startsWith('"')) {
    const quotedPath = cleanedValue.match(/^"([^"]+)"/);
    return quotedPath ? quotedPath[1] : null;
  }

  const executableMatch = cleanedValue.match(/^(.+?\.(?:exe|msc|cpl|bat|cmd|com|url|lnk|chm|html?|txt))/i);
  if (executableMatch) {
    return stripQuotes(executableMatch[1].trim());
  }

  return stripQuotes(cleanedValue);
}

function isLaunchableDesktopPath(value) {
  const resolvedPath = resolveExecutablePath(value);
  return Boolean(resolvedPath && fs.existsSync(resolvedPath));
}

/*
------------------------------------------------
Shortcut Parser
------------------------------------------------
*/

function queryShortcut(file) {
  return new Promise((resolve) => {
    ws.query(file, (err, shortcut) => {
      if (shortcut && shortcut.target) resolve(shortcut.target);
      else resolve(null);
    });
  });
}

/*
------------------------------------------------
Start Menu Scanner
------------------------------------------------
*/

async function scanStartMenu(iconDir) {
  const startMenus = [
    path.join(process.env.APPDATA, "Microsoft/Windows/Start Menu/Programs"),
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  ];

  const apps = [];

  async function scanFolder(folder) {
    let items;

    try {
      items = fs.readdirSync(folder);
    } catch {
      return;
    }

    for (const item of items) {
      const fullPath = path.join(folder, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        await scanFolder(fullPath);
        continue;
      }

      if (!item.endsWith(".lnk")) continue;

      const target = await queryShortcut(fullPath);
      const launchPath = resolveExecutablePath(target);
      if (!launchPath) continue;
      if (!fs.existsSync(launchPath)) continue;

      const name = item.replace(".lnk", "");

      apps.push({
        name,
        path: launchPath,
        icon: getIconUrl(launchPath, name, iconDir),
        type: "desktop",
        hidden: isHidden(name),
      });
    }
  }

  for (const folder of startMenus) {
    await scanFolder(folder);
  }

  return apps;
}

/*
------------------------------------------------
Registry Scanner
------------------------------------------------
*/

function scanRegistryHive(hive) {
  return new Promise((resolve) => {
    const regKey = new WinReg({
      hive,
      key: "\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    });

    regKey.keys((err, items) => {
      if (err || !items) return resolve([]);

      const apps = [];
      let pending = items.length;

      if (!pending) return resolve([]);

      items.forEach((key) => {
        key.values((err, values) => {
          const name = values.find((v) => v.name === "DisplayName");
          const icon = values.find((v) => v.name === "DisplayIcon");

          if (name && icon) {
            const exe = resolveExecutablePath(icon.value);

            if (!isLaunchableDesktopPath(exe)) {
              pending--;
              if (pending === 0) resolve(apps);
              return;
            }

            apps.push({
              name: name.value,
              path: exe,
              icon: null,
              type: "desktop",
              hidden: isHidden(name.value),
            });
          }

          pending--;
          if (pending === 0) resolve(apps);
        });
      });
    });
  });
}

async function scanRegistry() {
  const hklm = await scanRegistryHive(WinReg.HKLM);
  const hkcu = await scanRegistryHive(WinReg.HKCU);

  return [...hklm, ...hkcu];
}

/*
------------------------------------------------
UWP Apps Scanner
------------------------------------------------
*/

function scanUWPApps() {
  return new Promise((resolve) => {
    exec('powershell "Get-StartApps | ConvertTo-Json"', (err, stdout) => {
      if (err) return resolve([]);

      try {
        const parsed = JSON.parse(stdout);

        const apps = parsed.map((app) => ({
          name: app.Name,
          path: `shell:AppsFolder\\${app.AppID}`,
          icon: null,
          type: "uwp",
          hidden: false,
        }));

        resolve(apps);
      } catch {
        resolve([]);
      }
    });
  });
}

/*
------------------------------------------------
Deduplicate
------------------------------------------------
*/

function deduplicate(apps) {
  const seen = new Set();

  return apps.filter((app) => {
    const key = (app.path || app.name).toLowerCase();
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/*
------------------------------------------------
Main Scanner (Progressive)
------------------------------------------------
*/

async function scanApps(onUpdate, options = {}) {
  let collected = [];

  const startMenuApps = await scanStartMenu(options.iconDir);
  collected = [...collected, ...startMenuApps];
  onUpdate(deduplicate(collected));

  const registryApps = await scanRegistry();
  collected = [...collected, ...registryApps];
  onUpdate(deduplicate(collected));

  const uwpApps = await scanUWPApps();
  collected = [...collected, ...uwpApps];

  const finalApps = deduplicate(collected);

  onUpdate(finalApps);

  return finalApps;
}

module.exports = scanApps;
