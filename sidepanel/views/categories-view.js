import { CATEGORIES, CATEGORY_LABELS, COUNTING_CATEGORIES } from "../../shared/constants.js";
import { computeTeamTotals, computeStrengthWeakness } from "../../shared/stats-aggregator.js";

export function renderCategoriesView(root, state) {
  const { projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const teamTotals = computeTeamTotals(draftState.myRoster, projections);
  const strength = computeStrengthWeakness(teamTotals, projections);

  const header = document.createElement("h2");
  header.textContent = "Category totals & strength";
  root.appendChild(header);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Category</th><th>Total</th><th>Avg/player</th><th>Strength</th></tr>
    </thead>
    <tbody>
      ${CATEGORIES.map((cat) => {
        const total = teamTotals.totals[cat] ?? 0;
        const avg = teamTotals.playerCount > 0 ? total / teamTotals.playerCount : 0;
        const { rank, zScore } = strength[cat];
        const isCounting = COUNTING_CATEGORIES.includes(cat);
        return `
          <tr>
            <td>${CATEGORY_LABELS[cat]}</td>
            <td>${isCounting ? total.toFixed(1) : "-"}</td>
            <td>${avg.toFixed(isCounting ? 1 : 3)}</td>
            <td><span class="badge ${rank}">${rank}</span> <span class="muted">(z=${zScore.toFixed(2)})</span></td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  root.appendChild(table);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "Strength is your team's per-player average vs. the full projections pool.";
  root.appendChild(note);
}
