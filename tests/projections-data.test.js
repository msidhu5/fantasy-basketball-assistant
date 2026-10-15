import { describe, it, expect } from "vitest";
import { PROJECTIONS_CSV } from "../shared/projections-data.js";
import { parseCsv, suggestColumnMapping, buildProjectionsMap } from "../shared/csv-parser.js";
import { CATEGORY_HEADER_ALIASES, OPTIONAL_HEADER_ALIASES } from "../shared/constants.js";
import { normalizeName } from "../shared/name-matcher.js";

describe("bundled PROJECTIONS_CSV", () => {
  it("parses and fully maps every category for every player, with no missing projections", () => {
    const parsed = parseCsv(PROJECTIONS_CSV);
    expect(parsed.rows.length).toBeGreaterThan(0);

    const mapping = suggestColumnMapping(parsed.headers, { ...CATEGORY_HEADER_ALIASES, ...OPTIONAL_HEADER_ALIASES });
    expect(mapping.NAME).toBeTruthy();
    for (const category of Object.keys(CATEGORY_HEADER_ALIASES)) {
      expect(mapping[category], `expected a mapped header for ${category}`).toBeTruthy();
    }

    const projectionsMap = buildProjectionsMap(parsed.rows, mapping, normalizeName);
    expect(Object.keys(projectionsMap).length).toBe(parsed.rows.length);

    const jokic = projectionsMap["nikola jokic"];
    expect(jokic).toBeDefined();
    expect(jokic.PTS).toBeGreaterThan(0);
    expect(jokic.FGPCT).toBeGreaterThan(0);
    expect(jokic.FGPCT).toBeLessThan(1);
    expect(jokic.uploadOrder).toBe(0);
  });
});
