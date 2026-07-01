// Popup Script — talks to background, updates UI

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

async function loadStats() {
  const tab = await getCurrentTab();
  if (!tab) return;

  chrome.runtime.sendMessage({ type: "GET_STATS", tabId: tab.id }, (res) => {
    if (!res) return;

    // Badge count
    document.getElementById("tabCount").textContent = res.tabCount;
    document.getElementById("totalCount").textContent = res.totalBlocked;

    // Blocked list
    const listEl = document.getElementById("blockedList");
    const emptyEl = document.getElementById("emptyMsg");

    listEl.querySelectorAll(".tracker-item").forEach(e => e.remove());

    if (res.blockedList.length === 0) {
      emptyEl.style.display = "";
    } else {
      emptyEl.style.display = "none";
      res.blockedList.forEach(domain => {
        const item = document.createElement("div");
        item.className = "tracker-item";
        item.innerHTML = `
          <span class="tracker-name">${domain}</span>
          <span class="blocked-badge">BLOCKED</span>`;
        listEl.appendChild(item);
      });
    }

    // Whitelist button state
    const domain = getDomain(tab.url);
    const isWL = res.whitelist.includes(domain);
    const wlBtn = document.getElementById("whitelistBtn");
    wlBtn.textContent = isWL ? "Remove Whitelist" : "Whitelist Site";
    wlBtn.style.color = isWL ? "#f85149" : "";
  });
}

// Toggle pause/resume
document.getElementById("toggleBtn").addEventListener("click", async () => {
  const r = await chrome.storage.local.get("paused");
  const paused = !r.paused;
  await chrome.storage.local.set({ paused });

  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  const btn = document.getElementById("toggleBtn");

  if (paused) {
    dot.className = "dot paused";
    label.textContent = "Protection Paused";
    btn.textContent = "RESUME";
    btn.className = "toggle-btn off";
  } else {
    dot.className = "dot active";
    label.textContent = "Blocking Trackers";
    btn.textContent = "PAUSE";
    btn.className = "toggle-btn on";
  }
});

// Whitelist current site
document.getElementById("whitelistBtn").addEventListener("click", async () => {
  const tab = await getCurrentTab();
  const domain = getDomain(tab.url);
  const r = await chrome.storage.local.get("whitelist");
  let wl = r.whitelist || [];

  if (wl.includes(domain)) {
    wl = wl.filter(d => d !== domain);
    showToast("Removed from whitelist");
  } else {
    wl.push(domain);
    showToast(`${domain} whitelisted`);
  }

  await chrome.storage.local.set({ whitelist: wl });
  loadStats();
});

// Open options page
document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
document.getElementById("optionsLink").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Init
loadStats();
chrome.storage.local.get("paused", (r) => {
  if (r.paused) {
    document.getElementById("statusDot").className = "dot paused";
    document.getElementById("statusLabel").textContent = "Protection Paused";
    document.getElementById("toggleBtn").textContent = "RESUME";
    document.getElementById("toggleBtn").className = "toggle-btn off";
  }
});
