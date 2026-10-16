import { CATEGORIES, CATEGORY_LABELS, COUNTING_CATEGORIES } from "../../shared/constants.js";
import { computeTeamStandings } from "../../shared/team-standings.js";

export function renderStandingsView(root, state) {
  const { projections, draftState } = state;
  root.innerHTML = "";

  if (Object.keys(projections).length === 0) {
    root.innerHTML = `<p class="muted">Projections haven't loaded yet.</p>`;
    return;
  }

  const standings = computeTeamStandings(draftState.draftPickHistory, projections, draftState.myRoster);

  const header = document.createElement("h2");
  header.textContent = `Category standings (${standings.teamCount} teams)`;
  root.appendChild(header);

  if (standings.teamCount === 0) {
    root.innerHTML += `<p class="muted">No picks with a team attached yet. Open ESPN's "Pick History" panel so this can read who drafted whom.</p>`;
    return;
  }

  if (!standings.myTeam) {
    const warn = document.createElement("p");
    warn.className = "muted";
    warn.textContent =
      "Couldn't tell which team is yours yet - that needs at least one player on your My Team tab to also show up in Pick History. Per-team totals are below.";
    root.appendChild(warn);
  }

  if (standings.myTeam) {
    const mine = standings.myTeam;
    const firsts = CATEGORIES.filter((c) => mine.ranks[c] === 1).length;
    const topThree = CATEGORIES.filter((c) => mine.ranks[c] <= 3).length;

    const summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent = `${mine.teamName} — leading ${firsts} categor${firsts === 1 ? "y" : "ies"}, top-3 in ${topThree} of ${CATEGORIES.length}.`;
    root.appendChild(summary);

    const myTable = document.createElement("table");
    myTable.innerHTML = `
      <thead><tr><th>Category</th><th>My total</th><th>Rank</th><th>Leader</th></tr></thead>
      <tbody>
        ${CATEGORIES.map((cat) => {
          const rank = mine.ranks[cat];
          const leader = standings.teams.reduce((best, t) => (t.ranks[cat] < best.ranks[cat] ? t : best), standings.teams[0]);
          const rankClass = rank === 1 ? "strong" : rank <= 3 ? "neutral" : "weak";
          return `
            <tr>
              <td>${CATEGORY_LABELS[cat]}</td>
              <td>${formatStat(cat, mine.totals[cat])}</td>
              <td><span class="badge ${rankClass}">${rank} / ${standings.teamCount}</span></td>
              <td class="muted">${leader.isMine ? "—" : `${escapeHtml(truncate(leader.teamName))} (${formatStat(cat, leader.totals[cat])})`}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    `;
    root.appendChild(myTable);
  }

  const allHeader = document.createElement("h2");
  allHeader.textContent = "All teams";
  allHeader.style.marginTop = "16px";
  root.appendChild(allHeader);

  const allTable = document.createElement("table");
  allTable.innerHTML = `
    <thead>
      <tr>
        <th>Team</th>
        <th title="Picks whose stats were found in your projections, vs. total picks">Matched</th>
        ${CATEGORIES.map((c) => `<th>${CATEGORY_LABELS[c]}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${standings.teams
        .map(
          (t) => `
        <tr${t.isMine ? ' style="font-weight:600"' : ""}>
          <td>${escapeHtml(truncate(t.teamName))}${t.isMine ? " (you)" : ""}</td>
          <td class="muted">${t.matchedCount}/${t.pickCount}</td>
          ${CATEGORIES.map((c) => `<td title="${formatStat(c, t.totals[c])}">${t.ranks[c]}</td>`).join("")}
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;
  root.appendChild(allTable);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "All-teams table shows each team's RANK per category (hover a cell for the raw total). A team's totals only count picks found in your projections file, so a low \"Matched\" count means that team's numbers read artificially low.";
  root.appendChild(note);

  if (standings.unattributedCount > 0) {
    const unattributed = document.createElement("p");
    unattributed.className = "muted";
    unattributed.textContent = `${standings.unattributedCount} pick(s) had no team attached and are excluded here — those were likely recorded before team tracking, so "Clear everything" on Setup will clean them up.`;
    root.appendChild(unattributed);
  }
}

function truncate(str, max = 22) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function formatStat(category, value) {
  if (value == null) return "-";
  if (!COUNTING_CATEGORIES.includes(category)) return value.toFixed(3);
  return Number(value).toFixed(1);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
