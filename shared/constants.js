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
};

export const MESSAGE_TYPES = {
  DRAFT_SNAPSHOT: "DRAFT_SNAPSHOT",
  REQUEST_RESCRAPE: "REQUEST_RESCRAPE",
  MANUAL_ROSTER_ADD: "MANUAL_ROSTER_ADD",
  MANUAL_ROSTER_REMOVE: "MANUAL_ROSTER_REMOVE",
  RESET_DRAFT: "RESET_DRAFT",
  STATE_SNAPSHOT_REQUEST: "STATE_SNAPSHOT_REQUEST",
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
export const STRENGTH_Z_THRESHOLD = 0.5;
export const SUGGESTION_POOL_SIZE = 15;
