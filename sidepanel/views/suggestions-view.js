import { CATEGORY_LABELS } from "../../shared/constants.js";
import { computeTeamTotals, computeStrengthWeakness } from "../../shared/stats-aggregator.js";
import { computeUndraftedPool, rankSuggestions } from "../../shared/suggestion-engine.js";

export function renderSuggestionsView(root, state) {
  const { projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const teamTotals = computeTeamTotals(draftState.myRoster, projections);
  const strength = computeStrengthWeakness(teamTotals, projections);
  const allDrafted = [...draftState.myRoster, ...draftState.draftPickHistory];
  const undraftedPool = computeUndraftedPool(projections, allDrafted);
  const suggestions = rankSuggestions(undraftedPool, strength);

  const header = document.createElement("h2");
  header.textContent = `Suggested next picks (${Object.keys(undraftedPool).length} still available)`;
  root.appendChild(header);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = `Excludes everyone seen in Pick History (${draftState.draftPickHistory.length} picks tracked) as well as your own roster.`;
  root.appendChild(note);

  if (suggestions.length === 0) {
    root.innerHTML += `<p class="muted">No undrafted players left in your projections.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>#</th><th>Player</th><th>Value</th><th>Boosted for</th></tr></thead>
    <tbody>
      ${suggestions
        .map(
          (s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(s.rawName)}</td>
          <td>${s.weightedValue.toFixed(2)}</td>
          <td>${s.boostedFor ? `<span class="badge weak">${CATEGORY_LABELS[s.boostedFor]}</span>` : '<span class="muted">-</span>'}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;
  root.appendChild(table);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
