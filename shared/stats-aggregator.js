import {
  CATEGORIES,
  COUNTING_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  LOWER_IS_BETTER,
  STRENGTH_Z_THRESHOLD,
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

export function categoryDistribution(projectionsMap, category) {
  const values = Object.values(projectionsMap).map((p) => p[category] ?? 0);
  const avg = mean(values);
  const sd = stdev(values, avg);
  return { mean: avg, stdev: sd };
}

/**
 * Sums/averages the user's rostered (matched) players' projected stats.
 */
export function computeTeamTotals(myRoster, projectionsMap) {
  const myPlayers = myRoster
    .filter((entry) => entry.matchedProjectionKey)
    .map((entry) => projectionsMap[entry.matchedProjectionKey])
    .filter(Boolean);

  const totals = {};
  for (const cat of COUNTING_CATEGORIES) {
    totals[cat] = myPlayers.reduce((sum, p) => sum + (p[cat] ?? 0), 0);
  }
  for (const cat of PERCENTAGE_CATEGORIES) {
    totals[cat] = myPlayers.length > 0 ? mean(myPlayers.map((p) => p[cat] ?? 0)) : 0;
  }

  return { totals, playerCount: myPlayers.length, players: myPlayers };
}

/**
 * Computes per-category z-score of the team's per-player average against the
 * distribution of the full uploaded projections pool (best available league-wide proxy).
 */
export function computeStrengthWeakness(teamTotals, projectionsMap) {
  const result = {};

  // With no rostered players yet, "average per player" has no real signal (it's
  // literally 0/1), which would otherwise read as catastrophically "weak" in every
  // counting/percentage category and falsely "strong" in TO. Report neutral instead
  // so suggestions reduce to a plain value ranking until at least one pick exists.
  if (teamTotals.playerCount === 0) {
    for (const cat of CATEGORIES) {
      result[cat] = { zScore: 0, rank: "neutral" };
    }
    return result;
  }

  const playerCount = teamTotals.playerCount;

  for (const cat of CATEGORIES) {
    const { mean: poolMean, stdev: poolStdev } = categoryDistribution(projectionsMap, cat);
    const teamPerPlayerAvg = teamTotals.totals[cat] / playerCount;
    let z = poolStdev === 0 ? 0 : (teamPerPlayerAvg - poolMean) / poolStdev;
    if (LOWER_IS_BETTER.has(cat)) z = -z;

    let rank = "neutral";
    if (z > STRENGTH_Z_THRESHOLD) rank = "strong";
    else if (z < -STRENGTH_Z_THRESHOLD) rank = "weak";

    result[cat] = { zScore: z, rank };
  }

  return result;
}
