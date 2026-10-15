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
