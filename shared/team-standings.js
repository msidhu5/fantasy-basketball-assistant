import { CATEGORIES, LOWER_IS_BETTER } from "./constants.js";
import { computeTeamTotals } from "./stats-aggregator.js";

/**
 * Groups pick-history entries by the drafting team's name. Entries with no team
 * (an older pick captured before team extraction existed, or a row whose team cell
 * couldn't be read) are collected under a null key and reported separately rather
 * than silently folded into some real team's totals.
 */
export function groupPicksByTeam(draftPickHistory) {
  const byTeam = new Map();
  const unattributed = [];

  for (const entry of draftPickHistory) {
    const team = entry.teamNameRaw;
    if (!team) {
      unattributed.push(entry);
      continue;
    }
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team).push(entry);
  }

  return { byTeam, unattributed };
}

/**
 * Figures out which drafting team is the user's, by overlap between each team's
 * picks and the separately-tracked "My Roster" (scraped from ESPN's roster panel,
 * which carries no team label). Returns null when there's no roster yet or no
 * overlap at all - better to show nothing than to guess wrong and mislabel a rival.
 */
export function identifyMyTeam(byTeam, myRoster) {
  const mine = new Set(myRoster.map((e) => e.playerNameNormalized).filter(Boolean));
  if (mine.size === 0) return null;

  let best = null;
  let bestOverlap = 0;
  for (const [teamName, picks] of byTeam) {
    const overlap = picks.filter((p) => mine.has(p.playerNameNormalized)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = teamName;
    }
  }

  return bestOverlap > 0 ? best : null;
}

function rankValues(entries, category) {
  // Sort best-first, flipping for categories where lower wins (TO). Ties share a rank.
  const lowerWins = LOWER_IS_BETTER.has(category);
  const sorted = [...entries].sort((a, b) => {
    const av = a.totals[category] ?? 0;
    const bv = b.totals[category] ?? 0;
    return lowerWins ? av - bv : bv - av;
  });

  const ranks = new Map();
  let lastValue = null;
  let lastRank = 0;
  sorted.forEach((entry, idx) => {
    const value = entry.totals[category] ?? 0;
    const rank = lastValue !== null && value === lastValue ? lastRank : idx + 1;
    ranks.set(entry.teamName, rank);
    lastValue = value;
    lastRank = rank;
  });
  return ranks;
}

/**
 * Builds per-team category totals and per-category ranks across every team seen in
 * the pick history.
 *
 * Caveat worth surfacing in any UI: a team's totals only count picks that
 * name-matched the projections file, so a team with unmatched picks (deep-bench guys
 * or rookies missing from the file) will read artificially low. Each team therefore
 * reports matchedCount vs. pickCount so that's visible rather than hidden.
 */
export function computeTeamStandings(draftPickHistory, projectionsMap, myRoster = []) {
  const { byTeam, unattributed } = groupPicksByTeam(draftPickHistory);
  const myTeamName = identifyMyTeam(byTeam, myRoster);

  const teams = [];
  for (const [teamName, picks] of byTeam) {
    const { totals, playerCount } = computeTeamTotals(picks, projectionsMap);
    teams.push({
      teamName,
      totals,
      pickCount: picks.length,
      matchedCount: playerCount,
      isMine: teamName === myTeamName,
    });
  }

  const ranksByCategory = {};
  for (const category of CATEGORIES) {
    const ranks = rankValues(teams, category);
    ranksByCategory[category] = ranks;
    for (const team of teams) {
      team.ranks = team.ranks ?? {};
      team.ranks[category] = ranks.get(team.teamName);
    }
  }

  // Standings table reads best-to-worst by how many categories a team leads.
  teams.sort((a, b) => {
    const aFirsts = CATEGORIES.filter((c) => a.ranks[c] === 1).length;
    const bFirsts = CATEGORIES.filter((c) => b.ranks[c] === 1).length;
    if (bFirsts !== aFirsts) return bFirsts - aFirsts;
    const aSum = CATEGORIES.reduce((s, c) => s + a.ranks[c], 0);
    const bSum = CATEGORIES.reduce((s, c) => s + b.ranks[c], 0);
    return aSum - bSum;
  });

  return {
    teams,
    teamCount: teams.length,
    myTeamName,
    myTeam: teams.find((t) => t.isMine) ?? null,
    ranksByCategory,
    unattributedCount: unattributed.length,
  };
}
