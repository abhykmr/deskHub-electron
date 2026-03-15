const grid = document.getElementById("appGrid");
const searchInput = document.getElementById("searchInput");

const addButton = document.getElementById("addButton");
const modal = document.getElementById("addModal");
const saveBtn = document.getElementById("saveApp");
const cancelBtn = document.getElementById("cancelApp");

let allApps = [];

addButton.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

cancelBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

saveBtn.addEventListener("click", () => {
  const nameInput = document.getElementById("appName");
  const urlInput = document.getElementById("appURL");

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    alert("Please fill all fields");
    return;
  }

  const newApp = {
    name: name,
    type: "web",
    url: url,
  };

  window.api.addWebApp(newApp);

  modal.classList.add("hidden");

  nameInput.value = "";
  urlInput.value = "";

  loadApps();
});

window.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("searchInput");
  if (search) search.focus();
});

async function loadApps() {
  const apps = await window.api.getApps();
  // console.log("Apps received:", apps);

  allApps = apps;

  renderApps(apps);
}

function renderApps(apps) {
  grid.innerHTML = "";

  apps.forEach((app) => {
    const item = document.createElement("div");
    item.className = "app-item";

    const icon = document.createElement("img");
    if (app.icon) {
      icon.src = "../../assets/icons/" + app.icon;
    } else {
      icon.src = "../../assets/tray.png";
    }
    const label = document.createElement("span");
    label.textContent = app.name;

    item.appendChild(icon);
    item.appendChild(label);

    item.onclick = () => {
      if (app.type === "web") {
        window.open(app.url);
      } else {
        window.api.launchApp(app.path);
      }
    };

    grid.appendChild(item);
  });
}

/* Search */

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();

  if (query === "") {
    renderApps(allApps);
    return;
  }

  const filtered = allApps.filter((app) =>
    app.name.toLowerCase().includes(query),
  );

  renderApps(filtered);
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

document.getElementById("appURL").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveBtn.click();
  }
});

loadApps();
