import { describe, it, expect } from "vitest";
import { reconcileRoster } from "../shared/roster-reconciler.js";
import { normalizeName, matchPlayerName } from "../shared/name-matcher.js";

const projections = {
  "cade cunningham": { rawName: "Cade Cunningham" },
  "mikal bridges": { rawName: "Mikal Bridges" },
};

describe("reconcileRoster", () => {
  it("adds a brand-new scraped player not already in the roster", () => {
    const next = reconcileRoster([], [{ playerNameRaw: "Cade Cunningham", positionSlot: "PG" }], projections, normalizeName, matchPlayerName);
    expect(next).toHaveLength(1);
    expect(next[0].playerNameRaw).toBe("Cade Cunningham");
    expect(next[0].positionSlot).toBe("PG");
    expect(next[0].matchedProjectionKey).toBe("cade cunningham");
  });

  it("does not duplicate a player already present (by normalized name)", () => {
    const current = [{ playerNameRaw: "Cade Cunningham", playerNameNormalized: "cade cunningham", positionSlot: "PG", matchedProjectionKey: "cade cunningham" }];
    const next = reconcileRoster(current, [{ playerNameRaw: "Cade Cunningham", positionSlot: "PG" }], projections, normalizeName, matchPlayerName);
    expect(next).toHaveLength(1);
  });

  it("self-corrects a stale/empty positionSlot on an existing entry when the live scrape disagrees", () => {
    const current = [{ playerNameRaw: "Cade Cunningham", playerNameNormalized: "cade cunningham", positionSlot: null, matchedProjectionKey: "cade cunningham" }];
    const next = reconcileRoster(current, [{ playerNameRaw: "Cade Cunningham", positionSlot: "PG" }], projections, normalizeName, matchPlayerName);
    expect(next).toHaveLength(1);
    expect(next[0].positionSlot).toBe("PG");
  });

  it("leaves a player untouched if they're temporarily absent from the scrape (doesn't imply removal)", () => {
    const current = [{ playerNameRaw: "Mikal Bridges", playerNameNormalized: "mikal bridges", positionSlot: "SG", matchedProjectionKey: "mikal bridges" }];
    const next = reconcileRoster(current, [], projections, normalizeName, matchPlayerName);
    expect(next).toHaveLength(1);
    expect(next[0].playerNameRaw).toBe("Mikal Bridges");
  });

  it("handles a full multi-player snapshot in one pass without losing anyone (the original bug: concurrent per-player messages could clobber each other)", () => {
    const scraped = [
      { playerNameRaw: "Cade Cunningham", positionSlot: "PG" },
      { playerNameRaw: "Mikal Bridges", positionSlot: "SG" },
    ];
    const next = reconcileRoster([], scraped, projections, normalizeName, matchPlayerName);
    expect(next.map((e) => e.playerNameRaw).sort()).toEqual(["Cade Cunningham", "Mikal Bridges"]);
  });
});
