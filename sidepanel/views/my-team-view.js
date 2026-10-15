import { CATEGORIES, CATEGORY_LABELS } from "../../shared/constants.js";

export function renderMyTeamView(root, state, actions) {
  const { projections, draftState } = state;
  const myRoster = draftState.myRoster;
  root.innerHTML = "";

  const header = document.createElement("h2");
  header.textContent = `My Team (${myRoster.length} rostered)`;
  root.appendChild(header);

  const controls = document.createElement("div");
  controls.innerHTML = `
    <div class="inline-form">
      <input type="text" id="manual-player-name" placeholder="Add a player by name" />
      <button class="secondary" type="button" id="manual-add-btn">Add</button>
    </div>
    <div class="row-actions">
      <button class="secondary" type="button" id="rescan-btn">Re-scan roster panel</button>
    </div>
  `;
  root.appendChild(controls);

  controls.querySelector("#manual-add-btn").addEventListener("click", async () => {
    const input = controls.querySelector("#manual-player-name");
    const playerNameRaw = input.value.trim();
    if (!playerNameRaw) return;
    await actions.addManualPlayer(playerNameRaw);
    input.value = "";
  });

  controls.querySelector("#rescan-btn").addEventListener("click", async () => {
    await actions.requestRescrape();
  });

  if (myRoster.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent =
      "No players detected yet. Open the \"Roster\" tab in the draft room so this can read your picks, or add one manually above.";
    root.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Slot</th>
        <th>Player</th>
        ${CATEGORIES.map((c) => `<th>${CATEGORY_LABELS[c]}</th>`).join("")}
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${myRoster
        .map((entry) => {
          const stats = entry.matchedProjectionKey ? projections[entry.matchedProjectionKey] : null;
          return `
            <tr>
              <td class="muted">${escapeHtml(entry.positionSlot ?? "-")}</td>
              <td>${escapeHtml(entry.playerNameRaw)}${stats ? "" : ' <span class="badge weak">no projection</span>'}</td>
              ${CATEGORIES.map((c) => `<td>${stats ? formatStat(c, stats[c]) : "-"}</td>`).join("")}
              <td><button class="link-btn" data-remove="${escapeAttr(entry.playerNameRaw)}" type="button">remove</button></td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
  root.appendChild(table);

  table.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await actions.removePlayer(btn.dataset.remove);
    });
  });
}

function formatStat(category, value) {
  if (value == null) return "-";
  if (category === "FGPCT" || category === "FTPCT") return value.toFixed(3);
  return Number(value).toFixed(1);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}
