const grid = document.getElementById("appGrid");
const searchInput = document.getElementById("searchInput");

const addButton = document.getElementById("addButton");
const modal = document.getElementById("addModal");
const saveBtn = document.getElementById("saveApp");
const cancelBtn = document.getElementById("cancelApp");

const nameInput = document.getElementById("appName");
const urlInput = document.getElementById("appURL");

let allApps = [];
let filteredApps = [];
let selectedIndex = 0;

/*
------------------------------------------------
Modal Controls
------------------------------------------------
*/

addButton.addEventListener("click", () => {
  modal.classList.remove("hidden");
  nameInput.focus();
});

cancelBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

/*
------------------------------------------------
Save Web App
------------------------------------------------
*/

saveBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    alert("Please fill all fields");
    return;
  }

  const newApp = {
    name,
    type: "web",
    url,
  };

  window.api.addWebApp(newApp);

  modal.classList.add("hidden");

  nameInput.value = "";
  urlInput.value = "";

  loadApps();
});

/*
------------------------------------------------
Load Apps (initial load)
------------------------------------------------
*/

async function loadApps() {
  grid.innerHTML = "<p>Loading apps...</p>";

  const apps = await window.api.getApps();

  allApps = apps;

  applyFilter();
}

/*
------------------------------------------------
Progressive Updates From Main Process
------------------------------------------------
*/

window.api.onAppsUpdated((apps) => {
  allApps = apps;
  applyFilter();
});

/*
------------------------------------------------
Filtering Logic
------------------------------------------------
*/

function applyFilter() {
  const query = searchInput.value.toLowerCase();

  if (!query) {
    // When no search → hide hidden apps
    filteredApps = allApps.filter((app) => !app.hidden);
  } else {
    // When searching → include hidden apps
    filteredApps = allApps.filter((app) =>
      app.name.toLowerCase().includes(query),
    );
  }

  selectedIndex = 0;

  renderApps(filteredApps);
}

/*
------------------------------------------------
Render Apps
------------------------------------------------
*/

function renderApps(apps) {
  grid.innerHTML = "";

  if (!apps.length) {
    grid.innerHTML = "<p>No apps found</p>";
    return;
  }

  apps.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "app-item";

    if (index === selectedIndex) {
      item.classList.add("selected");
    }

    const icon = document.createElement("img");

    icon.src = app.icon
      ? `../../assets/icons/${app.icon}`
      : "../../assets/tray.png";

    icon.onerror = () => {
      icon.src = "../../assets/tray.png";
    };

    const label = document.createElement("span");
    label.textContent = app.name;

    item.appendChild(icon);
    item.appendChild(label);

    item.onclick = () => launchApp(app);

    grid.appendChild(item);
  });
}

/*
------------------------------------------------
Launch App
------------------------------------------------
*/

function launchApp(app) {
  if (app.type === "web") {
    window.open(app.url);
  } else {
    window.api.launchApp(app.path);
  }
}

/*
------------------------------------------------
Search
------------------------------------------------
*/

searchInput.addEventListener("input", () => {
  applyFilter();
});

/*
------------------------------------------------
Keyboard Navigation
------------------------------------------------
*/

document.addEventListener("keydown", (e) => {
  if (!filteredApps.length) return;

  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    selectedIndex = (selectedIndex + 1) % filteredApps.length;
    renderApps(filteredApps);
  }

  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    selectedIndex =
      (selectedIndex - 1 + filteredApps.length) % filteredApps.length;

    renderApps(filteredApps);
  }

  if (e.key === "Enter") {
    const app = filteredApps[selectedIndex];
    if (app) launchApp(app);
  }

  if (e.key === "Escape") {
    window.close();
  }
});

/*
------------------------------------------------
Modal Background Click
------------------------------------------------
*/

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

/*
------------------------------------------------
Modal Enter Key
------------------------------------------------
*/

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveBtn.click();
  }
});

/*
------------------------------------------------
Focus Search on Launch
------------------------------------------------
*/

window.addEventListener("DOMContentLoaded", () => {
  if (searchInput) {
    searchInput.focus();
  }
});

/*
------------------------------------------------
Start
------------------------------------------------
*/

loadApps();
