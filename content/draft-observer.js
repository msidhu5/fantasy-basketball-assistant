import { scrapeMyRoster } from "./roster-scraper.js";
import { scrapePickHistory } from "./pick-history-scraper.js";
import { resolveRosterTable } from "./selectors.js";

/**
 * Watches the draft room and calls onSnapshot with the FULL current state on
 * every scan: who's on my roster, and every pick visible in the Pick History
 * panel (any team, all rounds present in the DOM at once). Reconciliation
 * against persisted state happens in the background, not here - this has no
 * "already seen" memory of its own to go stale or get permanently stuck.
 *
 * The roster panel specifically may be a tab that unmounts entirely when the
 * user is looking at Available Players instead, so this both observes DOM
 * mutations (for when visible panels update) and polls on an interval (to
 * catch a panel reappearing after a tab switch - MutationObserver alone won't
 * fire for a remount it wasn't attached under).
 */
export function startObserving(onSnapshot, { debounceMs = 200, pollMs = 3000, onScan = null } = {}) {
  let timer = null;

  function scanAndEmit() {
    onScan?.(resolveRosterTable(document) != null);
    onSnapshot({
      myRosterPlayers: scrapeMyRoster(document),
      pickHistoryPlayers: scrapePickHistory(document),
    });
  }

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scanAndEmit, debounceMs);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const intervalId = setInterval(scanAndEmit, pollMs);
  scanAndEmit();

  return {
    rescan: scanAndEmit,
    stop: () => {
      observer.disconnect();
      clearInterval(intervalId);
    },
  };
}
