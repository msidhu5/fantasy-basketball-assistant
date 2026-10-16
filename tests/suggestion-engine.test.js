import { describe, it, expect } from "vitest";
import { rankSuggestions, listUndraftedInUploadOrder, computeUndraftedPool } from "../shared/suggestion-engine.js";
import { CATEGORIES as CATEGORY_KEYS } from "../shared/constants.js";

function baselinePlayer(overrides) {
  return {
    rawName: "baseline",
    PTS: 20,
    REB: 5,
    AST: 5,
    STL: 1,
    BLK: 1,
    THREEPM: 1,
    FGPCT: 0.45,
    FTPCT: 0.75,
    TO: 2,
    ...overrides,
  };
}

describe("rankSuggestions", () => {
  // Two players with equal raw (unweighted) value: X is strong in PTS/weak in BLK,
  // Y is weak in PTS/strong in BLK - everything else held equal so it nets to zero either way.
  const pool = {
    "player x": baselinePlayer({ rawName: "Player X", PTS: 30, BLK: 1 }),
    "player y": baselinePlayer({ rawName: "Player Y", PTS: 10, BLK: 5 }),
  };

  it("ranks X and Y equally on unweighted value (k=0) since their z-scores offset", () => {
    const neutralStrength = {
      PTS: { zScore: 0 }, REB: { zScore: 0 }, AST: { zScore: 0 }, STL: { zScore: 0 },
      BLK: { zScore: 0 }, THREEPM: { zScore: 0 }, FGPCT: { zScore: 0 }, FTPCT: { zScore: 0 }, TO: { zScore: 0 },
    };
    const ranked = rankSuggestions(pool, neutralStrength, { k: 0 });
    expect(ranked[0].weightedValue).toBeCloseTo(ranked[1].weightedValue, 5);
    expect(ranked[0].weightedValue).toBeCloseTo(0, 5);
  });

  it("boosts the player strong in the team's weak category (BLK) above the equal-base-value alternative", () => {
    const weakInBlk = {
      PTS: { zScore: 0 }, REB: { zScore: 0 }, AST: { zScore: 0 }, STL: { zScore: 0 },
      BLK: { zScore: -1.5 }, THREEPM: { zScore: 0 }, FGPCT: { zScore: 0 }, FTPCT: { zScore: 0 }, TO: { zScore: 0 },
    };
    const ranked = rankSuggestions(pool, weakInBlk, { k: 0.5 });

    expect(ranked[0].rawName).toBe("Player Y");
    expect(ranked[0].boostedFor).toBe("BLK");
    expect(ranked[0].weightedValue).toBeCloseTo(0.75, 5);
    expect(ranked[1].rawName).toBe("Player X");
    expect(ranked[1].weightedValue).toBeCloseTo(-0.75, 5);

    // Confirms this is purely the need-weighting effect: base (unweighted) values were tied.
    expect(ranked[0].baseValue).toBeCloseTo(ranked[1].baseValue, 5);
  });

  it("penalizes reaching: a great-fit player whose ADP is rounds later loses to a slightly-worse-fit player available at market value", () => {
    const reachPool = {
      // Better fit (+PTS), but ADP says he should last another ~4 rounds.
      "late specialist": baselinePlayer({ rawName: "Late Specialist", PTS: 30, ADP: 60, uploadOrder: 59 }),
      // Worse fit, but going right around the current pick.
      "market pick": baselinePlayer({ rawName: "Market Pick", PTS: 22, ADP: 13, uploadOrder: 12 }),
    };
    const neutral = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { zScore: 0 }]));

    // With no draft-value term, the better statistical fit wins outright.
    const fitOnly = rankSuggestions(reachPool, neutral, { valueWeight: 0, currentPick: 14 });
    expect(fitOnly[0].rawName).toBe("Late Specialist");

    // With draft value counted, reaching ~4 rounds early is no longer worth it.
    const withValue = rankSuggestions(reachPool, neutral, { currentPick: 14 });
    expect(withValue[0].rawName).toBe("Market Pick");
    expect(withValue.find((s) => s.rawName === "Late Specialist").roundsOfValue).toBeLessThan(-3);
  });

  it("does not let a player with NO ADP outrank a star who merely fell past their ADP (missing ADP falls back to file rank, not a neutral 0)", () => {
    const pool = {
      "no adp scrub": baselinePlayer({ rawName: "No ADP Scrub", PTS: 8, uploadOrder: 180 }),
      "fallen star": baselinePlayer({ rawName: "Fallen Star", PTS: 32, ADP: 30, uploadOrder: 5 }),
    };
    const neutral = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { zScore: 0 }]));
    const ranked = rankSuggestions(pool, neutral, { currentPick: 14 });

    expect(ranked[0].rawName).toBe("Fallen Star");
    const scrub = ranked.find((s) => s.rawName === "No ADP Scrub");
    expect(scrub.adp).toBeNull();
    expect(scrub.effectiveAdp).toBe(181); // uploadOrder + 1
    expect(scrub.roundsOfValue).toBeLessThan(-10); // heavily penalized, not neutral
  });

  it("softens a punt when puntWeight > 0: a disastrous punted-category player still pays part of the cost", () => {
    const pool = {
      "awful ft": baselinePlayer({ rawName: "Awful FT", FTPCT: 0.4, ADP: 20, uploadOrder: 19 }),
      "fine ft": baselinePlayer({ rawName: "Fine FT", FTPCT: 0.9, ADP: 20, uploadOrder: 19 }),
    };
    const neutral = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { zScore: 0 }]));
    const opts = { currentPick: 21, puntedCategories: ["FTPCT"] };

    // Full punt (default weight 0): FT% is irrelevant, so the two tie exactly.
    const hardPunt = rankSuggestions(pool, neutral, opts);
    expect(hardPunt[0].score).toBeCloseTo(hardPunt[1].score, 5);

    // Softened punt: FT% counts a quarter, so the terrible shooter now ranks lower.
    const softPunt = rankSuggestions(pool, neutral, { ...opts, puntWeight: 0.25 });
    expect(softPunt[0].rawName).toBe("Fine FT");
    expect(softPunt[0].score).toBeGreaterThan(softPunt[1].score);
  });

  it("clamps a runaway need deficit so one category can't dominate the ranking on bad input", () => {
    const pool = {
      "blk specialist": baselinePlayer({ rawName: "BLK Specialist", BLK: 5, PTS: 5, ADP: 20, uploadOrder: 19 }),
      "balanced star": baselinePlayer({ rawName: "Balanced Star", BLK: 1, PTS: 32, ADP: 20, uploadOrder: 19 }),
    };
    // An absurd -20 deficit, of the kind the percentage bug used to produce.
    const absurd = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { zScore: c === "BLK" ? -20 : 0 }]));

    const clamped = rankSuggestions(pool, absurd, { currentPick: 21, maxNeedDeficit: 1.5 });
    const unclamped = rankSuggestions(pool, absurd, { currentPick: 21, maxNeedDeficit: Infinity });

    // Unclamped, the BLK deficit swamps everything; clamped, it stays proportionate.
    const spread = (r) => Math.abs(r[0].score - r[1].score);
    expect(spread(clamped)).toBeLessThan(spread(unclamped));
    expect(unclamped[0].rawName).toBe("BLK Specialist");
  });

  it("completely excludes a punted category from both base value and need-weighting, even if the team is extremely weak in it", () => {
    // BLK is punted: X's and Y's PTS/BLK split should no longer offset via BLK at
    // all - with BLK removed from the sum entirely, X (better PTS) should just win
    // outright, and the "weak in BLK" signal must NOT boost Y despite being huge.
    const extremelyWeakInBlk = {
      PTS: { zScore: 0 }, REB: { zScore: 0 }, AST: { zScore: 0 }, STL: { zScore: 0 },
      BLK: { zScore: -5 }, THREEPM: { zScore: 0 }, FGPCT: { zScore: 0 }, FTPCT: { zScore: 0 }, TO: { zScore: 0 },
    };
    const ranked = rankSuggestions(pool, extremelyWeakInBlk, { k: 0.5, puntedCategories: ["BLK"] });

    expect(ranked[0].rawName).toBe("Player X");
    expect(ranked[0].boostedFor).toBeNull();
    expect(ranked[1].boostedFor).toBeNull();
    // X's only remaining edge is PTS; Y no longer gets any BLK contribution at all.
    expect(ranked[0].weightedValue).toBeGreaterThan(ranked[1].weightedValue);
  });
});

