const fs = require("fs");
const path = require("path");
const ws = require("windows-shortcuts");
const extractIcon = require("extract-file-icon");
const WinReg = require("winreg");
const { exec } = require("child_process");

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

async function scanStartMenu() {
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
      if (!target) continue;
      if (!fs.existsSync(target)) continue;

      const name = item.replace(".lnk", "");

      const iconName = name + ".png";
      const iconPath = path.join(__dirname, "../../assets/icons", iconName);

      try {
        if (!fs.existsSync(iconPath)) {
          const iconBuffer = extractIcon(target, 32);
          fs.writeFileSync(iconPath, iconBuffer);
        }
      } catch {}

      apps.push({
        name,
        path: target,
        icon: iconName,
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
            let exe = icon.value;

            if (exe.includes(",")) exe = exe.split(",")[0];

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

async function scanApps(onUpdate) {
  let collected = [];

  const startMenuApps = await scanStartMenu();
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
