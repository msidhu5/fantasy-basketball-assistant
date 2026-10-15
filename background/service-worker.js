import { routeMessage } from "./message-router.js";
import { loadProjections } from "./projections-loader.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  loadProjections().catch((err) => console.error("[Fantasy Basketball Assistant] projections load failed", err));
});

chrome.runtime.onStartup.addListener(() => {
  loadProjections().catch((err) => console.error("[Fantasy Basketball Assistant] projections load failed", err));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
  return true;
});
