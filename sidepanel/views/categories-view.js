import { CATEGORIES, CATEGORY_LABELS, COUNTING_CATEGORIES } from "../../shared/constants.js";
import { computeTeamTotals, computeStrengthWeakness, draftablePool } from "../../shared/stats-aggregator.js";

export function renderCategoriesView(root, state, actions) {
  const { settings, projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const puntedCategories = settings.puntedCategories ?? [];
  const teamTotals = computeTeamTotals(draftState.myRoster, projections);
  // Calibrate against the draftable pool, not the whole file - see DRAFTABLE_POOL_SIZE.
  const baseline = draftablePool(projections);
  const strength = computeStrengthWeakness(teamTotals, baseline, puntedCategories);

  const header = document.createElement("h2");
  header.textContent = "Category totals & strength";
  root.appendChild(header);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Category</th><th>Total</th><th>Avg/player</th><th>Strength</th><th>Punt</th></tr>
    </thead>
    <tbody>
      ${CATEGORIES.map((cat) => {
        const total = teamTotals.totals[cat] ?? 0;
        // Already per-player (percentages are means, counting stats pre-divided).
        const avg = teamTotals.perPlayer[cat] ?? 0;
        const { rank, zScore } = strength[cat];
        const isCounting = COUNTING_CATEGORIES.includes(cat);
        const isPunted = puntedCategories.includes(cat);
        return `
          <tr>
            <td>${CATEGORY_LABELS[cat]}</td>
            <td>${isCounting ? total.toFixed(1) : "-"}</td>
            <td>${avg.toFixed(isCounting ? 1 : 3)}</td>
            <td><span class="badge ${rank}">${rank}</span> <span class="muted">(z=${zScore.toFixed(2)})</span></td>
            <td><input type="checkbox" data-punt-category="${cat}" ${isPunted ? "checked" : ""} /></td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  root.appendChild(table);

  table.querySelectorAll("[data-punt-category]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const cat = checkbox.dataset.puntCategory;
      const next = checkbox.checked
        ? [...puntedCategories, cat]
        : puntedCategories.filter((c) => c !== cat);
      await actions.setPuntedCategories(next);
    });
  });

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Strength is your team's per-player average vs. the full projections pool. Check \"Punt\" on a category you're deliberately giving up on - it's excluded entirely from Suggestions' value and need-weighting (not just ignored as a weakness).";
  root.appendChild(note);
}
