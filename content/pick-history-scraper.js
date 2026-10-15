import { resolvePickHistoryRows, extractPlayerNameFromRow } from "./selectors.js";

/**
 * Scrapes every pick currently visible in the Pick History panel (all rounds
 * present in the DOM, not just the one the user happens to be viewing), purely
 * to know who's been drafted by ANYONE - used internally to filter suggestions,
 * not surfaced as its own view. Team/round aren't extracted since only the
 * player identity is needed for that purpose.
 */
export function scrapePickHistory(root = document) {
  const rows = resolvePickHistoryRows(root);
  const picks = [];
  for (const row of rows) {
    const playerNameRaw = extractPlayerNameFromRow(row);
    if (!playerNameRaw) continue;
    picks.push({ playerNameRaw });
  }
  return picks;
}
