import { resolvePickHistoryRows, extractPlayerNameFromRow, extractTeamNameFromRow } from "./selectors.js";

/**
 * Scrapes every pick currently visible in the Pick History panel (all rounds
 * present in the DOM, not just the one the user happens to be viewing). Used both
 * to know who's been drafted by ANYONE (availability filtering) and to group picks
 * by drafting team for the category standings.
 */
export function scrapePickHistory(root = document) {
  const rows = resolvePickHistoryRows(root);
  const picks = [];
  for (const row of rows) {
    const playerNameRaw = extractPlayerNameFromRow(row);
    if (!playerNameRaw) continue;
    picks.push({ playerNameRaw, teamNameRaw: extractTeamNameFromRow(row) });
  }
  return picks;
}
