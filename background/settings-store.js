import { STORAGE_KEYS, DEFAULT_SETTINGS } from "../shared/constants.js";

export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

export async function getProjections() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROJECTIONS);
  return result[STORAGE_KEYS.PROJECTIONS] ?? {};
}

export async function setProjections(projectionsMap) {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROJECTIONS]: projectionsMap });
  return projectionsMap;
}
