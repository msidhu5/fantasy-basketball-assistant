import { describe, it, expect } from "vitest";
import { rankSuggestions, listUndraftedInUploadOrder, computeUndraftedPool } from "../shared/suggestion-engine.js";

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
    const ranked = rankSuggestions(pool, neutralStrength, 0);
    expect(ranked[0].weightedValue).toBeCloseTo(ranked[1].weightedValue, 5);
    expect(ranked[0].weightedValue).toBeCloseTo(0, 5);
  });

  it("boosts the player strong in the team's weak category (BLK) above the equal-base-value alternative", () => {
    const weakInBlk = {
      PTS: { zScore: 0 }, REB: { zScore: 0 }, AST: { zScore: 0 }, STL: { zScore: 0 },
      BLK: { zScore: -1.5 }, THREEPM: { zScore: 0 }, FGPCT: { zScore: 0 }, FTPCT: { zScore: 0 }, TO: { zScore: 0 },
    };
    const ranked = rankSuggestions(pool, weakInBlk, 0.5);

    expect(ranked[0].rawName).toBe("Player Y");
    expect(ranked[0].boostedFor).toBe("BLK");
    expect(ranked[0].weightedValue).toBeCloseTo(0.75, 5);
    expect(ranked[1].rawName).toBe("Player X");
    expect(ranked[1].weightedValue).toBeCloseTo(-0.75, 5);

    // Confirms this is purely the need-weighting effect: base (unweighted) values were tied.
    expect(ranked[0].baseValue).toBeCloseTo(ranked[1].baseValue, 5);
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
