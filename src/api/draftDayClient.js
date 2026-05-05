import { DURABILITY_LABELS, DURABILITY_MULTIPLIERS } from "@/api/defaults";
import { entities } from "@/api/entitiesClient";
import { functions } from "@/api/functionsClient";
import { countPlayerWeeks } from "@/api/playerStatsClient";
import { normalizePosition } from "@/api/supabaseCore";

function durabilityLabel(value) {
  return DURABILITY_LABELS[Number(value)] || "Normal";
}

function decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer) {
  if (!player) return player;
  const tier = tiersByPlayer.get(player.id);
  const durability = durabilityByPlayer.get(player.id);
  return {
    ...player,
    tier_value: Number(tier?.tier_value || player.tier_value || 1),
    position_rank: tier?.position_rank || player.position_rank || null,
    durability: durability ? Number(durability.durability) : null,
    durability_label: durability ? durabilityLabel(durability.durability) : "Hidden",
    durability_multiplier: durability ? DURABILITY_MULTIPLIERS[Number(durability.durability)] ?? 1 : 1,
  };
}

async function loadPlayersById(playerIds) {
  if (!playerIds.length) return new Map();
  const rows = (await entities.Player.filter({ id: playerIds })).filter(Boolean);
  return new Map(rows.map((player) => [player.id, player]));
}

async function getLeagueDraftState(leagueId) {
  if (!leagueId) return null;
  const [league, members, drafts, profiles] = await Promise.all([
    entities.League.get(leagueId),
    entities.LeagueMember.filter({ league_id: leagueId }),
    entities.Draft.filter({ league_id: leagueId }, "-created_date"),
    entities.UserProfile.list(),
  ]);
  if (!league) return null;

  const profilesByEmail = new Map((profiles || []).map((profile) => [profile.user_email, profile]));
  const activeMembers = members
    .filter((member) => member.is_active !== false)
    .map((member) => {
      const profile = profilesByEmail.get(member.user_email) || null;
      return {
        ...member,
        profile,
        display_name: member.team_name || profile?.display_name || profile?.profile_name || (member.is_ai ? "AI Manager" : "Manager"),
      };
    });

  const commissionerProfile = profilesByEmail.get(league.commissioner_email) || null;
  const draft = drafts.find((row) => ["OPEN", "SCHEDULED"].includes(String(row.status || "").toUpperCase())) || drafts[0] || null;
  const [rooms, turns, picks, allBoard, rosters] = await Promise.all([
    draft ? entities.DraftRoom.filter({ draft_id: draft.id }) : [],
    draft ? entities.DraftTurn.filter({ draft_id: draft.id }, "overall_pick") : [],
    draft ? entities.DraftPick.filter({ draft_id: draft.id }, "overall_pick") : [],
    entities.DraftBoardItem.list("rank"),
    entities.Roster.list(),
  ]);

  const board = allBoard
    .filter((item) => item.league_id === leagueId || (draft?.id && item.draft_id === draft.id))
    .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
  const room = rooms[0] || null;
  const currentTurn = turns.find((turn) => Number(turn.overall_pick) === Number(room?.current_pick || 1)) || null;
  const leagueMemberIds = new Set(activeMembers.map((member) => member.id));
  const rosterRows = rosters.filter((slot) => leagueMemberIds.has(slot.league_member_id));
  const playerIds = [...new Set([
    ...picks.map((pick) => pick.player_id),
    ...board.map((item) => item.player_id),
    ...rosterRows.map((slot) => slot.player_id),
  ].filter(Boolean))];

  const seasonYear = Number(league.source_season_year || new Date().getFullYear() - 1);
  const [playersById, tierRows, durabilityRows, managerPointAccounts] = await Promise.all([
    loadPlayersById(playerIds),
    entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
    entities.LeaguePlayerDurability.filter({ league_id: leagueId }),
    entities.ManagerPointAccount.filter({ league_id: leagueId }),
  ]);
  const tiersByPlayer = new Map(tierRows.map((tier) => [tier.player_id, tier]));
  const durabilityByPlayer = new Map(durabilityRows.map((row) => [row.player_id, row]));
  const decoratePlayer = (player) => decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer);
  const boardWithPlayers = await Promise.all(board.map(async (item) => ({
    ...item,
    player: decoratePlayer(playersById.get(item.player_id)),
    weeks_played: await countPlayerWeeks(item.player_id, seasonYear),
  })));
  const teamTierTotals = Object.fromEntries(activeMembers.map((member) => [
    member.id,
    rosterRows
      .filter((slot) => slot.league_member_id === member.id)
      .reduce((sum, slot) => sum + Number(tiersByPlayer.get(slot.player_id)?.tier_value || 1), 0),
  ]));

  return {
    league,
    commissionerProfile,
    members: activeMembers,
    draft,
    room,
    turns,
    currentTurn,
    picks: picks.map((pick) => ({ ...pick, player: decoratePlayer(playersById.get(pick.player_id)), member: activeMembers.find((member) => member.id === pick.league_member_id) })),
    rosters: rosterRows.map((slot) => ({ ...slot, player: decoratePlayer(playersById.get(slot.player_id)), member: activeMembers.find((member) => member.id === slot.league_member_id) })),
    board: boardWithPlayers,
    teamTierTotals,
    managerPointAccounts,
  };
}

