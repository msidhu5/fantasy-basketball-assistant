import { CATEGORIES, CATEGORY_LABELS } from "../../shared/constants.js";
import { computeUndraftedPool, listUndraftedInUploadOrder } from "../../shared/suggestion-engine.js";

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

  const header = document.createElement("h2");
  header.textContent = `Top remaining (${Object.keys(undraftedPool).length} still available)`;
  root.appendChild(header);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "In the same order as your uploaded projections file - not re-ranked by this extension. See Suggestions for a need-weighted version.";
  root.appendChild(note);

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
        ${CATEGORIES.map((c) => `<th>${CATEGORY_LABELS[c]}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rankings
        .map(
          (r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(r.rawName)}</td>
          ${CATEGORIES.map((c) => `<td>${formatStat(c, r[c])}</td>`).join("")}
        </tr>
      `
        )
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