describe("rankSuggestions - draftable baseline and urgency", () => {
  const neutral = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, { zScore: 0 }]));

  it("calibrates z-scores against the supplied baseline, not the shrinking undrafted pool", () => {
    // Pool holds only weak players; baseline says the real population is much better.
    // Calibrated against the baseline, these should score clearly NEGATIVE, rather
    // than looking average just because they're all that's left.
    const pool = {
      "weak a": baselinePlayer({ rawName: "Weak A", PTS: 8, uploadOrder: 100 }),
      "weak b": baselinePlayer({ rawName: "Weak B", PTS: 9, uploadOrder: 101 }),
    };
    const baselineMap = {
      ...pool,
      "star a": baselinePlayer({ rawName: "Star A", PTS: 32, uploadOrder: 0 }),
      "star b": baselinePlayer({ rawName: "Star B", PTS: 30, uploadOrder: 1 }),
    };

    const vsBaseline = rankSuggestions(pool, neutral, { baselineMap, valueWeight: 0 });
    const vsPoolOnly = rankSuggestions(pool, neutral, { valueWeight: 0 });

    // Against the real population, BOTH weak players are below average.
    expect(vsBaseline.every((r) => r.fitValue < 0)).toBe(true);

    // Against only each other they straddle zero - the better of two bad players
    // reads as "above average", which is exactly the distortion the baseline fixes.
    expect(vsPoolOnly.some((r) => r.fitValue > 0)).toBe(true);
    expect(vsPoolOnly.some((r) => r.fitValue < 0)).toBe(true);
  });

  it("adds urgency only for a player who beats replacement level AND is likely gone", () => {
    const pool = {
      // Best fit, and likely gone before the next turn at pick 40.
      scarce: baselinePlayer({ rawName: "Scarce Star", PTS: 34, ADP: 20, uploadOrder: 19 }),
      // Slightly worse fit but certain to last -> sets replacement level.
      safe: baselinePlayer({ rawName: "Safe Option", PTS: 30, ADP: 120, uploadOrder: 119 }),
    };
    const ranked = rankSuggestions(pool, neutral, {
      valueWeight: 0,
      currentPick: 20,
      nextPickAfterThis: 40,
    });

    const scarce = ranked.find((r) => r.rawName === "Scarce Star");
    const safe = ranked.find((r) => r.rawName === "Safe Option");

    expect(scarce.availability).toBeLessThan(0.5);
    expect(safe.availability).toBeGreaterThan(0.9);
    expect(scarce.nowValue).toBeGreaterThan(0);
    // The one who'll certainly last carries no urgency - you can just wait for him.
    expect(safe.nowValue).toBe(0);
  });

  it("keeps the draft-value term alongside urgency, so suggestions don't drift rounds past market", () => {
    // A big reach with great fit vs. a fair-value player with worse fit. Urgency
    // alone would crown the reach; the ADP term has to keep it in check. (Regression:
    // scoring on fit+urgency only put an ADP-72 player at #2 for pick 14.)
    const pool = {
      reach: baselinePlayer({ rawName: "Reach", PTS: 34, ADP: 72, uploadOrder: 71 }),
      fair: baselinePlayer({ rawName: "Fair Value", PTS: 26, ADP: 15, uploadOrder: 14 }),
    };
    const ranked = rankSuggestions(pool, neutral, { currentPick: 14, nextPickAfterThis: 22 });
    expect(ranked[0].rawName).toBe("Fair Value");
  });

  it("falls back to fit + ADP value when the next turn is unknown", () => {
    const pool = {
      a: baselinePlayer({ rawName: "A", PTS: 30, ADP: 10, uploadOrder: 9 }),
      b: baselinePlayer({ rawName: "B", PTS: 20, ADP: 11, uploadOrder: 10 }),
    };
    const ranked = rankSuggestions(pool, neutral, { currentPick: 12, nextPickAfterThis: null });
    expect(ranked[0].nowValue).toBeNull();
    expect(ranked[0].availability).toBeNull();
    expect(Number.isFinite(ranked[0].score)).toBe(true);
  });
});

