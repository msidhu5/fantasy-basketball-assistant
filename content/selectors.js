/**
 * Centralized, isolated DOM selector config for ESPN's draft room.
 * ESPN's markup is React-rendered and class names may be hashed/unstable —
 * if live detection breaks, this is the one file that should need updating.
 *
 * Confirmed from a real exported "My Roster" panel: it renders as a genuine
 * `<table class="Table">` with `<tbody class="Table__TBODY"><tr class="Table__TR"
 * data-idx="N">` rows - one row per roster slot (PG/SG/.../BE), with empty slots
 * rendered as a "Empty" placeholder div instead of a player link.
 *
 * IMPORTANT: `table.Table` is ESPN's generic/shared table component class, reused
 * by OTHER widgets too - confirmed live that the Draft Queue widget ("Rank"/"Player"
 * columns, "No players in queue" placeholder) also renders as `table.Table` and can
 * appear earlier in the DOM, so a plain `document.querySelector('table.Table')`
 * can grab the wrong one. The roster table is disambiguated by its header row
 * containing "POS" (confirmed columns: POS / Player / ELIG) - Queue's header is
 * "Rank" / "Player", with no POS column.
 *
 * Player name links do NOT carry a stable href - they're
 * `<a class="AnchorLink ... player-news" title="Full Name">Possibly Abbreviated Text</a>`.
 * Each player row has exactly two such links: the real name link, and a "news" icon
 * link that always carries an `aria-label` starting with "News about ..." - that one
 * must be filtered out. The *visible text* of the real link is sometimes abbreviated
 * ("C. Cunningham"), so the full name should be read from a `title` attribute - either
 * on the link itself, or on a nearby ancestor (observed up to ~5 levels up) - falling
 * back to visible text only if no title is found anywhere.
 */
export const SELECTORS = {
  rosterTable: ['table.Table'],
  rosterRow: ['tbody.Table__TBODY tr.Table__TR', 'tr.Table__TR'],
  // Tried in order; each is filtered to exclude the "news" icon link (see above).
  playerLink: ['a.player-news[title]', 'a.AnchorLink', 'a[href*="/player/"]'],
  positionCell: ['td:first-child div', 'td:first-child'],
  // Pick History: confirmed `.pick-history-table` blocks (one per round, all of them
  // present in the DOM at once - not virtualized/unmounted per round), each a
  // fixed-data-table grid whose body rows carry the bodyRow class (distinct from the
  // header row's class), with a `.player-column` cell using the same title-attribute
  // name pattern as everywhere else.
  pickHistoryRow: ['.pick-history-table [role="row"].public_fixedDataTable_bodyRow'],
};

const EMPTY_SLOT_TEXT = /^\s*empty\s*$/i;

function isNewsIconLink(el) {
  return el.hasAttribute("aria-label");
}

function nearestTitle(el, maxDepth = 8) {
  let node = el;
  for (let i = 0; i < maxDepth && node; i++) {
    const title = node.getAttribute ? node.getAttribute("title") : null;
    if (title && title.trim()) return title.trim();
    node = node.parentElement;
  }
  return null;
}

export function queryFirstAll(root, selectorList) {
  for (const sel of selectorList) {
    const els = root.querySelectorAll(sel);
    if (els.length > 0) return Array.from(els);
  }
  return [];
}

export function queryFirst(root, selectorList) {
  for (const sel of selectorList) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function findPlayerLinks(root) {
  for (const sel of SELECTORS.playerLink) {
    const candidates = Array.from(root.querySelectorAll(sel)).filter((el) => !isNewsIconLink(el));
    if (candidates.length > 0) return candidates;
  }
  return [];
}

function hasPositionColumn(table) {
  // Header cell text nodes are concatenated with no separators (e.g. "POSPlayerELIG"),
  // so word-boundary matching doesn't work here - plain substring match is correct.
  const headerText = table.querySelector("thead")?.textContent ?? "";
  return /POS/i.test(headerText);
}

export function resolveRosterTable(root = document) {
  const candidates = queryFirstAll(root, SELECTORS.rosterTable);
  return candidates.find(hasPositionColumn) ?? null;
}

export function resolveRosterRows(table) {
  if (!table) return [];
  return queryFirstAll(table, SELECTORS.rosterRow);
}

export function isEmptySlotRow(row) {
  if (findPlayerLinks(row).length > 0) return false;
  return EMPTY_SLOT_TEXT.test(row.textContent || "");
}

export function extractPlayerNameFromRow(row) {
  const link = row.querySelector ? findPlayerLinks(row)[0] : null;
  if (link) {
    const title = nearestTitle(link);
    if (title) return title;
    if (link.textContent.trim()) return link.textContent.trim();
  }
  return null;
}

export function extractPositionSlotFromRow(row) {
  const cell = queryFirst(row, SELECTORS.positionCell);
  return cell ? cell.textContent.trim() : null;
}

export function resolvePickHistoryRows(root = document) {
  return queryFirstAll(root, SELECTORS.pickHistoryRow);
}
