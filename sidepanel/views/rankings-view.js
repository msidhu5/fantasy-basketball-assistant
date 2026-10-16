import { CATEGORIES, CATEGORY_LABELS } from "../../shared/constants.js";
import { computeUndraftedPool, listUndraftedInUploadOrder } from "../../shared/suggestion-engine.js";
import { computeDraftPosition, likelyGoneByNextTurn } from "../../shared/draft-position.js";

const RANKINGS_LIMIT = 50;

export function renderRankingsView(root, state) {
  const { projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const allDrafted = [...draftState.myRoster, ...draftState.draftPickHistory];
  const undraftedPool = computeUndraftedPool(projections, allDrafted);
  const rankings = listUndraftedInUploadOrder(undraftedPool, RANKINGS_LIMIT);

  const position = computeDraftPosition(draftState.draftPickHistory, draftState.myRoster);

  const header = document.createElement("h2");
  header.textContent = `Top remaining (${Object.keys(undraftedPool).length} still available)`;
  root.appendChild(header);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "In the same order as your uploaded projections file - not re-ranked by this extension. See Suggestions for a need-weighted version.";
  root.appendChild(note);

  const urgencyNote = document.createElement("p");
  urgencyNote.className = "muted";
  if (position.nextPickAfterThis != null) {
    urgencyNote.textContent =
      `"Won't last" = ADP says they go before your next turn (pick ~${position.nextPickAfterThis}, ${position.picksUntilNextTurn} picks away` +
      `${position.isExact ? `, slot ${position.mySlot} of ${position.teamCount}` : ", estimated"}) - so passing now probably loses them.`;
  } else {
    urgencyNote.textContent =
      "\"Won't last\" tags need your draft slot, which can't be worked out until round 1 wraps and your team shows up in Pick History. Until then ADP is shown without tags.";
  }
  root.appendChild(urgencyNote);

  if (rankings.length === 0) {
    root.innerHTML += `<p class="muted">No undrafted players left in your projections.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Player</th>
        <th>ADP</th>
        <th></th>
        ${CATEGORIES.map((c) => `<th>${CATEGORY_LABELS[c]}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rankings
        .map((r, idx) => {
          const hasAdp = typeof r.ADP === "number" && r.ADP > 0;
          const wontLast = likelyGoneByNextTurn(hasAdp ? r.ADP : null, position.nextPickAfterThis);
          return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(r.rawName)}</td>
          <td>${hasAdp ? r.ADP.toFixed(1) : "-"}</td>
          <td>${wontLast ? '<span class="badge weak" title="ADP says they go before your next turn">Won\'t last</span>' : ""}</td>
          ${CATEGORIES.map((c) => `<td>${formatStat(c, r[c])}</td>`).join("")}
        </tr>
      `;
        })
        .join("")}
    </tbody>
  `;
  root.appendChild(table);
}

function formatStat(category, value) {
  if (value == null) return "-";
  if (category === "FGPCT" || category === "FTPCT") return value.toFixed(3);
  return Number(value).toFixed(1);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
