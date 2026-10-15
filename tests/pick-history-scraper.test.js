import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { scrapePickHistory } from "../content/pick-history-scraper.js";

// Trimmed-down reproduction of ESPN's real Pick History panel markup (confirmed
// live): a `.pick-history-table` wrapping a fixed-data-table grid whose body
// rows carry the bodyRow class (the header row doesn't), each with a
// `.player-column` cell using the same title-attribute name pattern confirmed
// everywhere else in the draft room.
const PICK_HISTORY_HTML = `
  <div class="pick-history-table isViewing">
    <div class="caption">Round 1</div>
    <div class="players-table">
      <div class="fixedDataTableLayout_main" role="grid">
        <div role="row" class="fixedDataTableLayout_header public_fixedDataTable_header">
          <div>Pick</div><div>Player</div><div>Team</div><div>RK</div>
        </div>
        <div role="row" class="public_fixedDataTableRow_even public_fixedDataTable_bodyRow">
          <div class="public_fixedDataTableCell_cellContent">1</div>
          <div class="public_fixedDataTableCell_cellContent">
            <div class="player-column">
              <span class="playerinfo__playername truncate">
                <span class="truncate">
                  <a class="AnchorLink link clr-link pointer player-news" tabindex="0" title="Victor Wembanyama" rel="">Victor Wembanyama</a>
                </span>
              </span>
            </div>
          </div>
          <div class="public_fixedDataTableCell_cellContent">Anastasios's Astounding Team</div>
        </div>
        <div role="row" class="public_fixedDataTableRow_odd public_fixedDataTable_bodyRow">
          <div class="public_fixedDataTableCell_cellContent">2</div>
          <div class="public_fixedDataTableCell_cellContent">
            <div class="player-column">
              <span class="playerinfo__playername truncate">
                <span class="truncate">
                  <a class="AnchorLink link clr-link pointer player-news" tabindex="0" title="Luka Doncic" rel="">Luka Doncic</a>
                </span>
              </span>
            </div>
          </div>
          <div class="public_fixedDataTableCell_cellContent">Some Other Team</div>
        </div>
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

  it("returns nothing when no pick-history panel is present", () => {
    const doc = docFromHtml(`<div id="unrelated">nothing here</div>`);
    const picks = scrapePickHistory(doc);
    expect(picks).toHaveLength(0);
  });
});
