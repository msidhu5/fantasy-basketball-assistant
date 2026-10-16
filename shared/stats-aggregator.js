import {
  CATEGORIES,
  COUNTING_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  LOWER_IS_BETTER,
  STRENGTH_Z_THRESHOLD,
  DRAFTABLE_POOL_SIZE,
} from "./constants.js";

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values, avg) {
  if (values.length === 0) return 0;
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

/**
 * The top N players by projection-file rank - the "draftable" pool. Used as the
 * z-score baseline so category values are calibrated against players who will
 * actually be rostered, not against the long tail of the file. Entries without an
 * uploadOrder (hand-added, legacy) sort last rather than being dropped.
 */
export function draftablePool(projectionsMap, size = DRAFTABLE_POOL_SIZE) {
  const entries = Object.entries(projectionsMap);
  if (!Number.isFinite(size) || size <= 0 || entries.length <= size) return projectionsMap;

  entries.sort((a, b) => (a[1].uploadOrder ?? Infinity) - (b[1].uploadOrder ?? Infinity));
  return Object.fromEntries(entries.slice(0, size));
}

export function categoryDistribution(projectionsMap, category) {
  const values = Object.values(projectionsMap).map((p) => p[category] ?? 0);
  const avg = mean(values);
  const sd = stdev(values, avg);
  return { mean: avg, stdev: sd };
}

/**
 * Aggregates the user's rostered (matched) players' projected stats.
 *
 * Returns BOTH shapes, because they differ by category type and conflating them
 * caused a real bug: counting stats accumulate as sums, but percentages only make
 * sense as a mean, so `totals.FGPCT` is already an average. Callers that divided
 * `totals` by playerCount to "get a per-player value" therefore double-divided the
 * percentages, tanking FG%/FT% to ~1/10th of reality (z-scores of -6 to -9, i.e.
 * permanently "weak", which then ~5x-overweighted those categories in suggestions).
 *
 * Use `perPlayer` for anything comparing against a per-player distribution
 * (z-scores, UI "avg" columns). Use `totals` only to display accumulated counting
 * stats. Never divide either one again.
 */
export function computeTeamTotals(myRoster, projectionsMap) {
  const myPlayers = myRoster
    .filter((entry) => entry.matchedProjectionKey)
    .map((entry) => projectionsMap[entry.matchedProjectionKey])
    .filter(Boolean);

  const totals = {};
  const perPlayer = {};
  const count = myPlayers.length;

  for (const cat of COUNTING_CATEGORIES) {
    const sum = myPlayers.reduce((acc, p) => acc + (p[cat] ?? 0), 0);
    totals[cat] = sum;
    perPlayer[cat] = count > 0 ? sum / count : 0;
  }
  for (const cat of PERCENTAGE_CATEGORIES) {
    const avg = count > 0 ? mean(myPlayers.map((p) => p[cat] ?? 0)) : 0;
    totals[cat] = avg;
    perPlayer[cat] = avg;
  }

  return { totals, perPlayer, playerCount: count, players: myPlayers };
}

/**
 * Computes per-category z-score of the team's per-player average against the
 * distribution of the full uploaded projections pool (best available league-wide proxy).
 * puntedCategories: categories the user has deliberately given up on - the real
 * z-score is still computed and returned (useful context: "yes, we know we're bad
 * here"), but `rank` is forced to "punted" instead of strong/weak/neutral so nothing
 * downstream treats it as an actionable weakness to chase.
 */
export function computeStrengthWeakness(teamTotals, projectionsMap, puntedCategories = []) {
  const result = {};
  const puntedSet = new Set(puntedCategories);

  // With no rostered players yet, "average per player" has no real signal (it's
  // literally 0/1), which would otherwise read as catastrophically "weak" in every
  // counting/percentage category and falsely "strong" in TO. Report neutral instead
  // so suggestions reduce to a plain value ranking until at least one pick exists.
  if (teamTotals.playerCount === 0) {
    for (const cat of CATEGORIES) {
      result[cat] = { zScore: 0, rank: puntedSet.has(cat) ? "punted" : "neutral" };
    }
    return result;
  }

  for (const cat of CATEGORIES) {
    const { mean: poolMean, stdev: poolStdev } = categoryDistribution(projectionsMap, cat);
    // Already per-player for BOTH counting and percentage cats - do not divide again.
    const teamPerPlayerAvg = teamTotals.perPlayer[cat] ?? 0;
    let z = poolStdev === 0 ? 0 : (teamPerPlayerAvg - poolMean) / poolStdev;
    if (LOWER_IS_BETTER.has(cat)) z = -z;

    let rank = "neutral";
    if (z > STRENGTH_Z_THRESHOLD) rank = "strong";
    else if (z < -STRENGTH_Z_THRESHOLD) rank = "weak";
    if (puntedSet.has(cat)) rank = "punted";

    result[cat] = { zScore: z, rank };
  }

  return result;
}
