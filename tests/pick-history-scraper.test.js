import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { scrapePickHistory } from "../content/pick-history-scraper.js";

// Trimmed-down reproduction of ESPN's real Pick History panel markup (confirmed
// live): a `.pick-history-table` wrapping a fixed-data-table grid whose body
// rows carry the bodyRow class (the header row doesn't), each with a
// `.player-column` cell using the same title-attribute name pattern confirmed
// everywhere else in the draft room.
//
// The cell nesting matters and is reproduced faithfully: each cell is a
// `role="gridcell"` wrapper around (several layers of) wrap divs, with the actual
// text in an inner `.public_fixedDataTableCell_cellContent`. Columns are
// Pick | Player | Team | RK, so the team cell sits between two numeric ones.
function cell(innerHtml) {
  return `
    <div class="fixedDataTableCellLayout_main public_fixedDataTableCell_main" role="gridcell">
      <div class="fixedDataTableCellLayout_wrap1 public_fixedDataTableCell_wrap1 cell">
        <div class="fixedDataTableCellLayout_wrap2 public_fixedDataTableCell_wrap2">
          <div class="fixedDataTableCellLayout_wrap3 public_fixedDataTableCell_wrap3">
            <div class="public_fixedDataTableCell_cellContent">${innerHtml}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function playerCell(fullName) {
  return cell(`
    <div class="player-column">
      <div class="player-details">
        <div class="flex">
          <span class="playerinfo__playername truncate">
            <span class="truncate">
              <a class="AnchorLink link clr-link pointer player-news" tabindex="0" title="${fullName}" rel="">${fullName}</a>
            </span>
          </span>
        </div>
      </div>
    </div>
  `);
}

function pickRow(pickNo, fullName, teamName, rk) {
  return `
    <div role="row" class="public_fixedDataTableRow_even public_fixedDataTable_bodyRow">
      <div class="fixedDataTableRowLayout_body">
        ${cell(String(pickNo))}
        ${playerCell(fullName)}
        ${cell(teamName)}
        ${cell(String(rk))}
      </div>
    </div>
  `;
}

const PICK_HISTORY_HTML = `
  <div class="pick-history-table isViewing">
    <div class="caption">Round 1</div>
    <div class="players-table">
      <div class="fixedDataTableLayout_main" role="grid">
        <div role="row" class="fixedDataTableLayout_header public_fixedDataTable_header">
          ${cell("Pick")}${cell("Player")}${cell("Team")}${cell("RK")}
        </div>
        ${pickRow(1, "Victor Wembanyama", "Anastasios's Astounding Team", 2)}
        ${pickRow(2, "Luka Doncic", "Some Other Team", 4)}
      </div>
    </div>
  </div>
`;

function docFromHtml(html) {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

describe("scrapePickHistory", () => {
  it("extracts every pick's player name, excluding the header row", () => {
    const doc = docFromHtml(PICK_HISTORY_HTML);
    const picks = scrapePickHistory(doc);

    expect(picks.map((p) => p.playerNameRaw)).toEqual(["Victor Wembanyama", "Luka Doncic"]);
  });

  it("extracts the drafting team per pick, skipping the numeric Pick/RK columns", () => {
    const doc = docFromHtml(PICK_HISTORY_HTML);
    const picks = scrapePickHistory(doc);

    expect(picks.map((p) => p.teamNameRaw)).toEqual([
      "Anastasios's Astounding Team",
      "Some Other Team",
    ]);
  });

  it("returns nothing when no pick-history panel is present", () => {
    const doc = docFromHtml(`<div id="unrelated">nothing here</div>`);
    const picks = scrapePickHistory(doc);
    expect(picks).toHaveLength(0);
  });
});
