import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { categoryDistribution, computeTeamTotals, computeStrengthWeakness } from "../shared/stats-aggregator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projections = JSON.parse(
  readFileSync(join(__dirname, "../test-fixtures/sample-players.json"), "utf-8")
);

describe("categoryDistribution", () => {
  it("computes mean/stdev across the 5-player fixture for PTS (hand-verified: 20,10,15,8,22)", () => {
    const { mean, stdev } = categoryDistribution(projections, "PTS");
    expect(mean).toBeCloseTo(15, 5);
    expect(stdev).toBeCloseTo(5.4406, 3);
  });
});

describe("computeTeamTotals", () => {
  const myRoster = [
    { matchedProjectionKey: "player a" },
    { matchedProjectionKey: "player c" },
  ];

  it("sums counting stats and averages percentages for all matched roster entries", () => {
    const { totals, playerCount } = computeTeamTotals(myRoster, projections);
    expect(playerCount).toBe(2);
    expect(totals.PTS).toBeCloseTo(35, 5); // 20 + 15
    expect(totals.BLK).toBeCloseTo(0.8, 5); // 0.5 + 0.3
    expect(totals.FGPCT).toBeCloseTo(0.465, 5); // mean(.48, .45)
  });

  it("ignores unmatched roster entries", () => {
    const { playerCount } = computeTeamTotals([{ matchedProjectionKey: null }], projections);
    expect(playerCount).toBe(0);
  });

  it("exposes perPlayer separately: counting stats pre-divided, percentages left as means (NOT divided by roster size)", () => {
    const { totals, perPlayer } = computeTeamTotals(myRoster, projections);

    // Counting: totals is the sum, perPlayer is the per-player average.
    expect(totals.PTS).toBeCloseTo(35, 5);
    expect(perPlayer.PTS).toBeCloseTo(17.5, 5);

    // Percentage: BOTH are the mean. perPlayer must NOT be totals/playerCount
    // (that double-divide is what reported ~0.23 FG% for a .465 roster).
    expect(totals.FGPCT).toBeCloseTo(0.465, 5);
    expect(perPlayer.FGPCT).toBeCloseTo(0.465, 5);
    expect(perPlayer.FGPCT).not.toBeCloseTo(0.465 / 2, 3);
  });
});

describe("computeStrengthWeakness", () => {
  const myRoster = [
    { matchedProjectionKey: "player a" },
    { matchedProjectionKey: "player c" },
  ];

  it("hand-verified: team is roughly neutral in PTS (z ~ 0.46, below the 0.5 'strong' threshold)", () => {
    const teamTotals = computeTeamTotals(myRoster, projections);
    const strength = computeStrengthWeakness(teamTotals, projections);
    expect(strength.PTS.zScore).toBeCloseTo(0.46, 1);
    expect(strength.PTS.rank).toBe("neutral");
  });

  it("hand-verified: team is weak in TO (more turnovers than pool average inverts to negative z)", () => {
    const teamTotals = computeTeamTotals(myRoster, projections);
    const strength = computeStrengthWeakness(teamTotals, projections);
    expect(strength.TO.zScore).toBeCloseTo(-0.73, 1);
    expect(strength.TO.rank).toBe("weak");
  });

  it("reports neutral everywhere for an empty roster, instead of a phantom 0-average weakness/strength in every category", () => {
    const emptyTeamTotals = computeTeamTotals([], projections);
    const strength = computeStrengthWeakness(emptyTeamTotals, projections);
    for (const category of Object.keys(strength)) {
      expect(strength[category].zScore).toBe(0);
      expect(strength[category].rank).toBe("neutral");
    }
  });

  it("does not report a catastrophic phantom weakness in FG%/FT% for a roster with normal percentages", () => {
    // Regression: percentages were being divided by roster size a second time, so a
    // .465 FG% roster scored as .23 against a ~.49 pool mean -> z of about -6, i.e.
    // permanently "weak", which then ~5x-overweighted FG%/FT% in every suggestion.
    const teamTotals = computeTeamTotals(myRoster, projections);
    const strength = computeStrengthWeakness(teamTotals, projections);

    expect(strength.FGPCT.zScore).toBeCloseTo(-0.55, 1);
    expect(strength.FGPCT.zScore).toBeGreaterThan(-1.5);
    expect(strength.FTPCT.zScore).toBeGreaterThan(-1.5);
  });

  it("marks a punted category as 'punted' instead of its actual strong/weak/neutral rank, while still reporting the real z-score for context", () => {
    const teamTotals = computeTeamTotals(myRoster, projections);
    const strength = computeStrengthWeakness(teamTotals, projections, ["TO"]);
    expect(strength.TO.rank).toBe("punted");
    expect(strength.TO.zScore).toBeCloseTo(-0.73, 1); // unchanged - still computed for display
    expect(strength.PTS.rank).toBe("neutral"); // untouched categories unaffected
  });
});
