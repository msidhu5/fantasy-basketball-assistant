import { matchPlayerName, normalizeName } from "../shared/name-matcher.js";
import { reconcileRoster } from "../shared/roster-reconciler.js";
import { getProjections } from "./settings-store.js";
import {
  getDraftState,
  setDraftState,
  removeLastRosterPlayer,
  removeRosterPlayerByNormalizedName,
  resetDraftState,
} from "./draft-state-store.js";
import { enqueue } from "./task-queue.js";

/**
 * Reconciles a freshly scraped draft snapshot (my roster + pick history) against
 * the stored state in a single read-modify-write, queued so it can't race with a
 * concurrent manual add/remove or another snapshot.
 */
export async function processDraftSnapshot({ myRosterPlayers, pickHistoryPlayers }) {
  return enqueue(async () => {
    const [state, projectionsMap] = await Promise.all([getDraftState(), getProjections()]);
    const myRoster = reconcileRoster(state.myRoster, myRosterPlayers, projectionsMap, normalizeName, matchPlayerName);
    const draftPickHistory = reconcileRoster(state.draftPickHistory, pickHistoryPlayers, projectionsMap, normalizeName, matchPlayerName);
    const draftState = await setDraftState({ ...state, myRoster, draftPickHistory });
    return { draftState };
  });
}

export async function processManualAdd(playerNameRaw) {
  return enqueue(async () => {
    const playerNameNormalized = normalizeName(playerNameRaw);
    const state = await getDraftState();
    const isDuplicate = state.myRoster.some((entry) => entry.playerNameNormalized === playerNameNormalized);
    if (isDuplicate) {
      return { draftState: state, duplicate: true };
    }

    const projectionsMap = await getProjections();
    const matchResult = matchPlayerName(playerNameRaw, projectionsMap);
    const entry = {
      playerNameRaw,
      playerNameNormalized,
      positionSlot: null,
      matchedProjectionKey: matchResult.key,
      timestampDetected: Date.now(),
      source: "manual",
    };

    const draftState = await setDraftState({ ...state, myRoster: [...state.myRoster, entry] });
    return { draftState, duplicate: false };
  });
}

export async function undoLastRosterPlayer() {
  return enqueue(() => removeLastRosterPlayer());
}

export async function removeRosterPlayer(rawOrNormalizedName) {
  return enqueue(() => removeRosterPlayerByNormalizedName(normalizeName(rawOrNormalizedName)));
}

export async function resetDraft() {
  return enqueue(() => resetDraftState());
}
