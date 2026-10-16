import {
  CATEGORIES,
  LOWER_IS_BETTER,
  NEED_WEIGHT_K,
  SUGGESTION_POOL_SIZE,
  DRAFT_VALUE_WEIGHT,
  PICKS_PER_ROUND,
  PUNT_CATEGORY_WEIGHT,
  MAX_NEED_DEFICIT,
  ADP_SPREAD_PICKS,
  AVAILABILITY_THRESHOLD,
  URGENCY_WEIGHT,
} from "./constants.js";
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
 * Per-category z-score (sign-flipped for TO) and the weighted sum (baseValue), for
 * every player in the pool - independent of any team-need weighting.
 *
 * Punted categories are scaled by `puntWeight` rather than hard-dropped. At the
 * default of 0 that's a full exclusion (a true punt: the category counts neither for
 * nor against anyone). A small non-zero value softens the punt, so being disastrous
 * in a punted category still costs something.
 */
function computeBaseValues(pool, puntedCategories = [], puntWeight = PUNT_CATEGORY_WEIGHT, baselineMap = null) {
  const puntedSet = new Set(puntedCategories);
  const weightFor = (cat) => (puntedSet.has(cat) ? puntWeight : 1);

  // Calibrate against a FIXED draftable baseline when given one, rather than the
  // shrinking undrafted pool. Recalibrating per pick makes values drift as the pool
  // degrades - late on, everyone looks strong because they're measured against scrubs.
  const distributionSource = baselineMap ?? pool;
  const distributions = {};
  for (const cat of CATEGORIES) {
    if (weightFor(cat) !== 0) distributions[cat] = categoryDistribution(distributionSource, cat);
  }

  return Object.entries(pool).map(([key, player]) => {
    const perCategoryZ = {};
    let baseValue = 0;
    for (const cat of CATEGORIES) {
      const weight = weightFor(cat);
      if (weight === 0) continue;
      const { mean, stdev } = distributions[cat];
      let z = stdev === 0 ? 0 : (player[cat] - mean) / stdev;
      if (LOWER_IS_BETTER.has(cat)) z = -z;
      perCategoryZ[cat] = z;
      baseValue += z * weight;
    }
    return {
      key,
      rawName: player.rawName,
      adp: player.ADP,
      uploadOrder: player.uploadOrder,
      baseValue,
      perCategoryZ,
    };
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
 * Ranks the undrafted pool by need-weighted category fit AND draft value.
 *
 * strengthWeakness: output of computeStrengthWeakness (per-category { zScore, rank }).
 * puntedCategories are down-weighted in the base value (see computeBaseValues) and
 * never need-boosted at all - a punted category is not a "deficit" to chase,
 * regardless of how weak the team actually is in it.
 *
 * Need deficits are clamped at MAX_NEED_DEFICIT so one category can't run away with
 * the ranking on bad input.
 *
 * Category fit alone will happily recommend a low-value specialist who plugs a hole,
 * so the final score also accounts for draft value: how a player's ADP compares to
 * the pick currently on the clock, expressed in rounds. Reaching a full round past
 * market consensus costs `valueWeight`; a player who fell past their ADP gains the
 * same per round. With no `currentPick` or no ADP on a player, the value term is 0
 * and this reduces to pure fit ranking.
 */
export function rankSuggestions(undraftedPool, strengthWeakness, {
  puntedCategories = [],
  k = NEED_WEIGHT_K,
  limit = SUGGESTION_POOL_SIZE,
  currentPick = null,
  valueWeight = DRAFT_VALUE_WEIGHT,
  picksPerRound = PICKS_PER_ROUND,
  puntWeight = PUNT_CATEGORY_WEIGHT,
  maxNeedDeficit = MAX_NEED_DEFICIT,
  baselineMap = null,
  nextPickAfterThis = null,
  adpSpread = ADP_SPREAD_PICKS,
  availabilityThreshold = AVAILABILITY_THRESHOLD,
  urgencyWeight = URGENCY_WEIGHT,
  useNowScore = true,
} = {}) {
  const puntedSet = new Set(puntedCategories);
  const scoredCategories = CATEGORIES.filter((cat) => !puntedSet.has(cat) || puntWeight !== 0);

  const deficits = {};
  for (const cat of CATEGORIES) {
    if (puntedSet.has(cat)) {
      deficits[cat] = 0;
      continue;
    }
    const z = strengthWeakness?.[cat]?.zScore ?? 0;
    deficits[cat] = Math.min(Math.max(0, -z), maxNeedDeficit);
  }

  const ranked = computeBaseValues(undraftedPool, puntedCategories, puntWeight, baselineMap).map(({ key, rawName, adp, uploadOrder, baseValue, perCategoryZ }) => {
    let fitValue = 0;
    let topBoostCategory = null;
    let topBoostAmount = -Infinity;

    for (const cat of scoredCategories) {
      const z = perCategoryZ[cat];
      if (z === undefined) continue;
      const weight = puntedSet.has(cat) ? puntWeight : 1;
      const boostMultiplier = 1 + k * deficits[cat];
      const weighted = z * weight * boostMultiplier;
      fitValue += weighted;

      const boostAmount = weighted - z;
      if (boostAmount > topBoostAmount && deficits[cat] > 0) {
        topBoostAmount = boostAmount;
        topBoostCategory = cat;
      }
    }

    // Missing ADP must NOT default to a neutral 0 value term - that would rank an
    // unranked deep-bench player ABOVE a legitimate star who merely fell a round
    // past their ADP (confirmed: no-ADP players floated into the top 8). Fall back
    // to the player's own position in the projections file as a market-value proxy.
    const hasAdp = typeof adp === "number" && adp > 0;
    const effectiveAdp = hasAdp ? adp : typeof uploadOrder === "number" ? uploadOrder + 1 : null;
    const roundsOfValue =
      currentPick != null && effectiveAdp != null ? (currentPick - effectiveAdp) / picksPerRound : 0;

    // Probability he's still on the board at my next turn. Logistic on how far his
    // ADP sits past that pick, so there's no cliff edge at exactly ADP == nextPick.
    const availability =
      nextPickAfterThis != null && effectiveAdp != null
        ? 1 / (1 + Math.exp(-(effectiveAdp - nextPickAfterThis) / adpSpread))
        : null;

    return {
      key,
      rawName,
      adp: hasAdp ? adp : null,
      effectiveAdp,
      baseValue,
      fitValue,
      roundsOfValue,
      availability,
      // Kept for backwards compatibility with anything still reading the old field.
      weightedValue: fitValue,
      boostedFor: topBoostCategory,
    };
  });

  // Replacement level: the best fit among players who'll probably still be there at
  // my next turn - i.e. what I'd get anyway by waiting. If nobody is likely to
  // survive, replacement is the worst fit on the board, so everything reads urgent.
  const survivors = ranked.filter((r) => (r.availability ?? 0) >= availabilityThreshold);
  const replacementFit = survivors.length
    ? Math.max(...survivors.map((r) => r.fitValue))
    : ranked.length
      ? Math.min(...ranked.map((r) => r.fitValue))
      : 0;

  const canScoreNow = useNowScore && nextPickAfterThis != null;
  for (const r of ranked) {
    r.replacementFit = canScoreNow ? replacementFit : null;

    // Urgency: how much I'd lose by waiting. His edge over what I'd get at my next
    // turn anyway, scaled by the chance he's actually gone by then.
    //
    // This is deliberately a BONUS on top of fit, not the ranking key itself. Used
    // alone it collapses: anyone likely to be available scores (1-1)*x = 0, so
    // genuinely bad players tie with good ones at zero and sort by float noise
    // (measured: a -5.6 fit player reached #6). Urgency says "how much does waiting
    // cost me", which is only meaningful next to "how good is he".
    r.nowValue = canScoreNow
      ? (1 - (r.availability ?? 0)) * Math.max(0, r.fitValue - replacementFit)
      : null;

    // Fit + draft value + urgency. All three, because they answer different
    // questions and dropping any one regresses something measurable:
    //   fit       - how good is he for THIS roster
    //   ADP value - is he reasonable value at this pick (drop it and suggestions
    //               reach 3-5 rounds past market, e.g. an ADP-72 player at pick 14)
    //   urgency   - do I lose him by waiting (drop it and scarcity is ignored)
    r.score =
      r.fitValue +
      valueWeight * r.roundsOfValue +
      (canScoreNow ? urgencyWeight * r.nowValue : 0);
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
