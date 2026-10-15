import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { extractPlayerNameFromRow } from "../content/selectors.js";

function rowFromHtml(html) {
  const dom = new JSDOM(`<div>${html}</div>`);
  return dom.window.document.querySelector("div").firstElementChild;
}

describe("extractPlayerNameFromRow (against real exported ESPN markup patterns)", () => {
  it("reads the full name from a title attribute directly on the player-news link (available-players panel pattern), ignoring the news-icon link", () => {
    const row = rowFromHtml(`
      <div class="player-column">
        <span class="playerinfo__playername truncate">
          <span class="truncate">
            <a class="AnchorLink link clr-link pointer player-news" tabindex="0" title="Mitchell Robinson" rel="">Mitchell Robinson</a>
          </span>
        </span>
        <span class="truncate">
          <a class="AnchorLink link clr-link pointer player-news" tabindex="0" aria-label="News about Mitchell Robinson who plays Center for the Boston Celtics" title="News about Mitchell Robinson" rel="">
            <svg class="icon-light news-light icon__svg"></svg>
          </a>
        </span>
        <span class="playerinfo__playerteam">BOS</span>
      </div>
    `);
    expect(extractPlayerNameFromRow(row)).toBe("Mitchell Robinson");
  });

  it("reads the full name from an ancestor's title attribute when the link text itself is abbreviated (roster-table pattern)", () => {
    const row = rowFromHtml(`
      <div title="Cade Cunningham" class="table--cell player-column">
        <div class="player-column__content flex items-center">
          <div class="flex flex-column">
            <div class="player-link-container flex">
              <span class="truncate">
                <a class="AnchorLink link clr-link pointer" tabindex="0" rel="">C. Cunningham</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(extractPlayerNameFromRow(row)).toBe("Cade Cunningham");
  });

  it("returns null when no player link is present (e.g. an empty roster slot)", () => {
    const row = rowFromHtml(`<div class="player-column__empty">Empty</div>`);
    expect(extractPlayerNameFromRow(row)).toBeNull();
  });
});
