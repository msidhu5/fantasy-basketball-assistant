import { describe, it, expect } from "vitest";
import { computeDraftPosition, likelyGoneByNextTurn } from "../shared/draft-position.js";

const TEAMS = ["T1", "T2", "T3", "T4"];

/**
 * Builds pick history for a 4-team snake draft, in draft order, stopping after
 * `pickCount` total picks. Each pick gets a unique dummy player.
 */
function snakeHistory(pickCount) {
  const history = [];
  let n = 0;
  for (let round = 1; history.length < pickCount; round++) {
    const order = round % 2 === 1 ? TEAMS : [...TEAMS].reverse();
    for (const team of order) {
      if (history.length >= pickCount) break;
      n += 1;
      history.push({
        playerNameRaw: `Player ${n}`,
        playerNameNormalized: `player ${n}`,
        matchedProjectionKey: `player ${n}`,
        teamNameRaw: team,
      });
    }
  }
  return history;
}

function rosterFor(history, team) {
  return history
    .filter((p) => p.teamNameRaw === team)
    .map(({ playerNameRaw, playerNameNormalized, matchedProjectionKey }) => ({
      playerNameRaw,
      playerNameNormalized,
      matchedProjectionKey,
    }));
}

describe("computeDraftPosition", () => {
  it("recovers league size and my slot from draft order once round 1 has wrapped", () => {
    // 5 picks: 1=T1,2=T2,3=T3,4=T4,5=T4. T4 repeating confirms a 4-team league.
    const history = snakeHistory(5);
    const pos = computeDraftPosition(history, rosterFor(history, "T2"));

    expect(pos.teamCount).toBe(4);
    expect(pos.mySlot).toBe(2);
    expect(pos.currentPick).toBe(6);
    expect(pos.isExact).toBe(true);
    // Round 2 runs reversed: 5=T4, 6=T3, 7=T2 -> T2's next turn is pick 7.
    expect(pos.nextPickAfterThis).toBe(7);
  });

  it("handles the turn correctly: slot 4 picks back-to-back at 4 and 5, so its next turn is a long wait", () => {
    const history = snakeHistory(5);
    const pos = computeDraftPosition(history, rosterFor(history, "T4"));

    expect(pos.mySlot).toBe(4);
    expect(pos.currentPick).toBe(6);
    // T4 already used both turn picks (4 and 5); next is round 3's pick 12.
    expect(pos.nextPickAfterThis).toBe(12);
    expect(pos.picksUntilNextTurn).toBe(6);
  });

  it("always looks strictly past the pick on the clock, never returning the current pick itself", () => {
    // 5 picks gone => pick 6 on the clock. T3 picks at 3 and 6, so 6 is MINE;
    // the relevant next turn is the following one (round 3: 9=T1,10=T2,11=T3).
    const history = snakeHistory(5);
    const pos = computeDraftPosition(history, rosterFor(history, "T3"));
    expect(pos.currentPick).toBe(6);
    expect(pos.mySlot).toBe(3);
    expect(pos.nextPickAfterThis).toBe(11);
    expect(pos.nextPickAfterThis).toBeGreaterThan(pos.currentPick);
  });

  it("refuses to estimate mid-first-round, when distinct-teams-so-far undercounts the league", () => {
    // Only 1 pick in: naively this looks like a 1-team league, which would yield a
    // nonsense next-turn estimate. Better to report nothing than to be confidently wrong.
    const history = snakeHistory(1);
    const pos = computeDraftPosition(history, rosterFor(history, "T1"));
    expect(pos.isExact).toBe(false);
    expect(pos.nextPickAfterThis).toBeNull();
    expect(pos.teamCount).toBeNull();
  });

  it("gives no estimate when my team can't be identified, even once round 1 has wrapped", () => {
    const history = snakeHistory(6);
    const pos = computeDraftPosition(history, []); // no roster -> no team identification

    expect(pos.teamCount).toBe(4);
    expect(pos.mySlot).toBeNull();
    expect(pos.isExact).toBe(false);
    expect(pos.nextPickAfterThis).toBe(pos.currentPick + 4);
  });

  it("reports no estimate at all when picks carry no team attribution", () => {
    const pos = computeDraftPosition(
      [{ playerNameRaw: "X", playerNameNormalized: "x", teamNameRaw: null }],
      []
    );
    expect(pos.teamCount).toBeNull();
    expect(pos.nextPickAfterThis).toBeNull();
    expect(pos.isExact).toBe(false);
  });
});

describe("likelyGoneByNextTurn", () => {
  it("flags a player whose ADP lands before my next turn", () => {
    expect(likelyGoneByNextTurn(10, 19)).toBe(true);
  });

  it("does not flag a player expected to last past my next turn", () => {
    expect(likelyGoneByNextTurn(40, 19)).toBe(false);
  });

  it("is false for missing/invalid ADP or an unknown next turn", () => {
    expect(likelyGoneByNextTurn(null, 19)).toBe(false);
    expect(likelyGoneByNextTurn(0, 19)).toBe(false);
    expect(likelyGoneByNextTurn(10, null)).toBe(false);
  });
});
