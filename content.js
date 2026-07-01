// ─── TrackShield Content Script ──────────────────────────────────────────────
// Runs on every page, intercepts script injections via MutationObserver
// and reports blocked trackers back to the background worker

const TRACKER_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /facebook\.net\/en_US\/fbevents/i,
  /facebook\.com\/tr/i,
  /hotjar\.com/i,
  /mixpanel\.com/i,
  /segment\.io/i,
  /segment\.com\/analytics/i,
  /amplitude\.com/i,
  /fullstory\.com/i,
  /heap\.io/i,
  /intercom\.io/i,
  /intercom\.com/i,
  /ads-twitter\.com/i,
  /scorecardresearch\.com/i,
  /quantserve\.com/i,
  /chartbeat\.com/i,
  /clarity\.ms/i,
  /mouseflow\.com/i,
  /crazyegg\.com/i,
  /luckyorange\.com/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /criteo\.com/i,
  /criteo\.net/i,
  /adnxs\.com/i,
  /amazon-adsystem\.com/i,
  /newrelic\.com/i
];

function isTrackerUrl(url) {
  if (!url) return false;
  return TRACKER_PATTERNS.some(p => p.test(url));
}

function reportBlocked(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    chrome.runtime.sendMessage({ type: "TRACKER_BLOCKED", domain, url });
  } catch {}
}

// Override createElement to catch dynamically injected scripts
const _createElement = document.createElement.bind(document);
document.createElement = function(tag, ...args) {
  const el = _createElement(tag, ...args);
  if (tag.toLowerCase() === "script") {
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
    let _src = "";
    Object.defineProperty(el, "src", {
      get() { return srcDesc.get.call(this); },
      set(val) {
        if (isTrackerUrl(val)) {
          reportBlocked(val);
          // Return without actually setting src — effectively blocks it
          return;
        }
        srcDesc.set.call(this, val);
      },
      configurable: true
    });
  }
  return el;
};

// MutationObserver: catches scripts added directly to DOM
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.tagName === "SCRIPT" && node.src && isTrackerUrl(node.src)) {
        node.remove();
        reportBlocked(node.src);
      }
      if (node.tagName === "IMG" && node.src && isTrackerUrl(node.src)) {
        node.src = ""; // kill pixel trackers
        reportBlocked(node.src);
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
