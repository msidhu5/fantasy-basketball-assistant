export function renderSetupView(root, state, actions) {
  const { settings, draftState } = state;
  root.innerHTML = "";

  const projSection = document.createElement("section");
  projSection.innerHTML = `
    <h2>Projections</h2>
    <p class="muted">Bundled with the extension (static for now).</p>
    ${
      settings.projectionsLoadError
        ? `<p style="color:var(--weak)">Failed to load: ${escapeHtml(settings.projectionsLoadError)}</p>`
        : `<p class="muted">${settings.projectionsPlayerCount} players loaded${settings.csvUploadedAt ? ` &middot; last loaded ${new Date(settings.csvUploadedAt).toLocaleString()}` : ""}.</p>`
    }
  `;
  root.appendChild(projSection);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Your roster is read from ESPN's \"My Roster\" panel, and who's still available is read from the \"Pick History\" panel - keep an eye on both tabs occasionally while drafting so this extension can stay in sync. Use the My Team tab to add/remove a player manually if a pick is ever missed.";
  root.appendChild(note);

  const resetSection = document.createElement("section");
  resetSection.innerHTML = `
    <h2>Starting a new draft?</h2>
    <p class="muted">Clears your tracked roster (${draftState.myRoster.length}) and pick history (${draftState.draftPickHistory.length}) from this device. Projections are untouched.</p>
  `;
  const resetBtn = document.createElement("button");
  resetBtn.className = "secondary";
  resetBtn.textContent = "Clear everything";
  resetBtn.addEventListener("click", async () => {
    if (!confirm("Clear your tracked roster and pick history? This can't be undone.")) return;
    resetBtn.disabled = true;
    resetBtn.textContent = "Clearing...";
    try {
      await actions.resetDraft();
    } finally {
      resetBtn.disabled = false;
      resetBtn.textContent = "Clear everything";
    }
  });
  resetSection.appendChild(resetBtn);
  root.appendChild(resetSection);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
