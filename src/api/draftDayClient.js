import { DEFAULT_LEAGUE_VISIBILITY_CONFIG, DURABILITY_LABELS, DURABILITY_MULTIPLIERS } from "@/api/defaults";
import { entities } from "@/api/entitiesClient";
import { functions } from "@/api/functionsClient";
import { countPlayerWeeks } from "@/api/playerStatsClient";
import { normalizePosition } from "@/api/supabaseCore";

const DRAFT_POSITION_ORDER = ["QB", "OFF", "DEF", "K"];
const DRAFT_POSITION_SET = new Set(DRAFT_POSITION_ORDER);

function durabilityLabel(value) {
  return DURABILITY_LABELS[Number(value)] || "Normal";
}

function leagueVisibility(league = {}) {
  return {
    ...DEFAULT_LEAGUE_VISIBILITY_CONFIG,
    ...league,
    fantasy_points_visibility: "hidden",
    league_type: "standard",
    manager_points_enabled: league.manager_points_enabled === true,
  };
}

function durabilityEnabled(league) {
  return leagueVisibility(league).durability_mode !== "off";
}

function canShowDurability(league, isDrafted = false) {
  const visibility = leagueVisibility(league);
  if (visibility.durability_mode === "off") return false;
  if (visibility.durability_mode === "revealed_at_draft") return true;
  return Boolean(isDrafted);
}

function canShowTeam(league, isDrafted = false) {
  const visibility = leagueVisibility(league);
  return visibility.draft_team_visibility === "shown" || Boolean(isDrafted);
}

function canShowName(league, isDrafted = false) {
  const visibility = leagueVisibility(league);
  return visibility.draft_player_name_visibility === "shown" || Boolean(isDrafted);
}

function draftBucket(position) {
  const normalized = normalizePosition(position);
  return DRAFT_POSITION_SET.has(normalized) ? normalized : null;
}

function shouldPrepareDraftPool(tiers, selectedPosition) {
  const availableBuckets = new Set(tiers.map((tier) => draftBucket(tier.position)).filter(Boolean));
  if (!tiers.length) return true;
  if (selectedPosition && selectedPosition !== "ALL") return !availableBuckets.has(draftBucket(selectedPosition));
  return DRAFT_POSITION_ORDER.some((position) => !availableBuckets.has(position));
}

function compareDraftTiers(a, b) {
  const tierDifference = Number(b.tier_value || 0) - Number(a.tier_value || 0);
  if (tierDifference) return tierDifference;
  const positionDifference = DRAFT_POSITION_ORDER.indexOf(draftBucket(a.position)) - DRAFT_POSITION_ORDER.indexOf(draftBucket(b.position));
  if (positionDifference) return positionDifference;
  return Number(a.position_rank || 0) - Number(b.position_rank || 0);
}

function tierRangeKey(position, tierValue) {
  return `${draftBucket(position) || position}:${Number(tierValue || 1)}`;
}

function formatTierRange(range) {
  if (!range) return null;
  const min = Number(range.expected_avg_points_min || 0);
  const max = Number(range.expected_avg_points_max || 0);
  return `${min.toFixed(1)}-${max.toFixed(1)}`;
}

function decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer, tierRangesByBucket, league, options = {}) {
  if (!player) return player;
  const tier = tiersByPlayer.get(player.id);
  const tierValue = Number(tier?.tier_value || player.tier_value || 1);
  const draftPosition = draftBucket(tier?.position || player.position) || tier?.position || player.position;
  const range = tierRangesByBucket.get(tierRangeKey(draftPosition, tierValue));
  const showDurability = canShowDurability(league, options.isDrafted);
  const showTeam = canShowTeam(league, options.isDrafted);
  const showName = canShowName(league, options.isDrafted);
  const durability = showDurability ? durabilityByPlayer.get(player.id) : null;
  const hiddenName = `${draftPosition || "Player"} Tier ${tierValue}`;
  return {
    ...player,
    player_display_name: showName ? player.player_display_name : hiddenName,
    full_name: showName ? player.full_name : hiddenName,
    name_hidden: !showName,
    team: showTeam ? player.team : null,
    team_hidden: !showTeam,
    draft_position: draftPosition,
    avg_points: null,
    total_points: null,
    expected_avg_points: null,
    fantasy_points: null,
    tier_value: tierValue,
    position_rank: tier?.position_rank || player.position_rank || null,
    tier_range: formatTierRange(range),
    tier_range_min: range ? Number(range.expected_avg_points_min || 0) : null,
    tier_range_max: range ? Number(range.expected_avg_points_max || 0) : null,
    durability: durability ? Number(durability.durability) : null,
    durability_hidden: durabilityEnabled(league) && !showDurability,
    durability_label: durability ? durabilityLabel(durability.durability) : durabilityEnabled(league) ? "Hidden" : "Off",
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
  const visibility = leagueVisibility(league);
  const [playersById, tierRows, tierRangeRows, durabilityRows, managerPointAccounts] = await Promise.all([
    loadPlayersById(playerIds),
    entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
    entities.LeaguePlayerTierRange.filter({ league_id: leagueId }),
    durabilityEnabled(visibility) ? entities.LeaguePlayerDurability.filter({ league_id: leagueId }) : [],
    entities.ManagerPointAccount.filter({ league_id: leagueId }),
  ]);
  const tiersByPlayer = new Map(tierRows.map((tier) => [tier.player_id, tier]));
  const tierRangesByBucket = new Map(tierRangeRows.map((range) => [tierRangeKey(range.position, range.tier_value), range]));
  const durabilityByPlayer = new Map(durabilityRows.map((row) => [row.player_id, row]));
  const pickedIds = new Set(picks.map((pick) => pick.player_id));
  const rosterIds = new Set(rosterRows.map((slot) => slot.player_id));
  const decoratePlayer = (player, options = {}) => decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer, tierRangesByBucket, visibility, options);
  const boardWithPlayers = await Promise.all(board.map(async (item) => ({
    ...item,
    player: decoratePlayer(playersById.get(item.player_id), { isDrafted: pickedIds.has(item.player_id) || rosterIds.has(item.player_id) }),
    weeks_played: await countPlayerWeeks(item.player_id, seasonYear),
  })));
  const teamTierTotals = Object.fromEntries(activeMembers.map((member) => [
    member.id,
    rosterRows
      .filter((slot) => slot.league_member_id === member.id)
      .reduce((sum, slot) => sum + Number(tiersByPlayer.get(slot.player_id)?.tier_value || 1), 0),
  ]));

  return {
    league: visibility,
    commissionerProfile,
    members: activeMembers,
    draft,
    room,
    turns,
    currentTurn,
    picks: picks.map((pick) => ({ ...pick, player: decoratePlayer(playersById.get(pick.player_id), { isDrafted: true }), member: activeMembers.find((member) => member.id === pick.league_member_id) })),
    rosters: rosterRows.map((slot) => ({ ...slot, player: decoratePlayer(playersById.get(slot.player_id), { isDrafted: true }), member: activeMembers.find((member) => member.id === slot.league_member_id) })),
    board: boardWithPlayers,
    teamTierTotals,
    managerPointAccounts,
  };
}

async function listDraftEligiblePlayers({ leagueId, draftId, searchTerm = "", position = "ALL", limit = 10, offset = 0 } = {}) {
  const rawLeague = await entities.League.get(leagueId);
  if (!rawLeague) return { data: [], hasMore: false, totalCount: 0 };
  const league = leagueVisibility(rawLeague);
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
  let [tiers, tierRangeRows, durabilityRows] = await Promise.all([
    entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
    entities.LeaguePlayerTierRange.filter({ league_id: leagueId }),
    durabilityEnabled(league) ? entities.LeaguePlayerDurability.filter({ league_id: leagueId }) : [],
  ]);
  if (shouldPrepareDraftPool(tiers, position)) {
    const preparation = await functions.prepareDraftPool({ league_id: leagueId });
    if (!preparation?.complete) {
      return {
        data: [],
        hasMore: false,
        totalCount: 0,
        preparing: true,
        preparation,
      };
    }
    [tiers, tierRangeRows, durabilityRows] = await Promise.all([
      entities.LeaguePlayerDraftTier.filter({ league_id: leagueId }),
      entities.LeaguePlayerTierRange.filter({ league_id: leagueId }),
      durabilityEnabled(league) ? entities.LeaguePlayerDurability.filter({ league_id: leagueId }) : [],
    ]);
  }
  const tiersByPlayer = new Map(tiers.map((tier) => [tier.player_id, tier]));
  const tierRangesByBucket = new Map(tierRangeRows.map((range) => [tierRangeKey(range.position, range.tier_value), range]));
  const durabilityByPlayer = new Map(durabilityRows.map((row) => [row.player_id, row]));
  const pageSize = Math.max(1, Number(limit || 10));
  const start = Math.max(0, Number(offset || 0));
  const target = start + pageSize;
  const candidateTiers = tiers
    .filter((tier) => Number(tier.position_rank || 0) <= 30)
    .filter((tier) => position === "ALL" || draftBucket(tier.position) === draftBucket(position))
    .sort(compareDraftTiers);
  const playersById = await loadPlayersById(candidateTiers.map((tier) => tier.player_id));
  const rows = [];

  for (const tier of candidateTiers) {
    if (unavailableIds.has(tier.player_id)) continue;
    const player = playersById.get(tier.player_id);
    if (!player) continue;
    if (searchTerm) {
      const displayedName = canShowName(league, false)
        ? `${player.player_display_name || ""} ${player.full_name || ""}`
        : `${tier.position || player.position || ""} Tier ${tier.tier_value || ""}`;
      const haystack = displayedName.toLowerCase();
      if (!haystack.includes(String(searchTerm).toLowerCase())) continue;
    }
    rows.push({
      ...decoratePlayerWithLeagueMetadata(player, tiersByPlayer, durabilityByPlayer, tierRangesByBucket, league, { isDrafted: false }),
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
