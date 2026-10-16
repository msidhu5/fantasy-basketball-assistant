import { CATEGORY_LABELS } from "../../shared/constants.js";
import { computeTeamTotals, computeStrengthWeakness, draftablePool } from "../../shared/stats-aggregator.js";
import { computeUndraftedPool, rankSuggestions } from "../../shared/suggestion-engine.js";
import { computeDraftPosition } from "../../shared/draft-position.js";

export function renderSuggestionsView(root, state) {
  const { settings, projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const puntedCategories = settings.puntedCategories ?? [];
  const baseline = draftablePool(projections);
  const teamTotals = computeTeamTotals(draftState.myRoster, projections);
  const strength = computeStrengthWeakness(teamTotals, baseline, puntedCategories);
  const allDrafted = [...draftState.myRoster, ...draftState.draftPickHistory];
  const undraftedPool = computeUndraftedPool(projections, allDrafted);
  const position = computeDraftPosition(draftState.draftPickHistory, draftState.myRoster);
  const currentPick = position.currentPick;
  const suggestions = rankSuggestions(undraftedPool, strength, {
    puntedCategories,
    currentPick,
    baselineMap: baseline,
    nextPickAfterThis: position.nextPickAfterThis,
  });

  const header = document.createElement("h2");
  header.textContent = `Suggested next picks (${Object.keys(undraftedPool).length} still available)`;
  root.appendChild(header);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = `Ranked by category fit AND draft value at pick ~${currentPick}. Excludes everyone seen in Pick History (${draftState.draftPickHistory.length} picks tracked) as well as your own roster.${puntedCategories.length ? ` Punting: ${puntedCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}.` : ""}`;
  root.appendChild(note);

  if (suggestions.length === 0) {
    root.innerHTML += `<p class="muted">No undrafted players left in your projections.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th title="Combined fit + draft value">Score</th>
        <th>Player</th>
        <th title="Category-fit value, ignoring draft position">Fit</th>
        <th>ADP</th>
        <th title="Rounds of draft value vs. the current pick; negative = reaching">Val</th>
        <th title="Chance he's still on the board at your next turn">Last?</th>
        <th title="What you'd lose by waiting: his edge over the best player likely to survive to your next turn, scaled by the chance he's gone">Urg</th>
        <th>Boosted for</th>
      </tr>
    </thead>
    <tbody>
      ${suggestions
        .map(
          (s) => `
        <tr>
          <td>${s.score.toFixed(2)}</td>
          <td>${escapeHtml(s.rawName)}</td>
          <td class="muted">${s.fitValue.toFixed(2)}</td>
          <td class="muted">${s.adp != null ? s.adp.toFixed(1) : `<span title="No ADP in file; using rank ${s.effectiveAdp}">~${s.effectiveAdp ?? "-"}</span>`}</td>
          <td class="${s.roundsOfValue > 0.25 ? "" : "muted"}">${s.roundsOfValue >= 0 ? "+" : ""}${s.roundsOfValue.toFixed(1)}</td>
          <td class="muted">${s.availability != null ? `${Math.round(s.availability * 100)}%` : "-"}</td>
          <td class="${s.nowValue > 0.05 ? "" : "muted"}">${s.nowValue != null ? s.nowValue.toFixed(2) : "-"}</td>
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
