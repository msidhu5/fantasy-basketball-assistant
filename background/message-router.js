import { MESSAGE_TYPES } from "../shared/constants.js";
import { processDraftSnapshot, processManualAdd, undoLastRosterPlayer, removeRosterPlayer, resetDraft } from "./roster-processor.js";
import { getSettings, getProjections } from "./settings-store.js";
import { getDraftState } from "./draft-state-store.js";

export async function routeMessage(message, sender) {
  switch (message.type) {
    case MESSAGE_TYPES.DRAFT_SNAPSHOT: {
      return processDraftSnapshot(message.payload);
    }

    case MESSAGE_TYPES.MANUAL_ROSTER_ADD: {
      return processManualAdd(message.payload.playerNameRaw);
    }

    case MESSAGE_TYPES.MANUAL_ROSTER_REMOVE: {
      if (message.payload?.playerNameRaw) {
        return { draftState: await removeRosterPlayer(message.payload.playerNameRaw) };
      }
      return { draftState: await undoLastRosterPlayer() };
    }

    case MESSAGE_TYPES.RESET_DRAFT: {
      return { draftState: await resetDraft() };
    }

    case MESSAGE_TYPES.STATE_SNAPSHOT_REQUEST: {
      const [settings, draftState, projections] = await Promise.all([
        getSettings(),
        getDraftState(),
        getProjections(),
      ]);
      return { settings, draftState, projections };
    }

    case MESSAGE_TYPES.REQUEST_RESCRAPE: {
      const targetTabIds = sender?.tab?.id != null
        ? [sender.tab.id]
        : (await chrome.tabs.query({ url: "https://fantasy.espn.com/*" })).map((tab) => tab.id);

      await Promise.all(
        targetTabIds.map((tabId) =>
          chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.REQUEST_RESCRAPE }).catch(() => {})
        )
      );
      return { ok: true };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
