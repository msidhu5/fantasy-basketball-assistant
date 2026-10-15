function detectDelimiter(headerLine) {
  const candidates = [",", "\t", ";"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function splitLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses raw CSV text into { headers: string[], rows: object[] }.
 * rows are plain objects keyed by the raw header strings, values left as strings
 * except numeric-looking values are coerced to numbers.
 */
export function parseCsv(rawText) {
  const lines = rawText
    .split(/\r\n|\r|\n/)
    .map((l) => l)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));

  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    const row = {};
    headers.forEach((header, idx) => {
      const raw = (values[idx] ?? "").replace(/^"|"$/g, "");
      const num = Number(raw.replace(/%$/, ""));
      row[header] = raw !== "" && !Number.isNaN(num) ? num : raw;
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Suggests a header -> category mapping using alias matching.
 * aliasMap: { CATEGORY: [alias1, alias2, ...] } (lowercase aliases)
 * Returns { CATEGORY: headerString | null }
 */
export function suggestColumnMapping(headers, aliasMap, nameHeaderAliases = ["name", "player", "player name"]) {
  const mapping = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const [category, aliases] of Object.entries(aliasMap)) {
    let match = null;
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias);
      if (idx !== -1) {
        match = headers[idx];
        break;
      }
    }
    if (!match) {
      const idx = lowerHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));
      if (idx !== -1) match = headers[idx];
    }
    mapping[category] = match;
  }

  let nameHeader = null;
  for (const alias of nameHeaderAliases) {
    const idx = lowerHeaders.indexOf(alias);
    if (idx !== -1) {
      nameHeader = headers[idx];
      break;
    }
  }
  if (!nameHeader) {
    const idx = lowerHeaders.findIndex((h) => nameHeaderAliases.some((a) => h.includes(a)));
    if (idx !== -1) nameHeader = headers[idx];
  }
  mapping.NAME = nameHeader;

  return mapping;
}

/**
 * Builds a ProjectionsMap (normalized name -> stat row) from parsed CSV rows + confirmed mapping.
 * mapping: { NAME: header, PTS: header, REB: header, ... }
 */
export function buildProjectionsMap(rows, mapping, normalizeNameFn) {
  const map = {};
  let rowOrder = 0;
  for (const row of rows) {
    const rawName = row[mapping.NAME];
    if (!rawName) continue;
    const key = normalizeNameFn(String(rawName));
    if (!key) continue;
    // Explicit row order, NOT relied on via object key insertion order - that doesn't
    // reliably survive a chrome.storage.local round-trip (confirmed: came back sorted
    // alphabetically after reload), so anything that needs "the order rows appeared
    // in the CSV" must read this field instead.
    const entry = { rawName: String(rawName), uploadOrder: rowOrder++ };
    for (const [category, header] of Object.entries(mapping)) {
      if (category === "NAME" || !header) continue;
      const value = row[header];
      entry[category] = typeof value === "number" ? value : Number(value) || 0;
    }
    map[key] = entry;
  }
  return map;
}
