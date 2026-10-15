# Fantasy Basketball Assistant

A Chrome extension that tracks your ESPN fantasy basketball draft and ranks/suggests picks from your own projections.

## What it does

- **My Team** — reads your roster live from ESPN's "My Roster" panel in the draft room, with manual add/remove as a fallback.
- **Categories** — your team's running category totals and strength/weakness vs. the full player pool.
- **Suggestions** — remaining players ranked by need-weighted value (boosted toward categories you're weak in).
- **Rankings** — remaining players in the exact order your projections CSV had them in, filtered against everyone picked so far (read from ESPN's "Pick History" panel, any team).
- **Setup** — projection load status, and a "Clear everything" reset for starting a new draft.

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
2. Open the side panel on an ESPN fantasy basketball draft room tab.
3. While drafting, keep an eye on the **Roster** and **Pick History** tabs in ESPN's own UI occasionally — this extension reads from those panels and only updates when they're actually rendered.

## Projections data

`shared/projections-data.js` is bundled from a local CSV and is gitignored (not committed — it's personal projection data). To (re)generate it:

1. Edit `SOURCE_CSV` in `scripts/update-projections.mjs` to point at your projections CSV.
2. Run:
   ```
   npm run update-projections
   ```
3. Reload the unpacked extension in `chrome://extensions`.

The CSV needs a player name column plus the 9 standard category columns (PTS, REB, AST, STL, BLK, 3PM, FG%, FT%, TO) under any reasonable header naming — column matching is alias-based.

## Tests

```
npm install
npm test
```

Tests cover the pure logic (CSV parsing, name matching, stats/suggestions math) and the DOM scrapers against real exported ESPN markup patterns.

## Known limitations

- ESPN's draft room markup isn't publicly documented and may change; if detection breaks, `content/selectors.js` is the one file centralizing all the DOM selectors.
- Suggestions/Rankings are only as good as the projections CSV you provide.
