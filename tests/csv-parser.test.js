import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseCsv, suggestColumnMapping, buildProjectionsMap } from "../shared/csv-parser.js";
import { CATEGORY_HEADER_ALIASES, OPTIONAL_HEADER_ALIASES } from "../shared/constants.js";
import { normalizeName } from "../shared/name-matcher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleCsv = readFileSync(join(__dirname, "../test-fixtures/sample-projections.csv"), "utf-8");

describe("parseCsv", () => {
  it("parses headers and rows, coercing numeric values", () => {
    const { headers, rows } = parseCsv(sampleCsv);
    expect(headers).toContain("Player Name");
    expect(headers).toContain("PTS");
    expect(rows).toHaveLength(10);
    const jokic = rows.find((r) => r["Player Name"] === "Nikola Jokic");
    expect(jokic.PTS).toBe(27.5);
    expect(typeof jokic.PTS).toBe("number");
  });

  it("handles reordered columns fine since lookup is by header name", () => {
    const text = "AST,Player Name,PTS\n5,Test Player,10";
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["AST", "Player Name", "PTS"]);
    expect(rows[0]["Player Name"]).toBe("Test Player");
    expect(rows[0].PTS).toBe(10);
  });

  it("ignores blank lines", () => {
    const text = "Player Name,PTS\nA,1\n\nB,2\n";
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(2);
  });
});

describe("suggestColumnMapping", () => {
  it("maps standard headers via alias matching", () => {
    const { headers } = parseCsv(sampleCsv);
    const mapping = suggestColumnMapping(headers, CATEGORY_HEADER_ALIASES);
    expect(mapping.PTS).toBe("PTS");
    expect(mapping.THREEPM).toBe("3PM");
    expect(mapping.FGPCT).toBe("FG%");
    expect(mapping.NAME).toBe("Player Name");
  });

  it("returns null for categories with no matching header", () => {
    const mapping = suggestColumnMapping(["Name", "Points"], CATEGORY_HEADER_ALIASES);
    expect(mapping.PTS).toBe("Points");
    expect(mapping.BLK).toBeNull();
  });

  it("maps real-world lowercase projection-site headers (tpm/fgp/ftp) and optional volume fields", () => {
    const headers = [
      "rank", "name", "team", "pos", "adp", "gp", "mpg", "status", "rookie",
      "fgp", "ftp", "tpm", "pts", "reb", "ast", "stl", "blk", "to", "fgm", "fga", "ftm", "fta",
    ];
    const mapping = suggestColumnMapping(headers, { ...CATEGORY_HEADER_ALIASES, ...OPTIONAL_HEADER_ALIASES });
    expect(mapping.THREEPM).toBe("tpm");
    expect(mapping.FGPCT).toBe("fgp");
    expect(mapping.FTPCT).toBe("ftp");
    expect(mapping.FGA).toBe("fga");
    expect(mapping.FTA).toBe("fta");
    expect(mapping.ADP).toBe("adp");
    expect(mapping.NAME).toBe("name");
  });
});

describe("buildProjectionsMap", () => {
  it("builds a normalized-name keyed map and strips suffixes for matching", () => {
    const { rows } = parseCsv(sampleCsv);
    const mapping = { NAME: "Player Name", PTS: "PTS", REB: "REB", TO: "TO" };
    const map = buildProjectionsMap(rows, mapping, normalizeName);
    expect(map["jaylen brown"]).toBeDefined();
    expect(map["jaylen brown"].rawName).toBe("Jaylen Brown Jr.");
    expect(map["jaylen brown"].PTS).toBe(23.0);
  });

  it("skips rows with no name", () => {
    const rows = [{ "Player Name": "", PTS: 10 }];
    const map = buildProjectionsMap(rows, { NAME: "Player Name", PTS: "PTS" }, normalizeName);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("stamps each entry with its original row order, skipping a counter bump for rows with no name (so it stays contiguous)", () => {
    const rows = [
      { "Player Name": "First", PTS: 1 },
      { "Player Name": "", PTS: 2 },
      { "Player Name": "Second", PTS: 3 },
    ];
    const map = buildProjectionsMap(rows, { NAME: "Player Name", PTS: "PTS" }, normalizeName);
    expect(map["first"].uploadOrder).toBe(0);
    expect(map["second"].uploadOrder).toBe(1);
  });
});
