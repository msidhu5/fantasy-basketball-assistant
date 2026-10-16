import { describe, it, expect } from "vitest";
import { normalizeName, similarity, matchPlayerName } from "../shared/name-matcher.js";

describe("normalizeName", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeName("Luka Dončić")).toBe("luka doncic");
  });

  it("strips common suffixes", () => {
    expect(normalizeName("Jaylen Brown Jr.")).toBe("jaylen brown");
    expect(normalizeName("Tim Hardaway III")).toBe("tim hardaway");
  });

  it("handles empty/null input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("luka doncic", "luka doncic")).toBe(1);
  });

  it("returns a lower score for very different strings", () => {
    expect(similarity("luka doncic", "nikola jokic")).toBeLessThan(0.5);
  });
});

describe("matchPlayerName", () => {
  const projections = {
    "luka doncic": { rawName: "Luka Doncic" },
    "nikola jokic": { rawName: "Nikola Jokic" },
    "jaylen brown": { rawName: "Jaylen Brown" },
  };

  it("matches exactly after normalization", () => {
    const result = matchPlayerName("Luka Dončić", projections);
    expect(result.key).toBe("luka doncic");
    expect(result.score).toBe(1);
  });

  it("fuzzy-matches small typos above threshold with same last name + initial", () => {
    const result = matchPlayerName("Nikolaa Jokic", projections);
    expect(result.key).toBe("nikola jokic");
  });

  it("refuses to match when last name differs, even if textually similar", () => {
    const result = matchPlayerName("Nikola Jovic", projections);
    expect(result.key).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("returns null with candidate suggestions for a totally unknown player", () => {
    const result = matchPlayerName("Some Rookie Nobody", projections);
    expect(result.key).toBeNull();
    expect(result.candidates).toHaveLength(3);
  });
});

describe("matchPlayerName - short-form / nickname names", () => {
  const projections = {
    "alexandre sarr": { rawName: "Alexandre Sarr" },
    "cameron johnson": { rawName: "Cameron Johnson" },
    "jaylen brown": { rawName: "Jaylen Brown" },
    "mikel brown": { rawName: "Mikel Brown Jr." },
  };

  it("matches a truncated first name to its full form - the real-world Alex/Alexandre Sarr miss", () => {
    // similarity is only ~0.64 here, far below the typo threshold, so this needs
    // the dedicated short-form rule rather than a looser fuzzy match.
    const result = matchPlayerName("Alex Sarr", projections);
    expect(result.key).toBe("alexandre sarr");
    expect(result.matchType).toBe("short-form");
  });

  it("works in the other direction too (full name scraped, short name in the file)", () => {
    const result = matchPlayerName("Cam Johnson", projections);
    expect(result.key).toBe("cameron johnson");
  });

  it("will not conflate two different players who share a surname", () => {
    // "jaylen" is not a prefix of "mikel" (or vice versa), so the prefix rule can't
    // bridge them - and each still resolves to itself.
    expect(matchPlayerName("Jaylen Brown", projections).key).toBe("jaylen brown");
    expect(matchPlayerName("Mikel Brown Jr.", projections).key).toBe("mikel brown");
  });

  it("refuses a bare initial, which would otherwise prefix-match almost anything", () => {
    expect(matchPlayerName("A Sarr", projections).key).toBeNull();
  });

  it("refuses when two candidates are both plausible truncations, rather than guessing", () => {
    const ambiguous = {
      "cam johnson": { rawName: "Cam Johnson" },
      "cameron johnson": { rawName: "Cameron Johnson" },
    };
    // "camer" truncates toward both -> genuinely ambiguous, so no match.
    const result = matchPlayerName("Camer Johnson", ambiguous);
    expect(result.key).toBeNull();
  });
});
