export const CATEGORIES = [
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "THREEPM",
  "FGPCT",
  "FTPCT",
  "TO",
];

export const COUNTING_CATEGORIES = ["PTS", "REB", "AST", "STL", "BLK", "THREEPM", "TO"];
export const PERCENTAGE_CATEGORIES = ["FGPCT", "FTPCT"];

export const LOWER_IS_BETTER = new Set(["TO"]);

export const CATEGORY_LABELS = {
  PTS: "PTS",
  REB: "REB",
  AST: "AST",
  STL: "STL",
  BLK: "BLK",
  THREEPM: "3PM",
  FGPCT: "FG%",
  FTPCT: "FT%",
  TO: "TO",
};

export const CATEGORY_HEADER_ALIASES = {
  PTS: ["pts", "points", "pts/g", "ppg"],
  REB: ["reb", "rebounds", "reb/g", "rpg", "trb"],
  AST: ["ast", "assists", "ast/g", "apg"],
  STL: ["stl", "steals", "stl/g", "spg"],
  BLK: ["blk", "blocks", "blk/g", "bpg"],
  THREEPM: ["tpm", "3pm", "3ptm", "threes", "three pointers made", "3pt made", "fg3m"],
  FGPCT: ["fgp", "fg%", "fgpct", "fg pct", "field goal %"],
  FTPCT: ["ftp", "ft%", "ftpct", "ft pct", "free throw %"],
  TO: ["to", "turnovers", "tov", "to/g"],
};

export const OPTIONAL_HEADER_ALIASES = {
  FGA: ["fga"],
  FTA: ["fta"],
  ADP: ["adp"],
};

export const MESSAGE_TYPES = {
  DRAFT_SNAPSHOT: "DRAFT_SNAPSHOT",
  REQUEST_RESCRAPE: "REQUEST_RESCRAPE",
  MANUAL_ROSTER_ADD: "MANUAL_ROSTER_ADD",
  MANUAL_ROSTER_REMOVE: "MANUAL_ROSTER_REMOVE",
  RESET_DRAFT: "RESET_DRAFT",
  STATE_SNAPSHOT_REQUEST: "STATE_SNAPSHOT_REQUEST",
  SET_PUNTED_CATEGORIES: "SET_PUNTED_CATEGORIES",
};

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  PROJECTIONS: "projections",
  DRAFT_STATE: "draftState",
};

export const DEFAULT_SETTINGS = {
  columnMapping: {},
  csvUploadedAt: null,
  projectionsPlayerCount: 0,
  projectionsLoadError: null,
  puntedCategories: [],
};

export const DEFAULT_DRAFT_STATE = {
  myRoster: [],
  // Every pick seen in the Pick History panel (any team, all rounds present in the
  // DOM) - used only to filter suggestions by true draft-wide availability, never
  // surfaced as its own view.
  draftPickHistory: [],
  lastProcessedDomSignature: null,
};

export const NEED_WEIGHT_K = 0.5;

// How much a PUNTED category still counts toward a player's value, 0..1.
// 0 = ignore it completely (standard punt). Raise it toward ~0.25 to soften punts,
// so being catastrophically bad in a punted category still costs a little - you'd
// rather not be unwinnable there, since category wins do occasionally flip.
export const PUNT_CATEGORY_WEIGHT = 0;

// Ceiling on how large a single category's "need" deficit can grow before boosting
// suggestions. Guard rail: a percentage-aggregation bug once produced deficits of
// 6-9 (≈5x multipliers) that silently dominated every suggestion, and nothing in the
// scoring objected. Real deficits sit well under this, so it only binds on bad data.
export const MAX_NEED_DEFICIT = 1.5;
export const STRENGTH_Z_THRESHOLD = 0.5;
export const SUGGESTION_POOL_SIZE = 15;

// How heavily draft value (ADP vs. the current pick) counts against category fit in
// Suggestions. The value term is measured in "rounds of value" - taking someone whose
// ADP is a full round later than the current pick costs 1.0 * this weight. Raise it to
// draft closer to market consensus, lower it to chase category fit harder.
//
// Tuned empirically against a real round-2 scenario (one elite big rostered, pick ~14):
//   1.5 - fit dominates; players going 2+ rounds later still crack the top 5
//   4   - top suggestions all land within ~a round of the pick, but a standout fit
//         still wins the #1 slot and great-fit reaches stay visible around #7-8
//   8   - too far: a 1.6 fit outranks a 7.6 fit, so category fit stops mattering
export const DRAFT_VALUE_WEIGHT = 4;

// Used only to convert an ADP-vs-pick gap into "rounds" for the value term above.
// Defaults to a standard 12-team league.
export const PICKS_PER_ROUND = 12;

// League shape, used to size the z-score baseline below.
export const LEAGUE_TEAMS = 12;
export const ROSTER_SLOTS = 13;

// Z-scores are calibrated against the top N players by projection rank - the
// DRAFTABLE pool - rather than every row in the file. Standard fantasy practice,
// and it matters: measured on real data, widening the baseline from the top 50 to
// the top 200 moved PTS from z=0.33 (neutral) to z=1.42 (strong) for an unchanged
// roster, and flipped TO to "weak". Since those z-scores drive the need-weighting,
// a baseline full of undraftable players distorts every suggestion.
export const DRAFTABLE_POOL_SIZE = LEAGUE_TEAMS * ROSTER_SLOTS;

// Spread (in picks) of the assumed ADP distribution, used to turn an
// ADP-vs-next-pick gap into a probability that a player survives to your next turn.
// Larger = more uncertainty, softer availability curve. This is a modelling
// assumption, not measured: the projections file carries a point ADP with no variance.
export const ADP_SPREAD_PICKS = 8;

// How much the urgency bonus counts on top of raw category fit in Suggestions.
// Urgency = (chance he's gone by my next turn) x (his edge over what waiting gets me).
// 0 disables it and falls back to the ADP-value term.
export const URGENCY_WEIGHT = 1;

// A player is treated as "likely still there at my next turn" above this
// availability probability, when working out replacement level for the Now score.
export const AVAILABILITY_THRESHOLD = 0.5;
