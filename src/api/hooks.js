import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";

export function useAuth() {
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: () => appClient.auth.me(),
  });
}

export function useLeague(id) {
  return useQuery({
    queryKey: ["league", id],
    queryFn: async () => {
      const leagues = await appClient.entities.League.filter({ id });
      return leagues[0] || null;
    },
    enabled: Boolean(id),
  });
}

export function useLeagueWeek(leagueId, weekNumber) {
  return useQuery({
    queryKey: ["league-week", leagueId, weekNumber],
    queryFn: async () => {
      const [week, randomization] = await Promise.all([
        appClient.entities.Week.filter({ league_id: leagueId, week_number: weekNumber }),
        appClient.entities.WeekRandomization.filter({ league_id: leagueId, fantasy_week: weekNumber }),
      ]);
      return {
        week: week[0] || null,
        randomization: randomization[0] || null,
      };
    },
    enabled: Boolean(leagueId && weekNumber),
  });
}

export function useDraftRoom(draftId) {
  return useQuery({
    queryKey: ["draft-room", draftId],
    queryFn: async () => {
      const drafts = await appClient.entities.Draft.filter({ id: draftId });
      const draft = drafts[0] || null;
      if (!draft) return null;
      const picks = await appClient.entities.DraftPick.filter({ draft_id: draftId }, "overall_pick");
      return { ...draft, picks };
    },
    enabled: Boolean(draftId),
  });
}

export function useAvailablePlayers(leagueId, weekNumber, managerId) {
  return useQuery({
    queryKey: ["available-players", leagueId, weekNumber, managerId],
    queryFn: async () => {
      const [players, usage, leagues, rosters] = await Promise.all([
        appClient.entities.Player.list("-avg_points"),
        appClient.entities.ManagerPlayerUsage.filter({ league_id: leagueId, league_member_id: managerId }),
        appClient.entities.League.filter({ id: leagueId }),
        appClient.entities.Roster.list(),
      ]);
      const league = leagues[0] || {};
      if (league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft") {
        const usedIds = new Set(usage.map((item) => item.player_id));
        return players.filter((player) => !usedIds.has(player.id));
      }
      const leagueMemberIds = new Set((await appClient.entities.LeagueMember.filter({ league_id: leagueId })).map((member) => member.id));
      const rosteredIds = new Set(rosters.filter((slot) => leagueMemberIds.has(slot.league_member_id)).map((slot) => slot.player_id));
      return players.filter((player) => !rosteredIds.has(player.id));
    },
    enabled: Boolean(leagueId && managerId),
  });
}

export function useReleasedPlayers(leagueId) {
  return useQuery({
    queryKey: ["released-players", leagueId],
    queryFn: async () => {
      const [events, players, members] = await Promise.all([
        appClient.entities.PlayerReleaseEvent.filter({ league_id: leagueId }, "-available_at"),
        appClient.entities.Player.list(),
        appClient.entities.LeagueMember.filter({ league_id: leagueId }),
      ]);
      return events.map((event) => ({
        ...event,
        player: players.find((player) => player.id === event.player_id),
        member: members.find((member) => member.id === event.league_member_id),
      }));
    },
    enabled: Boolean(leagueId),
  });
}

export function useLineup(leagueId, weekNumber, managerId) {
  return useQuery({
    queryKey: ["lineup", leagueId, weekNumber, managerId],
    queryFn: async () => {
      const lineups = await appClient.entities.Lineup.filter({
        league_id: leagueId,
        league_member_id: managerId,
        week_number: weekNumber,
      });
      return lineups[0] || null;
    },
    enabled: Boolean(leagueId && weekNumber && managerId),
  });
}
