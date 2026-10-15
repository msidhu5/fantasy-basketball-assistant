import { CATEGORIES, LOWER_IS_BETTER, NEED_WEIGHT_K, SUGGESTION_POOL_SIZE } from "./constants.js";
import { categoryDistribution } from "./stats-aggregator.js";

/**
 * Returns the set of normalized-name keys still undrafted.
 */
export function computeUndraftedPool(projectionsMap, picks) {
  const draftedKeys = new Set(
    picks.map((p) => p.matchedProjectionKey).filter(Boolean)
  );
  const pool = {};
  for (const [key, entry] of Object.entries(projectionsMap)) {
    if (!draftedKeys.has(key)) pool[key] = entry;
  }
  return pool;
}

/**
 * Per-category z-score (sign-flipped for TO) and the raw unweighted sum (baseValue),
 * for every player in the pool - independent of any team-need weighting.
 */
function computeBaseValues(pool) {
  const distributions = {};
  for (const cat of CATEGORIES) {
    distributions[cat] = categoryDistribution(pool, cat);
  }

  return Object.entries(pool).map(([key, player]) => {
    const perCategoryZ = {};
    let baseValue = 0;
    for (const cat of CATEGORIES) {
      const { mean, stdev } = distributions[cat];
      let z = stdev === 0 ? 0 : (player[cat] - mean) / stdev;
      if (LOWER_IS_BETTER.has(cat)) z = -z;
      perCategoryZ[cat] = z;
      baseValue += z;
    }
    return { key, rawName: player.rawName, baseValue, perCategoryZ };
  });
}

/**
 * Lists the undrafted pool in the exact order it appeared in the projections CSV -
 * sorted explicitly by the `uploadOrder` field stamped on each entry at parse time,
 * NOT by object key insertion order (that doesn't reliably survive a
 * chrome.storage.local round-trip - confirmed it comes back re-sorted alphabetically).
 * Whatever ranking the file encodes, not any score this extension invents.
 */
export function listUndraftedInUploadOrder(undraftedPool, limit = SUGGESTION_POOL_SIZE) {
  return Object.entries(undraftedPool)
    .map(([key, player]) => ({ key, ...player }))
    .sort((a, b) => a.uploadOrder - b.uploadOrder)
    .slice(0, limit);
}

/**
 * Ranks the undrafted pool by need-weighted z-score value.
 * strengthWeakness: output of computeStrengthWeakness (per-category { zScore, rank }).
 */
export function rankSuggestions(undraftedPool, strengthWeakness, k = NEED_WEIGHT_K, limit = SUGGESTION_POOL_SIZE) {
  const deficits = {};
  for (const cat of CATEGORIES) {
    const z = strengthWeakness?.[cat]?.zScore ?? 0;
    deficits[cat] = Math.max(0, -z);
  }

  const ranked = computeBaseValues(undraftedPool).map(({ key, rawName, baseValue, perCategoryZ }) => {
    let weightedValue = 0;
    let topBoostCategory = null;
    let topBoostAmount = -Infinity;

    for (const cat of CATEGORIES) {
      const z = perCategoryZ[cat];
      const boostMultiplier = 1 + k * deficits[cat];
      const weighted = z * boostMultiplier;
      weightedValue += weighted;

      const boostAmount = weighted - z;
      if (boostAmount > topBoostAmount && deficits[cat] > 0) {
        topBoostAmount = boostAmount;
        topBoostCategory = cat;
      }
    }

    return { key, rawName, baseValue, weightedValue, boostedFor: topBoostCategory };
  });

  ranked.sort((a, b) => b.weightedValue - a.weightedValue);
  return ranked.slice(0, limit);
}
