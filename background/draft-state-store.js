import { STORAGE_KEYS, DEFAULT_DRAFT_STATE } from "../shared/constants.js";

export async function getDraftState() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DRAFT_STATE);
  return { ...DEFAULT_DRAFT_STATE, ...(result[STORAGE_KEYS.DRAFT_STATE] ?? {}) };
}

export async function setDraftState(draftState) {
  await chrome.storage.local.set({ [STORAGE_KEYS.DRAFT_STATE]: draftState });
  return draftState;
}

export async function removeRosterPlayerByNormalizedName(normalizedName) {
  const state = await getDraftState();
  const next = {
    ...state,
    myRoster: state.myRoster.filter((entry) => entry.playerNameNormalized !== normalizedName),
  };
  await setDraftState(next);
  return next;
}

export async function removeLastRosterPlayer() {
  const state = await getDraftState();
  if (state.myRoster.length === 0) return state;
  const next = { ...state, myRoster: state.myRoster.slice(0, -1) };
  await setDraftState(next);
  return next;
}

export async function resetDraftState() {
  const next = { ...DEFAULT_DRAFT_STATE };
  await setDraftState(next);
  return next;
}
