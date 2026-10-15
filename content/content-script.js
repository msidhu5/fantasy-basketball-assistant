(async () => {
  try {
    console.log("[Fantasy Basketball Assistant] content script bootstrapping...");
    const moduleUrl = chrome.runtime.getURL("content/main.js");
    const mod = await import(moduleUrl);
    mod.init();
    console.log("[Fantasy Basketball Assistant] content script initialized.");
  } catch (err) {
    console.error("[Fantasy Basketball Assistant] failed to initialize content script", err);
  }
})();