describe("listUndraftedInUploadOrder", () => {
  it("sorts explicitly by the uploadOrder field - not object key/insertion order, which doesn't survive a chrome.storage.local round-trip", () => {
    // Object keys inserted alphabetically (a, b, c) but uploadOrder says the real
    // CSV order was C, A, B - if this read insertion order instead of the field,
    // it would wrongly come back alphabetical (the actual bug this fixes).
    const pool = {
      a: baselinePlayer({ rawName: "A", PTS: 40, uploadOrder: 1 }),
      b: baselinePlayer({ rawName: "B", PTS: 20, uploadOrder: 2 }),
      c: baselinePlayer({ rawName: "C", PTS: 5, uploadOrder: 0 }),
    };
    const listed = listUndraftedInUploadOrder(pool);
    expect(listed.map((p) => p.rawName)).toEqual(["C", "A", "B"]);
    expect(listed[0].weightedValue).toBeUndefined();
    expect(listed[0].baseValue).toBeUndefined();
  });

  it("respects the limit parameter", () => {
    const pool = {
      a: baselinePlayer({ rawName: "A", uploadOrder: 0 }),
      b: baselinePlayer({ rawName: "B", uploadOrder: 1 }),
      c: baselinePlayer({ rawName: "C", uploadOrder: 2 }),
    };
    const listed = listUndraftedInUploadOrder(pool, 2);
    expect(listed.map((p) => p.rawName)).toEqual(["A", "B"]);
  });
});

describe("computeUndraftedPool", () => {
  it("excludes players with a matched pick, keeps everyone else", () => {
    const projections = {
      a: { rawName: "A" },
      b: { rawName: "B" },
      c: { rawName: "C" },
    };
    const picks = [{ matchedProjectionKey: "b" }, { matchedProjectionKey: null }];
    const pool = computeUndraftedPool(projections, picks);
    expect(Object.keys(pool).sort()).toEqual(["a", "c"]);
  });
});
