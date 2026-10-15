/**
 * Reconciles the currently-stored roster against a freshly scraped snapshot.
 * Pure function (no chrome.storage access) so it can run as a single atomic
 * read-modify-write in the background, and be unit tested directly.
 *
 * - New players (by normalized name) get added, name-matched against projections.
 * - Existing players get their positionSlot refreshed if the live scrape disagrees
 *   (self-corrects a bad/empty value captured during a transient render earlier).
 * - Players no longer present in the scrape are left untouched (the roster only
 *   grows/corrects here - removal is an explicit user action, not implied by a
 *   momentary absence, e.g. a panel that's mid-re-render).
 */
export function reconcileRoster(currentRoster, scrapedPlayers, projectionsMap, normalizeNameFn, matchFn, now = Date.now()) {
  const next = currentRoster.map((entry) => ({ ...entry }));

  for (const scraped of scrapedPlayers) {
    const normalized = normalizeNameFn(scraped.playerNameRaw);
    const existingIdx = next.findIndex((entry) => entry.playerNameNormalized === normalized);

    if (existingIdx === -1) {
      const matchResult = matchFn(scraped.playerNameRaw, projectionsMap);
      next.push({
        playerNameRaw: scraped.playerNameRaw,
        playerNameNormalized: normalized,
        positionSlot: scraped.positionSlot ?? null,
        matchedProjectionKey: matchResult.key,
        timestampDetected: now,
        source: "observer",
      });
    } else if (scraped.positionSlot && next[existingIdx].positionSlot !== scraped.positionSlot) {
      next[existingIdx].positionSlot = scraped.positionSlot;
    }
  }

  return next;
}
