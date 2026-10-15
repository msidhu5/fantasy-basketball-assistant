import {
  resolveRosterTable,
  resolveRosterRows,
  isEmptySlotRow,
  extractPlayerNameFromRow,
  extractPositionSlotFromRow,
} from "./selectors.js";

/**
 * Scrapes the currently-mounted "My Roster" table (if any - the panel may be
 * unmounted if the user is on a different tab, e.g. Available Players).
 * Returns [] when the table isn't present rather than throwing, since that's
 * an expected, recoverable state, not an error.
 */
export function scrapeMyRoster(root = document) {
  const table = resolveRosterTable(root);
  if (!table) return [];

  const rows = resolveRosterRows(table);
  const players = [];
  for (const row of rows) {
    if (isEmptySlotRow(row)) continue;
    const playerNameRaw = extractPlayerNameFromRow(row);
    if (!playerNameRaw) continue;
    players.push({
      playerNameRaw,
      positionSlot: extractPositionSlotFromRow(row),
    });
  }
  return players;
}
