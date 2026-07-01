function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

function renderTags(listId, items, storageKey) {
  const el = document.getElementById(listId);
  el.innerHTML = "";
  items.forEach((item, i) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `<span>${item}</span><span class="remove" data-i="${i}">×</span>`;
    tag.querySelector(".remove").addEventListener("click", async () => {
      items.splice(i, 1);
      await chrome.storage.local.set({ [storageKey]: items });
      renderTags(listId, items, storageKey);
      updateStats();
    });
    el.appendChild(tag);
  });
}

async function loadAll() {
  const r = await chrome.storage.local.get(["whitelist", "blacklist", "totalBlocked"]);
  const wl = r.whitelist || [];
  const bl = r.blacklist || [];
  renderTags("wlList", wl, "whitelist");
  renderTags("blList", bl, "blacklist");
  updateStats();
}

async function updateStats() {
  const r = await chrome.storage.local.get(["whitelist", "blacklist", "totalBlocked"]);
  document.getElementById("statTotal").textContent = r.totalBlocked || 0;
  document.getElementById("statWl").textContent = (r.whitelist || []).length;
  document.getElementById("statBl").textContent = (r.blacklist || []).length;
}

document.getElementById("addWl").addEventListener("click", async () => {
  const val = document.getElementById("wlInput").value.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "");
  if (!val) return;
  const r = await chrome.storage.local.get("whitelist");
  const wl = r.whitelist || [];
  if (!wl.includes(val)) { wl.push(val); await chrome.storage.local.set({ whitelist: wl }); }
  document.getElementById("wlInput").value = "";
  renderTags("wlList", wl, "whitelist");
  updateStats();
  showToast(`${val} added to whitelist`);
});

document.getElementById("addBl").addEventListener("click", async () => {
  const val = document.getElementById("blInput").value.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "");
  if (!val) return;
  const r = await chrome.storage.local.get("blacklist");
  const bl = r.blacklist || [];
  if (!bl.includes(val)) { bl.push(val); await chrome.storage.local.set({ blacklist: bl }); }
  document.getElementById("blInput").value = "";
  renderTags("blList", bl, "blacklist");
  updateStats();
  showToast(`${val} added to block list`);
});

document.getElementById("resetStats").addEventListener("click", async () => {
  if (confirm("Reset all statistics? This cannot be undone.")) {
    await chrome.storage.local.set({ totalBlocked: 0 });
    updateStats();
    showToast("Statistics reset");
  }
});

loadAll();
