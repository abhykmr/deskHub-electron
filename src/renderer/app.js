const dock = document.getElementById("dock");

fetch("../../data/apps.json")
  .then((res) => res.json())
  .then((apps) => {
    apps.forEach((app) => {
      console.log("Loaded app: ", app);
      const item = document.createElement("div");
      item.className = "dock-item";
      const icon = document.createElement("img");
      icon.src = "../../assets/" + app.icon;

      item.appendChild(icon);

      item.onclick = () => {
        console.log("Clicked: ", app);
        if (app.type === "web") {
          window.open(app.url);
        } else {
          console.log("Clicked:", app);
          console.log("Sending path:", app.path);

          window.api.launchApp(app.path);
        }
      };
      dock.appendChild(item);
    });
    const addButton = document.createElement("div");
    addButton.className = "dock-item";

    const plus = document.createElement("img");
    plus.src = "../../assets/add.png";

    addButton.appendChild(plus);

    const modal = document.getElementById("addModal");
    const saveBtn = document.getElementById("saveApp");
    const cancelBtn = document.getElementById("cancelApp");

    addButton.onclick = () => {
      modal.classList.remove("hidden");
    };

    saveBtn.onclick = () => {
      const name = document.getElementById("appName").value;
      const url = document.getElementById("appURL").value;

      if (!name || !url) {
        alert("Please fill all fields");
        return;
      }

      const newApp = {
        name: name,
        type: "web",
        url: url,
        icon: name + ".png",
      };

      window.api.addWebApp(newApp);

      name.value = "";
      url.value = "";
      modal.classList.add("hidden");
    };
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
    };
    dock.appendChild(addButton);
  });
