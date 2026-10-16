import { describe, it, expect } from "vitest";
import { groupPicksByTeam, identifyMyTeam, computeTeamStandings } from "../shared/team-standings.js";

const projections = {
  "big scorer": { rawName: "Big Scorer", PTS: 30, REB: 5, AST: 5, STL: 1, BLK: 1, THREEPM: 2, FGPCT: 0.5, FTPCT: 0.8, TO: 4 },
  "low to guy": { rawName: "Low TO Guy", PTS: 10, REB: 5, AST: 5, STL: 1, BLK: 1, THREEPM: 2, FGPCT: 0.5, FTPCT: 0.8, TO: 1 },
  "rebounder": { rawName: "Rebounder", PTS: 10, REB: 15, AST: 1, STL: 1, BLK: 2, THREEPM: 0, FGPCT: 0.6, FTPCT: 0.6, TO: 2 },
};

function pick(playerKey, teamNameRaw) {
  return {
    playerNameRaw: projections[playerKey].rawName,
    playerNameNormalized: playerKey,
    matchedProjectionKey: playerKey,
    teamNameRaw,
  };
}

describe("groupPicksByTeam", () => {
  it("groups by team and keeps team-less picks separate instead of folding them into a real team", () => {
    const { byTeam, unattributed } = groupPicksByTeam([
      pick("big scorer", "Team A"),
      pick("rebounder", "Team B"),
      { playerNameRaw: "Mystery", playerNameNormalized: "mystery", teamNameRaw: null },
    ]);

    expect([...byTeam.keys()]).toEqual(["Team A", "Team B"]);
    expect(unattributed).toHaveLength(1);
  });
});

describe("identifyMyTeam", () => {
  it("picks the team whose drafted players overlap my separately-tracked roster", () => {
    const { byTeam } = groupPicksByTeam([pick("big scorer", "Team A"), pick("rebounder", "Team B")]);
    const myRoster = [{ playerNameNormalized: "rebounder" }];
    expect(identifyMyTeam(byTeam, myRoster)).toBe("Team B");
  });

  it("returns null rather than guessing when the roster is empty or shares nobody", () => {
    const { byTeam } = groupPicksByTeam([pick("big scorer", "Team A")]);
    expect(identifyMyTeam(byTeam, [])).toBeNull();
    expect(identifyMyTeam(byTeam, [{ playerNameNormalized: "somebody else" }])).toBeNull();
  });
});

describe("computeTeamStandings", () => {
  const history = [
    pick("big scorer", "Team A"),
    pick("rebounder", "Team B"),
    pick("low to guy", "Team C"),
  ];

  it("ranks teams per category, inverting turnovers so fewer TO ranks better", () => {
    const standings = computeTeamStandings(history, projections, []);

    expect(standings.teamCount).toBe(3);
    const byName = Object.fromEntries(standings.teams.map((t) => [t.teamName, t]));

    // PTS: A (30) > B (10) = C (10) -> A first, B and C tie for 2nd.
    expect(byName["Team A"].ranks.PTS).toBe(1);
    expect(byName["Team B"].ranks.PTS).toBe(2);
    expect(byName["Team C"].ranks.PTS).toBe(2);

    // TO: lower is better, so C (1 TO) should rank 1st and A (4 TO) last.
    expect(byName["Team C"].ranks.TO).toBe(1);
    expect(byName["Team A"].ranks.TO).toBe(3);

    // REB: B (15) leads.
    expect(byName["Team B"].ranks.REB).toBe(1);
  });

  it("flags my team and reports matched vs. total picks so unmatched picks aren't hidden", () => {
    const withUnmatched = [
      ...history,
      { playerNameRaw: "Not In File", playerNameNormalized: "not in file", matchedProjectionKey: null, teamNameRaw: "Team A" },
    ];
    const standings = computeTeamStandings(withUnmatched, projections, [{ playerNameNormalized: "big scorer" }]);

    expect(standings.myTeamName).toBe("Team A");
    expect(standings.myTeam.isMine).toBe(true);

    const teamA = standings.teams.find((t) => t.teamName === "Team A");
    expect(teamA.pickCount).toBe(2);
    expect(teamA.matchedCount).toBe(1); // the unmatched pick contributes no stats
  });

  it("returns an empty, non-throwing result when there's no pick history yet", () => {
    const standings = computeTeamStandings([], projections, []);
    expect(standings.teams).toEqual([]);
    expect(standings.teamCount).toBe(0);
    expect(standings.myTeam).toBeNull();
  });
});
