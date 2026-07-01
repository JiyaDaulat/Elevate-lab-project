// ─── TrackShield Background Service Worker ───────────────────────────────────
// Runs persistently, tracks blocked requests per tab, manages whitelist/blacklist

const TRACKER_DOMAINS = [
  "google-analytics.com","googletagmanager.com","doubleclick.net",
  "facebook.com/tr","connect.facebook.net","hotjar.com","mixpanel.com",
  "segment.io","segment.com","amplitude.com","fullstory.com","heap.io",
  "intercom.io","intercom.com","ads-twitter.com","linkedin.com/analytics",
  "snap.licdn.com","scorecardresearch.com","quantserve.com","chartbeat.com",
  "newrelic.com","clarity.ms","mouseflow.com","crazyegg.com","luckyorange.com",
  "inspectlet.com","onetrust.com","advertising.com","outbrain.com","taboola.com",
  "criteo.com","criteo.net","adnxs.com","rubiconproject.com","pubmatic.com",
  "openx.net","moatads.com","amazon-adsystem.com"
];

// In-memory store: { tabId: { count, blockedList, domain } }
let tabStats = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function isTrackerDomain(url) {
  const host = getDomain(url);
  return TRACKER_DOMAINS.some(d => host === d || host.endsWith("." + d));
}

async function getWhitelist() {
  const r = await chrome.storage.local.get("whitelist");
  return r.whitelist || [];
}

async function getBlacklist() {
  const r = await chrome.storage.local.get("blacklist");
  return r.blacklist || [];
}

async function isWhitelisted(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return false;
  const domain = getDomain(tab.url);
  const wl = await getWhitelist();
  return wl.includes(domain);
}

function updateBadge(tabId) {
  const stats = tabStats[tabId];
  if (!stats) return;
  const count = stats.count;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#e74c3c", tabId });
}

// ─── Listen to web navigation to reset counts per page ────────────────────────

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
  if (frameId !== 0) return;
  tabStats[tabId] = { count: 0, blockedList: [] };
  chrome.action.setBadgeText({ text: "", tabId });
});

chrome.tabs.onRemoved.addListener(tabId => {
  delete tabStats[tabId];
});

// ─── Content script sends a message each time a tracker is blocked ─────────────

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type !== "TRACKER_BLOCKED") return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  // Skip if the site is whitelisted
  if (await isWhitelisted(tabId)) return;

  if (!tabStats[tabId]) tabStats[tabId] = { count: 0, blockedList: [] };

  tabStats[tabId].count++;
  if (!tabStats[tabId].blockedList.includes(msg.domain)) {
    tabStats[tabId].blockedList.push(msg.domain);
  }

  updateBadge(tabId);

  // Persist total blocked count globally
  const r = await chrome.storage.local.get("totalBlocked");
  const total = (r.totalBlocked || 0) + 1;
  chrome.storage.local.set({ totalBlocked: total });
});

// ─── Popup asks for stats ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATS") {
    const tabId = msg.tabId;
    const stats = tabStats[tabId] || { count: 0, blockedList: [] };
    chrome.storage.local.get(["totalBlocked", "whitelist", "blacklist"], (r) => {
      sendResponse({
        tabCount: stats.count,
        blockedList: stats.blockedList,
        totalBlocked: r.totalBlocked || 0,
        whitelist: r.whitelist || [],
        blacklist: r.blacklist || []
      });
    });
    return true; // keep channel open for async response
  }
});
