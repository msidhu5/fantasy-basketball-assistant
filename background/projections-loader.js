import { CATEGORY_HEADER_ALIASES, OPTIONAL_HEADER_ALIASES } from "../shared/constants.js";
import { PROJECTIONS_CSV } from "../shared/projections-data.js";
import { parseCsv, suggestColumnMapping, buildProjectionsMap } from "../shared/csv-parser.js";
import { normalizeName } from "../shared/name-matcher.js";
import { setProjections, updateSettings } from "./settings-store.js";

/**
 * Builds the projections map from the CSV bundled into the extension
 * (shared/projections-data.js) - hardcoded for now instead of an upload flow,
 * so no file:// access/permissions or manual mapping step are needed at runtime.
 * Re-run `npm run update-projections` to refresh the bundled data from a new CSV.
 */
export async function loadProjections() {
  try {
    const parsed = parseCsv(PROJECTIONS_CSV);
    const mapping = suggestColumnMapping(parsed.headers, {
      ...CATEGORY_HEADER_ALIASES,
      ...OPTIONAL_HEADER_ALIASES,
    });
    const projectionsMap = buildProjectionsMap(parsed.rows, mapping, normalizeName);
    const playerCount = Object.keys(projectionsMap).length;

    await setProjections(projectionsMap);
    const settings = await updateSettings({
      columnMapping: mapping,
      csvUploadedAt: Date.now(),
      projectionsPlayerCount: playerCount,
    });

    return { settings, playerCount, mapping };
  } catch (err) {
    const message = String(err?.message ?? err);
    await updateSettings({ projectionsLoadError: message });
    throw new Error(message);
  }
}