async function listDraftEligiblePlayers({ leagueId, draftId, searchTerm = "", position = "ALL", limit = 10, offset = 0 } = {}) {
  const league = await entities.League.get(leagueId);
  if (!league) return { data: [], hasMore: false, totalCount: 0 };
  const [draft, members, rosters, leaguePicks] = await Promise.all([
    draftId ? entities.Draft.get(draftId) : null,
    entities.LeagueMember.filter({ league_id: leagueId }),
    entities.Roster.list(),
    entities.DraftPick.filter({ league_id: leagueId }),
  ]);
  const picks = leaguePicks.length || !draft ? leaguePicks : await entities.DraftPick.filter({ draft_id: draft.id });
  const leagueMemberIds = new Set((members || []).filter((member) => member.is_active !== false).map((member) => member.id));
  const unavailableIds = new Set([
    ...picks.map((pick) => pick.player_id),
    ...(rosters || [])
      .filter((slot) => leagueMemberIds.has(slot.league_member_id))
      .map((slot) => slot.player_id),
  ]);
  let [tiers, durabilityRows] = await Promise.all([
    entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
    entities.LeaguePlayerDurability.filter({ league_id: leagueId }),
  ]);
  if (!tiers.length) {
    await functions.prepareDraftPool({ league_id: leagueId });
    [tiers, durabilityRows] = await Promise.all([
      entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
      entities.LeaguePlayerDurability.filter({ league_id: leagueId }),
    ]);
  }
  const tiersByPlayer = new Map(tiers.map((tier) => [tier.player_id, tier]));
  const durabilityByPlayer = new Map(durabilityRows.map((row) => [row.player_id, row]));
  const pageSize = Math.max(1, Number(limit || 10));
  const start = Math.max(0, Number(offset || 0));
  const target = start + pageSize;
  const candidateTiers = tiers
    .filter((tier) => Number(tier.position_rank || 0) <= 30)
    .filter((tier) => position === "ALL" || normalizePosition(tier.position) === normalizePosition(position))
    .sort((a, b) => String(a.position || "").localeCompare(String(b.position || "")) || Number(a.position_rank || 0) - Number(b.position_rank || 0));
  const playersById = await loadPlayersById(candidateTiers.map((tier) => tier.player_id));
  const rows = [];

  for (const tier of candidateTiers) {
    if (unavailableIds.has(tier.player_id)) continue;
    const player = playersById.get(tier.player_id);
    if (!player) continue;
    if (searchTerm) {
      const haystack = `${player.player_display_name || ""} ${player.full_name || ""}`.toLowerCase();
      if (!haystack.includes(String(searchTerm).toLowerCase())) continue;
    }
    rows.push({
      ...decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer),
      weeks_played: Number(tier.weeks_played || 0),
    });
  }

  return {
    data: rows.slice(start, start + pageSize),
    hasMore: rows.length > target,
    totalCount: rows.length,
  };
}

export const draftDay = {
  getState: getLeagueDraftState,
  listEligiblePlayers: listDraftEligiblePlayers,
  async addBoardItem({ draftId, leagueId, leagueMemberId, playerId } = {}) {
    const existing = (await entities.DraftBoardItem.list()).filter((item) =>
      item.league_member_id === leagueMemberId &&
      item.player_id === playerId &&
      (item.league_id === leagueId || (draftId && item.draft_id === draftId))
    );
    if (existing[0]) return existing[0];
    const board = (await entities.DraftBoardItem.list()).filter((item) =>
      item.league_member_id === leagueMemberId &&
      (item.league_id === leagueId || (draftId && item.draft_id === draftId))
    );
    return entities.DraftBoardItem.create({
      draft_id: draftId || null,
      league_id: leagueId,
      league_member_id: leagueMemberId,
      player_id: playerId,
      rank: Math.max(0, ...board.map((item) => Number(item.rank || 0))) + 1,
    });
  },
  async removeBoardItem(id) {
    return entities.DraftBoardItem.delete(id);
  },
  async setBoardOrder({ draftId, leagueId, leagueMemberId, playerIds = [] } = {}) {
    const existing = (await entities.DraftBoardItem.list()).filter((item) =>
      item.league_member_id === leagueMemberId &&
      (item.league_id === leagueId || (draftId && item.draft_id === draftId))
    );
    for (const item of existing) await entities.DraftBoardItem.delete(item.id);
    const rows = playerIds.map((playerId, index) => ({
      draft_id: draftId || null,
      league_id: leagueId,
      league_member_id: leagueMemberId,
      player_id: playerId,
      rank: index + 1,
    }));
    return entities.DraftBoardItem.bulkCreate(rows);
  },
};
