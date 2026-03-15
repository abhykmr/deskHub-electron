const fs = require("fs");
const path = require("path");
const ws = require("windows-shortcuts");
const extractIcon = require("extract-file-icon");

function queryShortcut(file) {
  return new Promise((resolve) => {
    ws.query(file, (err, shortcut) => {
      if (shortcut && shortcut.target) {
        resolve(shortcut.target);
      } else {
        resolve(null);
      }
    });
  });
}

async function scanApps() {
  const startMenu = "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs";

  let apps = [];

  async function scanFolder(folder) {
    const items = fs.readdirSync(folder);

    for (const item of items) {
      const fullPath = path.join(folder, item);

      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        await scanFolder(fullPath);
        continue;
      }

      if (item.endsWith(".lnk")) {
        const target = await queryShortcut(fullPath);

        const iconName = item.replace(".lnk", "") + ".png";

        const iconPath = path.join(__dirname, "../../assets/icons", iconName);

        try {
          const iconBuffer = extractIcon(target, 32);

          fs.writeFileSync(iconPath, iconBuffer);
        } catch (e) {
          console.log("Icon extraction failed for:", target);
        }

        apps.push({
          name: item.replace(".lnk", ""),
          path: target,
          type: "desktop",
          icon: iconName,
        });
      }
    }
  }

  await scanFolder(startMenu);

  return apps;
}

module.exports = scanApps;
