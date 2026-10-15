import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { scrapeMyRoster } from "../content/roster-scraper.js";

// Trimmed-down reproduction of ESPN's real "My Roster" table markup (confirmed
// live): a genuine <table class="Table"> with POS/Player/ELIG headers, each
// player row carrying the full name as a `title` attribute on an ancestor div
// while the visible link text is abbreviated, and empty slots rendered as a
// bare "Empty" placeholder instead of a player link.
const ROSTER_TABLE_HTML = `
  <table class="Table">
    <thead class="Table__THEAD">
      <tr class="Table__TR Table__even">
        <th><div title="Position" class="table--cell header"><span>POS</span></div></th>
        <th><div class="table--cell player-column header"><span>Player</span></div></th>
        <th><div title="Eligible Positions" class="table--cell tar player-eligible-position-column header"><span>ELIG</span></div></th>
      </tr>
    </thead>
    <tbody class="Table__TBODY">
      <tr class="Table__TR Table__TR--sm Table__even" data-idx="0">
        <td class="Table__TD"><div title="Position" class="table--cell">PG</div></td>
        <td class="Table__TD">
          <div title="Cade Cunningham" class="table--cell player-column">
            <div class="player-column__content flex items-center">
              <div class="flex flex-column">
                <div class="player-link-container flex">
                  <span class="truncate"><a class="AnchorLink link clr-link pointer" tabindex="0" rel="">C. Cunningham</a></span>
                </div>
              </div>
            </div>
          </div>
        </td>
        <td class="Table__TD"><div title="Eligible Positions" class="table--cell tar player-eligible-position-column">PG</div></td>
      </tr>
      <tr class="Table__TR Table__TR--sm Table__even" data-idx="1">
        <td class="Table__TD"><div title="Position" class="table--cell">SG</div></td>
        <td class="Table__TD">
          <div title="Tyler Herro" class="table--cell player-column">
            <div class="player-column__content flex items-center">
              <div class="flex flex-column">
                <div class="player-link-container flex">
                  <span class="truncate"><a class="AnchorLink link clr-link pointer" tabindex="0" rel="">T. Herro</a></span>
                </div>
              </div>
            </div>
          </div>
        </td>
        <td class="Table__TD"><div title="Eligible Positions" class="table--cell tar player-eligible-position-column">SG, PG</div></td>
      </tr>
      <tr class="Table__TR Table__TR--sm Table__even" data-idx="2">
        <td class="Table__TD"><div title="Position" class="table--cell">BE</div></td>
        <td class="Table__TD">
          <div class="table--cell player-column">
            <div class="player-column__empty player-column__content flex items-center">Empty</div>
          </div>
        </td>
        <td class="Table__TD"><div title="Eligible Positions" class="table--cell tar player-eligible-position-column">-</div></td>
      </tr>
    </tbody>
  </table>
`;

// Minimal reproduction of ESPN's "Available Players" panel: a virtualized
// fixed-data-table div-grid with NO real <table> element anywhere, confirmed
// to use the same player-column/title pattern for names.
const AVAILABLE_PLAYERS_HTML = `
  <div class="jsx-1839541740 players-table">
    <div class="fixedDataTableLayout_main public_fixedDataTable_main" role="grid">
      <div role="row" class="public_fixedDataTableRow_even public_fixedDataTable_bodyRow">
        <div class="player-column">
          <span class="playerinfo__playername truncate">
            <span class="truncate">
              <a class="AnchorLink link clr-link pointer player-news" tabindex="0" title="Ayo Dosunmu" rel="">Ayo Dosunmu</a>
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
`;

function docFromHtml(html) {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

describe("scrapeMyRoster", () => {
  it("extracts every real roster player, skipping empty bench slots", () => {
    const doc = docFromHtml(ROSTER_TABLE_HTML);
    const players = scrapeMyRoster(doc);

    const names = players.map((p) => p.playerNameRaw);
    expect(names).toEqual(["Cade Cunningham", "Tyler Herro"]);
    expect(names).not.toContain("Empty");

    const cunningham = players.find((p) => p.playerNameRaw === "Cade Cunningham");
    expect(cunningham.positionSlot).toBe("PG");
  });

  it("does not mistake the Available Players panel (a different, non-table widget) for the roster table", () => {
    const doc = docFromHtml(AVAILABLE_PLAYERS_HTML);
    const players = scrapeMyRoster(doc);
    expect(players).toHaveLength(0);
  });

  it("does not mistake the Draft Queue widget for the roster table, even though both render as table.Table and Queue appears first in the DOM (confirmed live: Queue header is Rank/Player, no POS column)", () => {
    const queueHtml = `
      <table class="Table">
        <thead class="Table__THEAD">
          <tr class="Table__TR"><th>Rank</th><th>Player</th></tr>
        </thead>
        <tbody class="Table__TBODY">
          <tr class="Table__TR"><td colspan="2">No players in queue</td></tr>
        </tbody>
      </table>
    `;
    const doc = docFromHtml(`<div id="queue">${queueHtml}</div><div id="roster">${ROSTER_TABLE_HTML}</div>`);

    const players = scrapeMyRoster(doc);
    expect(players.length).toBeGreaterThan(0);
    expect(players.map((p) => p.playerNameRaw)).toContain("Cade Cunningham");
  });
});
