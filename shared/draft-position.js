import { groupPicksByTeam, identifyMyTeam } from "./team-standings.js";

const MAX_ROUNDS = 40;

/**
 * Works out where we are in the draft and when the user picks again, so the
 * Rankings tab can answer "will this player still be here at my next turn?"
 *
 * Assumes a snake draft (ESPN's default): round 1 runs slots 1..N, round 2 runs
 * N..1, and so on. The draft order is recovered from pick history itself - entries
 * are stored in DOM order, which is draft order, so the distinct teams in order of
 * first appearance ARE the round-1 slot order.
 *
 * IMPORTANT: that only holds once round 1 is COMPLETE. Mid-first-round, the distinct
 * teams seen so far undercount the league (1 pick in => "a 1-team league"), which
 * would otherwise produce confidently wrong next-turn estimates during the exact
 * stretch where they'd be acted on. Round 1 is detected as complete when some team
 * has picked twice; until then this reports no estimate rather than a wrong one.
 *
 * `nextPickAfterThis` is deliberately the user's next turn STRICTLY AFTER the pick
 * currently on the clock. If it's your pick right now, the useful question isn't
 * "do I pick at this pick" - it's "if I pass on him now, is he gone by my next one".
 *
 * Returns isExact: false when the slot couldn't be determined (no team attribution,
 * or my team never appears in history). Callers should treat the estimate as soft -
 * it falls back to one full round, which is the average snake gap but can be well
 * off at either end of the turn.
 */
export function computeDraftPosition(draftPickHistory, myRoster = []) {
  const currentPick = draftPickHistory.length + 1;

  const slotOrder = [];
  const seen = new Set();
  for (const entry of draftPickHistory) {
    const team = entry.teamNameRaw;
    if (!team || seen.has(team)) continue;
    seen.add(team);
    slotOrder.push(team);
  }
  const teamCount = slotOrder.length;

  const { byTeam } = groupPicksByTeam(draftPickHistory);
  const myTeamName = identifyMyTeam(byTeam, myRoster);

  // Until a team has picked twice we haven't wrapped round 1, so slotOrder is a
  // partial round and teamCount is an undercount - unusable for snake math.
  const roundOneComplete = [...byTeam.values()].some((picks) => picks.length >= 2);

  if (teamCount === 0 || !roundOneComplete) {
    return {
      currentPick,
      teamCount: roundOneComplete ? teamCount : null,
      myTeamName,
      mySlot: null,
      nextPickAfterThis: null,
      picksUntilNextTurn: null,
      isExact: false,
    };
  }

  const slotIdx = myTeamName ? slotOrder.indexOf(myTeamName) : -1;

  if (slotIdx === -1) {
    // No slot known: assume an average snake gap of one full round.
    const nextPickAfterThis = currentPick + teamCount;
    return {
      currentPick,
      teamCount,
      myTeamName,
      mySlot: null,
      nextPickAfterThis,
      picksUntilNextTurn: nextPickAfterThis - currentPick,
      isExact: false,
    };
  }

  const mySlot = slotIdx + 1;
  // Overall pick number for my turn in a given 1-based round, snaking each round.
  const myPickInRound = (round) =>
    round % 2 === 1 ? (round - 1) * teamCount + mySlot : round * teamCount + 1 - mySlot;

  let nextPickAfterThis = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const pick = myPickInRound(round);
    if (pick > currentPick) {
      nextPickAfterThis = pick;
      break;
    }
  }

  return {
    currentPick,
    teamCount,
    myTeamName,
    mySlot,
    nextPickAfterThis,
    picksUntilNextTurn: nextPickAfterThis == null ? null : nextPickAfterThis - currentPick,
    isExact: nextPickAfterThis != null,
  };
}

/**
 * True when market consensus says this player goes before the user's next turn -
 * i.e. passing on them now probably means losing them.
 */
export function likelyGoneByNextTurn(effectiveAdp, nextPickAfterThis) {
  if (typeof effectiveAdp !== "number" || effectiveAdp <= 0) return false;
  if (typeof nextPickAfterThis !== "number") return false;
  return effectiveAdp < nextPickAfterThis;
}
