import { MESSAGE_TYPES, DEFAULT_SETTINGS, DEFAULT_DRAFT_STATE } from "../shared/constants.js";
import { renderSetupView } from "./views/setup-view.js";
import { renderMyTeamView } from "./views/my-team-view.js";
import { renderCategoriesView } from "./views/categories-view.js";
import { renderSuggestionsView } from "./views/suggestions-view.js";
import { renderRankingsView } from "./views/rankings-view.js";
import { renderStandingsView } from "./views/standings-view.js";

const state = {
  settings: DEFAULT_SETTINGS,
  projections: {},
  draftState: DEFAULT_DRAFT_STATE,
};

let activeTab = "my-team";

function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (!response) {
        reject(new Error("No response from background"));
        return;
      }
      if (!response.ok) {
        reject(new Error(response.error));
        return;
      }
      resolve(response.result);
    });
  });
}

const actions = {
  async addManualPlayer(playerNameRaw) {
    await sendMessage(MESSAGE_TYPES.MANUAL_ROSTER_ADD, { playerNameRaw });
    await refreshSnapshot();
  },
  async removePlayer(playerNameRaw) {
    await sendMessage(MESSAGE_TYPES.MANUAL_ROSTER_REMOVE, { playerNameRaw });
    await refreshSnapshot();
  },
  async requestRescrape() {
    await sendMessage(MESSAGE_TYPES.REQUEST_RESCRAPE, {});
  },
  async resetDraft() {
    await sendMessage(MESSAGE_TYPES.RESET_DRAFT, {});
    await refreshSnapshot();
  },
  async setPuntedCategories(categories) {
    await sendMessage(MESSAGE_TYPES.SET_PUNTED_CATEGORIES, { categories });
    await refreshSnapshot();
  },
};

async function refreshSnapshot() {
  const snapshot = await sendMessage(MESSAGE_TYPES.STATE_SNAPSHOT_REQUEST, {});
  state.settings = snapshot.settings;
  state.draftState = snapshot.draftState;
  state.projections = snapshot.projections;
  render();
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  render();
}

function render() {
  const root = document.getElementById("view-root");
  switch (activeTab) {
    case "setup":
      renderSetupView(root, state, actions);
      break;
    case "my-team":
      renderMyTeamView(root, state, actions);
      break;
    case "categories":
      renderCategoriesView(root, state, actions);
      break;
    case "suggestions":
      renderSuggestionsView(root, state);
      break;
    case "rankings":
      renderRankingsView(root, state);
      break;
    case "standings":
      renderStandingsView(root, state);
      break;
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

chrome.storage.onChanged.addListener(() => {
  refreshSnapshot().catch((err) => console.error("[Fantasy Basketball Assistant] refresh failed", err));
});

(async () => {
  setActiveTab("my-team");
  await refreshSnapshot();
})();
