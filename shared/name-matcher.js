const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizeName(rawName) {
  if (!rawName) return "";
  const stripped = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SUFFIXES.has(token));
  return stripped.join(" ").trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

export function similarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function lastToken(normalized) {
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens[tokens.length - 1] || "";
}

function firstToken(normalized) {
  return normalized.split(" ").filter(Boolean)[0] || "";
}

function firstInitial(normalized) {
  return normalized.charAt(0) || "";
}

const MIN_SHORT_FORM_LENGTH = 3;

/**
 * True when one first name is a truncation of the other - "alex" vs "alexandre",
 * "cam" vs "cameron". This is the nickname/short-form case, which similarity scoring
 * handles badly: "alexandre sarr" vs "alex sarr" scores only 0.64, nowhere near the
 * typo threshold, because five whole characters differ.
 *
 * Deliberately a prefix test rather than a looser fuzzy match, so it can't start
 * conflating genuinely different players who share a surname: "jaylen" is not a
 * prefix of "jalen", so Jaylen Brown and a hypothetical Jalen Brown stay distinct.
 * The minimum length stops a bare initial ("a. sarr") from matching anything.
 */
function isShortFormOf(a, b) {
  if (a === b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_SHORT_FORM_LENGTH && long.startsWith(short);
}

/**
 * Matches a scraped player name against a map of normalized-name -> projection entries.
 * Returns { key, score, candidates } where key is null if no confident match was found.
 * candidates is the top-3 closest keys, for a manual-resolution UI.
 *
 * Tried in order: exact match, then short-form/nickname equivalence, then fuzzy
 * similarity for typos. Each later stage is a weaker signal than the one before.
 */
export function matchPlayerName(rawName, projectionsMap, threshold = 0.9) {
  const normalized = normalizeName(rawName);
  if (projectionsMap[normalized]) {
    return { key: normalized, score: 1, candidates: [normalized] };
  }

  const scored = Object.keys(projectionsMap).map((key) => ({
    key,
    score: similarity(normalized, key),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Short-form pass: same surname, and one first name truncates the other. Only
  // accepted when exactly one candidate qualifies - two would be genuinely ambiguous,
  // and a wrong match silently corrupts stats where a miss stays visible and fixable.
  const shortFormMatches = Object.keys(projectionsMap).filter(
    (key) =>
      lastToken(key) === lastToken(normalized) &&
      isShortFormOf(firstToken(key), firstToken(normalized))
  );
  if (shortFormMatches.length === 1) {
    const key = shortFormMatches[0];
    return {
      key,
      score: similarity(normalized, key),
      matchType: "short-form",
      candidates: scored.slice(0, 3).map((s) => s.key),
    };
  }

  const top = scored[0];
  const sameLastName = top && lastToken(top.key) === lastToken(normalized);
  const sameFirstInitial = top && firstInitial(top.key) === firstInitial(normalized);

  const confidentMatch = top && top.score >= threshold && sameLastName && sameFirstInitial;

  return {
    key: confidentMatch ? top.key : null,
    score: top ? top.score : 0,
    matchType: confidentMatch ? "fuzzy" : null,
    candidates: scored.slice(0, 3).map((s) => s.key),
  };
}
