import { MESSAGE_TYPES } from "../shared/constants.js";
import { startObserving } from "./draft-observer.js";

let observerHandle = null;

function sendSnapshot({ myRosterPlayers, pickHistoryPlayers }) {
  if (myRosterPlayers.length > 0) {
    console.log(
      "[Fantasy Basketball Assistant] my roster:",
      myRosterPlayers.map((p) => `${p.playerNameRaw} (${p.positionSlot})`).join(", ")
    );
  }
  if (pickHistoryPlayers.length > 0) {
    console.log("[Fantasy Basketball Assistant] pick history seen:", pickHistoryPlayers.length, "picks");
  }
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.DRAFT_SNAPSHOT,
    payload: { myRosterPlayers, pickHistoryPlayers },
  });
}

export function init() {
  observerHandle = startObserving(sendSnapshot, {
    onScan: (found) => console.log(`[Fantasy Basketball Assistant] scan: roster table ${found ? "found" : "NOT found (tab inactive?)"}`),
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MESSAGE_TYPES.REQUEST_RESCRAPE) {
      observerHandle?.rescan();
    }
  });
}
