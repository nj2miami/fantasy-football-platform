import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Clock3, Edit, Eye, EyeOff, Shuffle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { useAvailablePlayers, useLeagueWeek, useLineup, useReleasedPlayers } from "@/api/hooks";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

function MatchupHeader({ week, revealState, league, sourceSeasonYear }) {
  return (
    <div className="neo-card bg-black text-white p-6 mb-8 w-full">
      <h2 className="text-slate-700 text-4xl font-black text-center uppercase">Week {week} Matchup</h2>
      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs font-black uppercase">
        <span className="neo-border px-3 py-2 bg-[#00D9FF] text-black">{league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft" ? "Weekly Redraft" : "Season Snake"}</span>
        <span className="neo-border px-3 py-2 bg-[#9EF01A] text-black">{league.ranking_system === "offl" ? "OFFL" : "Standard"}</span>
        <span className="neo-border px-3 py-2 bg-[#F7B801] text-black">Source Season {sourceSeasonYear}</span>
        <span className="neo-border px-3 py-2 bg-white text-black">{revealState === "revealed" ? "Hidden Week Revealed" : "Hidden Week Protected"}</span>
      </div>
      <div className="flex justify-around items-center mt-4">
        <div className="text-center">
          <p className="text-slate-900 text-lg font-bold">Your Team</p>
          <p className="text-red-800 text-4xl font-black">124.50</p>
        </div>
        <p className="text-slate-950 text-4xl font-black">VS</p>
        <div className="text-center">
          <p className="text-slate-900 text-lg font-bold">Opponent's Team</p>
          <p className="text-red-800 text-4xl font-black">110.20</p>
        </div>
      </div>
    </div>
  );
}

function TeamRoster({ leagueId, leagueMemberId, week }) {
  const { data: roster = [] } = useQuery({
    queryKey: ["team-roster", leagueMemberId],
    queryFn: () => appClient.entities.Roster.filter({ league_member_id: leagueMemberId }),
    enabled: !!leagueMemberId,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["roster-players", leagueMemberId, week],
    queryFn: async () => {
      const [allPlayers, usage] = await Promise.all([
        appClient.entities.Player.list(),
        appClient.entities.ManagerPlayerUsage.filter({ league_id: leagueId, league_member_id: leagueMemberId }),
      ]);
      return roster.map((slot) => ({
        ...slot,
        player: allPlayers.find((player) => player.id === slot.player_id),
        usage: usage.find((item) => item.player_id === slot.player_id),
      }));
    },
    enabled: !!leagueId && !!leagueMemberId,
  });

  return (
    <div className="neo-card bg-white p-6">
      <h3 className="text-black text-2xl font-black uppercase mb-4">Roster Snapshot</h3>
      <div className="space-y-2">
        {players.map((slot) => (
          <div key={slot.id} className="neo-border bg-gray-50 p-3 flex items-center justify-between">
            <div>
              <p className="font-black">{slot.player?.player_display_name || slot.player_id}</p>
              <p className="text-xs font-bold text-gray-500">{slot.player?.team} - {slot.slot_type}</p>
              <p className="text-xs font-bold text-[#6A4C93]">Used {slot.usage?.usage_count || 0} time(s)</p>
            </div>
            <p className="font-black">{slot.player?.avg_points?.toFixed?.(1) ?? "--"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerAvailability({ league, currentWeek, leagueMemberId }) {
  const leagueId = league.id;
  const { data: players = [] } = useAvailablePlayers(leagueId, currentWeek, leagueMemberId);

  return (
    <div className="neo-card bg-white p-6">
      <h3 className="text-2xl font-black uppercase mb-4 flex items-center gap-2">
        <Shuffle className="w-6 h-6 text-[#6A4C93]" />
        Available Players
      </h3>
      <p className="text-sm font-bold text-gray-600 mb-4">
        {league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft"
          ? "These are the highest-value players this manager has not used this season."
          : "These are the highest-value free agents not currently rostered in this league."}
      </p>
      <div className="space-y-2">
        {players.slice(0, 6).map((player) => (
          <div key={player.id} className="neo-border bg-gray-50 p-3 flex items-center justify-between">
            <div>
              <p className="font-black">{player.player_display_name || player.full_name}</p>
              <p className="text-xs font-bold text-gray-500">{player.team} - {player.position}</p>
            </div>
            <div className="text-right">
              <p className="font-black">{player.avg_points?.toFixed?.(1) ?? player.avg_points}</p>
              <p className="text-xs font-bold text-gray-500">AVG PTS</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReleasedPlayersReport({ leagueId }) {
  const { data: releases = [] } = useReleasedPlayers(leagueId);
  return (
    <div className="neo-card bg-white p-6">
      <h3 className="text-2xl font-black uppercase mb-4">Newly Available</h3>
      <div className="space-y-2">
        {releases.slice(0, 6).map((event) => (
          <div key={event.id} className="neo-border bg-gray-50 p-3">
            <p className="font-black">{event.player?.player_display_name || event.player_id}</p>
            <p className="text-xs font-bold text-gray-600">
              Released by {event.member?.team_name || "Unknown"} after week {event.week_number}
            </p>
          </div>
        ))}
        {!releases.length && <p className="text-sm font-bold text-gray-500">No released players yet.</p>}
      </div>
    </div>
  );
}

function LineupPanel({ league, currentWeek, leagueMemberId }) {
  const { data: lineup } = useLineup(league.id, currentWeek, leagueMemberId);
  const finalizeLineupMutation = useMutation({
    mutationFn: () =>
      appClient.functions.invoke("finalize_lineup", {
        league_id: league.id,
        league_member_id: leagueMemberId,
        week_number: currentWeek,
        slots:
          lineup?.slots || [
            { slot: "QB", player_id: "player_allen" },
            { slot: "OFF1", player_id: "player_hill" },
            { slot: "OFF2", player_id: "player_henry" },
            { slot: "K", player_id: "player_tucker" },
            { slot: "DEF", player_id: "player_cowboys" },
          ],
      }),
    onSuccess: () => toast.success("Lineup finalized."),
    onError: () => toast.error("Failed to finalize lineup."),
  });

  return (
    <div className="neo-card bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-black uppercase">Weekly Lineup</h3>
        <Button
          onClick={() => finalizeLineupMutation.mutate()}
          className="neo-btn bg-[#FF6B35] text-white"
          disabled={finalizeLineupMutation.isPending}
        >
          {finalizeLineupMutation.isPending ? "Saving..." : lineup?.finalized_at ? "Re-Finalize" : "Finalize"}
        </Button>
      </div>
      {!lineup ? (
        <p className="text-sm font-bold text-gray-500">No lineup saved yet for this week.</p>
      ) : (
        <div className="space-y-2">
          {lineup.slots.map((slot) => (
            <div key={`${slot.slot}-${slot.player_id}`} className="neo-border bg-gray-50 p-3 flex items-center justify-between">
              <span className="font-black uppercase">{slot.slot}</span>
              <span className="font-bold text-gray-700">{slot.player_id}</span>
            </div>
          ))}
          <p className="text-xs font-bold text-gray-500 pt-2">
            {lineup.finalized_at ? `Finalized ${new Date(lineup.finalized_at).toLocaleString()}` : "Drafted roster saved but not finalized."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function League() {
  const location = useLocation();
  const leagueId = new URLSearchParams(location.search).get("id");
  const [user, setUser] = useState(null);
  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await appClient.auth.me());
      } catch (error) {
        console.error("Failed to load user", error);
      }
    };
    loadUser();
  }, []);

  const { data: league, isLoading: isLoadingLeague } = useQuery({
    queryKey: ["league-details", leagueId],
    queryFn: async () => {
      const leagues = await appClient.entities.League.filter({ id: leagueId });
      return leagues[0] || null;
    },
    enabled: !!leagueId,
  });

  const { data: standings = [], isLoading: isLoadingStandings } = useQuery({
    queryKey: ["league-standings", leagueId, league?.ranking_system],
    queryFn: () => appClient.entities.Standing.filter(
      { league_id: leagueId },
      league?.ranking_system === "offl" ? "-league_points" : "-wins",
      "-points_for"
    ),
    enabled: !!leagueId && !!league,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["league-members", leagueId],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: leagueId }),
    enabled: !!leagueId,
  });

  const { data: season = null } = useQuery({
    queryKey: ["league-season", leagueId],
    queryFn: async () => {
      const seasons = await appClient.entities.Season.filter({ league_id: leagueId });
      return seasons[0] || null;
    },
    enabled: !!leagueId,
  });

  const displayedWeek = season?.current_week || 1;
  const { data: leagueWeekData } = useLeagueWeek(leagueId, displayedWeek);

  const revealWeekMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("reveal_week_results", { league_id: leagueId, week_number: displayedWeek }),
    onSuccess: () => toast.success("Week reveal requested."),
    onError: () => toast.error("Failed to reveal week."),
  });

  if (isLoadingLeague) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading League...</p>
      </div>
    );
  }

  if (!league) {
    return <div className="text-center font-bold text-2xl text-red-500">Error: League not found.</div>;
  }

  const isCommissioner = user?.email === league.commissioner_email;
  const currentUserLeagueMemberId = members.find((member) => member.user_email === user?.email)?.id;
  const currentRevealState = leagueWeekData?.randomization?.reveal_state || season?.reveal_state || "hidden";
  const currentSourceYear = season?.source_season_year || league.source_season_year;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <Link to={createPageUrl("Leagues")}>
          <Button className="neo-btn bg-black text-white">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Leagues
          </Button>
        </Link>
        {isCommissioner && (
          <Link to={createPageUrl(`LeagueManage?id=${league.id}`)}>
            <Button className="neo-btn bg-[#6A4C93] text-white">
              <Edit className="w-5 h-5 mr-2" />
              Commissioner View
            </Button>
          </Link>
        )}
      </div>

      <div className="neo-card bg-black text-white p-8 mb-8 rotate-[-0.5deg]">
        <div className="rotate-[0.5deg] flex items-center gap-4">
          <Trophy className="w-12 h-12 text-[#F7B801]" />
          <div>
            <h1 className="text-orange-600 mb-2 text-4xl font-black uppercase">{league.name}</h1>
            <p className="text-slate-950 text-lg font-bold">{league.description || "Welcome to the league!"}</p>
          </div>
        </div>
      </div>

      <MatchupHeader
        week={displayedWeek}
        revealState={currentRevealState}
        league={league}
        sourceSeasonYear={currentSourceYear}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="neo-card bg-white p-4">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Current Week</p>
          <p className="text-3xl font-black">{displayedWeek}</p>
        </div>
        <div className="neo-card bg-white p-4">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Week Status</p>
          <p className="text-lg font-black">{leagueWeekData?.week?.status || "Pending"}</p>
        </div>
        <div className="neo-card bg-white p-4">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Reveal State</p>
          <p className="text-lg font-black flex items-center gap-2">
            {currentRevealState === "revealed" ? <Eye className="w-5 h-5 text-[#9EF01A]" /> : <EyeOff className="w-5 h-5 text-[#FF6B35]" />}
            {currentRevealState}
          </p>
        </div>
        <div className="neo-card bg-white p-4">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Randomization Model</p>
          <p className="text-sm font-black">Per-player hidden weeks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="neo-card bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-orange-600 text-2xl font-black uppercase flex items-center gap-2">
                <Shuffle className="w-6 h-6" />
                Hidden Week Engine
              </h3>
              {isCommissioner && (
                <Button
                  onClick={() => revealWeekMutation.mutate()}
                  className="neo-btn bg-black text-white"
                  disabled={revealWeekMutation.isPending}
                >
                  {revealWeekMutation.isPending ? "Revealing..." : "Reveal Current Week"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neo-border p-4 bg-[#EFFBFF]">
                <p className="text-xs font-black uppercase text-gray-500 mb-1">Source Season</p>
                <p className="text-xl font-black">{currentSourceYear}</p>
              </div>
              <div className="neo-border p-4 bg-white">
                <p className="text-xs font-black uppercase text-gray-500 mb-1">Assignment Method</p>
                <p className="text-xl font-black">{leagueWeekData?.randomization?.assignment_method || "per_player_hidden_week"}</p>
              </div>
              <div className="neo-border p-4 bg-white">
                <p className="text-xs font-black uppercase text-gray-500 mb-1">Visibility</p>
                <p className="text-xl font-black flex items-center gap-2">
                  <Clock3 className="w-5 h-5 text-[#6A4C93]" />
                  {currentRevealState}
                </p>
              </div>
            </div>
          </div>

          <div className="neo-card bg-white p-6">
            <h3 className="text-orange-600 mb-4 text-2xl font-black uppercase">Standings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b-4 border-black">
                  <tr>
                    <th className="p-3 font-black uppercase">Rank</th>
                    <th className="p-3 font-black uppercase">Team</th>
                    <th className="p-3 font-black uppercase">Record</th>
                    {league.ranking_system === "offl" && <th className="p-3 font-black uppercase">League Pts</th>}
                    <th className="p-3 font-black uppercase">PF</th>
                    <th className="p-3 font-black uppercase">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStandings ? (
                    <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr>
                  ) : (
                    standings.map((standing, index) => {
                      const member = members.find((item) => item.id === standing.league_member_id);
                      return (
                        <tr key={standing.id} className="border-b-2 border-gray-200">
                          <td className="p-3 font-bold flex items-center gap-2">
                            {index + 1}
                            {member?.is_ai && <Bot className="w-4 h-4 text-gray-500" />}
                          </td>
                          <td className="p-3 font-bold">{member?.team_name || "Unknown Team"}</td>
                          <td className="p-3 font-bold">{`${standing.wins}-${standing.losses}-${standing.ties}`}</td>
                          {league.ranking_system === "offl" && <td className="p-3 font-bold">{Number(standing.league_points || 0).toFixed(1)}</td>}
                          <td className="p-3 font-bold">{Number(standing.points_for || 0).toFixed(2)}</td>
                          <td className="p-3 font-bold">{Number(standing.points_against || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {user && currentUserLeagueMemberId && (
            <LineupPanel league={league} currentWeek={displayedWeek} leagueMemberId={currentUserLeagueMemberId} />
          )}
          {user && currentUserLeagueMemberId && (
            <PlayerAvailability league={league} currentWeek={displayedWeek} leagueMemberId={currentUserLeagueMemberId} />
          )}
          <ReleasedPlayersReport leagueId={league.id} />
          {user && currentUserLeagueMemberId && (
            <TeamRoster leagueId={league.id} leagueMemberId={currentUserLeagueMemberId} week={displayedWeek} />
          )}
        </div>
      </div>
    </div>
  );
}
