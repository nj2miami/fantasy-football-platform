import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Edit,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PenSquare,
  Save,
  ShieldCheck,
  Shuffle,
  Square,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { useAvailablePlayers, useLeagueWeek, useLineup, useReleasedPlayers } from "@/api/hooks";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

function formatNumber(value, digits = 1) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "--";
}

function formatDate(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeSlots(slots) {
  return Array.isArray(slots) ? slots : [];
}

function memberName(member) {
  return member?.team_name || (member?.is_ai ? "AI Manager" : "Manager");
}

function EmptyState({ icon: Icon = Inbox, title, detail }) {
  return (
    <div className="neo-border bg-gray-50 p-5 text-center">
      <Icon className="mx-auto mb-3 h-7 w-7 text-gray-400" />
      <p className="font-black uppercase text-gray-700">{title}</p>
      {detail && <p className="mt-1 text-sm font-bold text-gray-500">{detail}</p>}
    </div>
  );
}

function StatTile({ label, value, tone = "bg-white" }) {
  return (
    <div className={`neo-border ${tone} p-4`}>
      <p className="mb-1 text-xs font-black uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-black text-black">{value}</p>
    </div>
  );
}

function LeagueShell({ children }) {
  return <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>;
}

function LoadingLeague() {
  return (
    <LeagueShell>
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading League...</p>
      </div>
    </LeagueShell>
  );
}

function LeagueNav({ league, currentMember, isCommissioner, isManagerPortal }) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Link to={createPageUrl("Leagues")}>
        <Button className="neo-btn bg-black text-white">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Leagues
        </Button>
      </Link>
      <div className="flex flex-wrap gap-3">
        <Link to={createPageUrl(`League?id=${league.id}`)}>
          <Button className={`neo-btn ${isManagerPortal ? "bg-white text-black" : "bg-[#F7B801] text-black"}`}>
            <Trophy className="mr-2 h-5 w-5" />
            League Hub
          </Button>
        </Link>
        {currentMember && (
          <Link to={`/league/manager?id=${league.id}&managerId=${currentMember.id}`}>
            <Button className={`neo-btn ${isManagerPortal ? "bg-[#00D9FF] text-black" : "bg-white text-black"}`}>
              <LayoutDashboard className="mr-2 h-5 w-5" />
              Manager Portal
            </Button>
          </Link>
        )}
        <Link to={`/league/draft?id=${league.id}`}>
          <Button className="neo-btn bg-white text-black">
            <PenSquare className="mr-2 h-5 w-5" />
            Draft Day
          </Button>
        </Link>
        {isCommissioner && (
          <Link to={createPageUrl(`LeagueManage?id=${league.id}`)}>
            <Button className="neo-btn bg-[#6A4C93] text-white">
              <Edit className="mr-2 h-5 w-5" />
              Commissioner
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function LeagueHero({ league, season, currentMember, memberCount }) {
  return (
    <div className="neo-card mb-8 bg-black p-6 text-white sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="neo-border bg-[#F7B801] px-3 py-1 text-xs font-black uppercase text-black">
              Private League
            </span>
            <span className="neo-border bg-white px-3 py-1 text-xs font-black uppercase text-black">
              {league.league_status || "Recruiting"}
            </span>
          </div>
          <h1 className="text-4xl font-black uppercase text-orange-500 sm:text-5xl">{league.name}</h1>
          <p className="mt-3 text-lg font-bold text-white">{league.description || "League home for schedules, standings, rules, news, and weekly movement."}</p>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[360px]">
          <StatTile label="Teams" value={`${memberCount}/${league.max_members || memberCount}`} tone="bg-white" />
          <StatTile label="Week" value={season?.current_week || 1} tone="bg-[#D7F8E8]" />
          {currentMember && <StatTile label="Your Team" value={memberName(currentMember)} tone="bg-[#EFFBFF]" />}
        </div>
      </div>
    </div>
  );
}

function SchedulePanel({ schedule, matchups, members, currentWeek }) {
  const upcoming = schedule.slice(0, 6);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  return (
    <section className="neo-card bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
          <CalendarDays className="h-6 w-6" />
          Schedule
        </h2>
        <span className="neo-border bg-gray-50 px-3 py-2 text-xs font-black uppercase">Week {currentWeek}</span>
      </div>
      <div className="space-y-3">
        {upcoming.map((item) => {
          const weekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === Number(item.week_number));
          return (
            <div key={item.id} className="neo-border bg-gray-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black uppercase">Week {item.week_number}</p>
                  <p className="text-sm font-bold text-gray-600">{formatDate(item.scheduled_at)} | {item.phase || "regular"}</p>
                </div>
                <span className="neo-border bg-white px-3 py-1 text-xs font-black uppercase">{item.status || "Scheduled"}</span>
              </div>
              {weekMatchups.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {weekMatchups.map((matchup) => (
                    <div key={matchup.id} className="bg-white p-3 font-bold">
                      {memberName(memberById.get(matchup.home_member_id))} vs {memberName(memberById.get(matchup.away_member_id))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!upcoming.length && <EmptyState title="No schedule yet" detail="The commissioner can generate the league calendar from the commissioner view." />}
      </div>
    </section>
  );
}

function StandingsPanel({ league, standings, members, isLoading }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Trophy className="h-6 w-6" />
        Overall Standings
      </h2>
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
            {isLoading && (
              <tr>
                <td colSpan={league.ranking_system === "offl" ? 6 : 5} className="p-4 text-center font-bold">Loading standings...</td>
              </tr>
            )}
            {!isLoading && standings.map((standing, index) => {
              const member = memberById.get(standing.league_member_id);
              return (
                <tr key={standing.id || standing.league_member_id} className="border-b-2 border-gray-200">
                  <td className="p-3 font-black">{index + 1}</td>
                  <td className="p-3 font-bold">
                    <span className="inline-flex items-center gap-2">
                      {memberName(member)}
                      {member?.is_ai && <Bot className="h-4 w-4 text-gray-500" />}
                    </span>
                  </td>
                  <td className="p-3 font-bold">{`${standing.wins || 0}-${standing.losses || 0}-${standing.ties || 0}`}</td>
                  {league.ranking_system === "offl" && <td className="p-3 font-bold">{formatNumber(standing.league_points, 1)}</td>}
                  <td className="p-3 font-bold">{formatNumber(standing.points_for, 2)}</td>
                  <td className="p-3 font-bold">{formatNumber(standing.points_against, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && standings.length === 0 && <EmptyState title="No standings yet" detail="Standings will populate once matchups are resolved." />}
    </section>
  );
}

function NewsPanel({ auditEvents, season, leagueWeekData }) {
  const currentRevealState = leagueWeekData?.randomization?.reveal_state || season?.reveal_state || "hidden";
  const items = [
    {
      id: "week-status",
      title: `Week ${season?.current_week || 1} is ${leagueWeekData?.week?.status || "pending"}`,
      detail: currentRevealState === "revealed" ? "Hidden-week scoring is visible." : "Hidden-week scoring is protected until reveal.",
    },
    ...auditEvents.slice(0, 4).map((event) => ({
      id: event.id,
      title: (event.changed_keys || ["League settings"]).join(", "),
      detail: `${event.actor_email || "Commissioner"} updated league rules ${formatDate(event.created_date)}.`,
    })),
  ];

  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Newspaper className="h-6 w-6" />
        League News
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="neo-border bg-gray-50 p-4">
            <p className="font-black uppercase">{item.title}</p>
            <p className="mt-1 text-sm font-bold text-gray-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommissionerNotesPanel({ league, isCommissioner }) {
  const note = league.commissioner_notes || league.notes || league.manager_message || "";
  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <MessageSquare className="h-6 w-6" />
        Commissioner Notes
      </h2>
      {note ? (
        <div className="neo-border bg-[#FFF7D6] p-4 font-bold leading-relaxed text-black">{note}</div>
      ) : (
        <EmptyState title="No notes posted" detail={isCommissioner ? "Add notes from commissioner tools when that field is enabled." : "The commissioner has not posted notes yet."} />
      )}
    </section>
  );
}

function RulesPanel({ league, auditEvents, auditFeedback, onVote, isVoting }) {
  const feedbackCounts = (eventId) => {
    const rows = auditFeedback.filter((item) => item.audit_event_id === eventId);
    return {
      up: rows.filter((item) => item.vote === "up").length,
      down: rows.filter((item) => item.vote === "down").length,
    };
  };

  const rules = [
    ["Draft", league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft" ? "Weekly redraft" : "Season snake"],
    ["Schedule", league.schedule_type === "league_wide" ? "League-wide scoring" : "Head to head"],
    ["Ranking", league.ranking_system === "offl" ? "H2H + league points" : "Standard record"],
    ["Retention", league.player_retention_mode === "two_use_release" ? "Two-use release" : "Retained rosters"],
    ["Names", league.draft_player_name_visibility === "hidden_until_drafted" ? "Hidden until drafted" : "Shown"],
    ["Durability", league.durability_mode === "off" ? "Off" : league.durability_mode === "revealed_at_draft" ? "Revealed at draft" : "Hidden until drafted"],
  ];

  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <ClipboardList className="h-6 w-6" />
        League Rules
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rules.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
      </div>
      {auditEvents.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-black uppercase text-gray-500">Rule Change Log</p>
          {auditEvents.slice(0, 5).map((event) => {
            const counts = feedbackCounts(event.id);
            return (
              <div key={event.id} className="neo-border bg-gray-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black uppercase">{(event.changed_keys || ["League settings"]).join(", ")}</p>
                    <p className="text-xs font-bold text-gray-600">{event.actor_email || "League admin"} | {new Date(event.created_date).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => onVote(event.id, "up")} disabled={isVoting} className="neo-btn bg-[#D7F8E8] px-3 py-2 text-black">Good {counts.up}</Button>
                    <Button onClick={() => onVote(event.id, "down")} disabled={isVoting} className="neo-btn bg-red-100 px-3 py-2 text-black">Concern {counts.down}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TopFreeAgentsPanel({ league, currentWeek, currentMember }) {
  const { data: players = [] } = useAvailablePlayers(league.id, currentWeek, currentMember?.id);
  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Shuffle className="h-6 w-6" />
        Top Free Agents
      </h2>
      <div className="space-y-2">
        {players.slice(0, 8).map((player) => (
          <div key={player.id} className="neo-border flex items-center justify-between gap-3 bg-gray-50 p-3">
            <div>
              <p className="font-black">{player.player_display_name || player.full_name}</p>
              <p className="text-xs font-bold text-gray-500">{player.team || "FA"} | {player.position || "POS"}</p>
            </div>
            <div className="text-right">
              <p className="font-black">{formatNumber(player.avg_points, 1)}</p>
              <p className="text-xs font-bold text-gray-500">AVG</p>
            </div>
          </div>
        ))}
        {!players.length && <EmptyState title="No free agents visible" detail="A draft or roster lock may still be in progress." />}
      </div>
    </section>
  );
}

function ReleasedPlayersPanel({ leagueId }) {
  const { data: releases = [] } = useReleasedPlayers(leagueId);
  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Users className="h-6 w-6" />
        Newly Released
      </h2>
      <div className="space-y-2">
        {releases.slice(0, 8).map((event) => (
          <div key={event.id} className="neo-border bg-gray-50 p-3">
            <p className="font-black">{event.player?.player_display_name || event.player?.full_name || event.player_id}</p>
            <p className="text-xs font-bold text-gray-600">
              Released by {memberName(event.member)} after week {event.week_number}
            </p>
          </div>
        ))}
        {!releases.length && <EmptyState title="No released players" detail="Released players will appear here after weekly roster movement." />}
      </div>
    </section>
  );
}

function NewsletterPanel({ league, season, standings }) {
  const leader = standings[0];
  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Newspaper className="h-6 w-6" />
        AI Newsletter
      </h2>
      <div className="neo-border bg-[#EFFBFF] p-4">
        <p className="font-black uppercase">Week {season?.current_week || 1} brief</p>
        <p className="mt-2 text-sm font-bold text-gray-700">
          {leader
            ? `${league.name} has a standings leader and the weekly recap slot is ready for generated headlines.`
            : "The newsletter slot is ready for league recaps once standings and results start landing."}
        </p>
      </div>
    </section>
  );
}

function LeagueInfoPage(props) {
  const {
    league,
    season,
    currentMember,
    isCommissioner,
    members,
    standings,
    isLoadingStandings,
    schedule,
    matchups,
    auditEvents,
    auditFeedback,
    voteMutation,
    leagueWeekData,
  } = props;
  const currentWeek = season?.current_week || 1;

  return (
    <>
      <LeagueHero league={league} season={season} currentMember={currentMember} memberCount={members.length} />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <SchedulePanel schedule={schedule} matchups={matchups} members={members} currentWeek={currentWeek} />
          <StandingsPanel league={league} standings={standings} members={members} isLoading={isLoadingStandings} />
          <NewsPanel auditEvents={auditEvents} season={season} leagueWeekData={leagueWeekData} />
          <RulesPanel
            league={league}
            auditEvents={auditEvents}
            auditFeedback={auditFeedback}
            isVoting={voteMutation.isPending}
            onVote={(auditEventId, vote) => voteMutation.mutate({ auditEventId, vote })}
          />
        </div>
        <div className="space-y-8">
          <CommissionerNotesPanel league={league} isCommissioner={isCommissioner} />
          <TopFreeAgentsPanel league={league} currentWeek={currentWeek} currentMember={currentMember} />
          <ReleasedPlayersPanel leagueId={league.id} />
          <NewsletterPanel league={league} season={season} standings={standings} />
        </div>
      </div>
    </>
  );
}

function ManagerMatchupPanel({ league, currentWeek, matchups, weekResults, members, manager }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const matchup = matchups.find((item) =>
    Number(item.week_number) === Number(currentWeek) &&
    (item.home_member_id === manager.id || item.away_member_id === manager.id)
  );
  const myResult = weekResults.find((result) => result.league_member_id === manager.id && Number(result.week_number) === Number(currentWeek));
  const opponentId = matchup?.home_member_id === manager.id ? matchup.away_member_id : matchup?.home_member_id;
  const opponent = memberById.get(opponentId);
  const opponentResult = weekResults.find((result) => result.league_member_id === opponentId && Number(result.week_number) === Number(currentWeek));
  const myMatchupScore = matchup?.home_member_id === manager.id ? matchup?.home_score : matchup?.away_score;
  const opponentMatchupScore = matchup?.home_member_id === manager.id ? matchup?.away_score : matchup?.home_score;

  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <ShieldCheck className="h-6 w-6" />
        Week {currentWeek} Matchup
      </h2>
      {matchup ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label={memberName(manager)} value={formatNumber(myResult?.total_points ?? myMatchupScore, 2)} tone="bg-[#EFFBFF]" />
          <div className="neo-border flex items-center justify-center bg-black p-4 text-3xl font-black text-white">VS</div>
          <StatTile label={memberName(opponent)} value={formatNumber(opponentResult?.total_points ?? opponentMatchupScore, 2)} tone="bg-[#FFF7D6]" />
        </div>
      ) : (
        <EmptyState title="No matchup yet" detail={`${league.name} has not generated a matchup for your current week.`} />
      )}
    </section>
  );
}

function ManagerLineupPanel({ league, currentWeek, manager }) {
  const queryClient = useQueryClient();
  const { data: lineup } = useLineup(league.id, currentWeek, manager.id);
  const { data: roster = [] } = useQuery({
    queryKey: ["manager-roster", manager.id],
    queryFn: () => appClient.entities.Roster.filter({ league_member_id: manager.id }),
    enabled: Boolean(manager.id),
  });
  const { data: players = [] } = useQuery({
    queryKey: ["manager-roster-players", manager.id],
    queryFn: () => appClient.entities.Player.list(),
    enabled: Boolean(roster.length),
  });
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const initialSelection = useMemo(() => {
    const lineupIds = normalizeSlots(lineup?.slots).map((slot) => slot.player_id).filter(Boolean);
    return lineupIds.length ? lineupIds : roster.map((slot) => slot.player_id).filter(Boolean);
  }, [lineup?.slots, roster]);
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelection));

  useEffect(() => {
    setSelectedIds(new Set(initialSelection));
  }, [initialSelection]);

  const finalizeLineupMutation = useMutation({
    mutationFn: () => {
      const slots = roster
        .filter((slot) => selectedIds.has(slot.player_id))
        .map((slot) => ({
          slot: slot.slot_type || playerById.get(slot.player_id)?.position || "FLEX",
          player_id: slot.player_id,
          status: "active",
        }));
      return appClient.functions.invoke("finalize_lineup", {
        league_id: league.id,
        league_member_id: manager.id,
        week_number: currentWeek,
        slots,
      });
    },
    onSuccess: () => {
      toast.success("Lineup finalized.");
      queryClient.invalidateQueries({ queryKey: ["lineup", league.id, currentWeek, manager.id] });
    },
    onError: (error) => toast.error(error.message || "Failed to finalize lineup."),
  });

  const togglePlayer = (playerId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  return (
    <section className="neo-card bg-white p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
          <ClipboardList className="h-6 w-6" />
          Set Lineup
        </h2>
        <Button
          onClick={() => finalizeLineupMutation.mutate()}
          disabled={finalizeLineupMutation.isPending || !roster.length || selectedIds.size === 0}
          className="neo-btn bg-[#FF6B35] text-white"
        >
          <Save className="mr-2 h-5 w-5" />
          {finalizeLineupMutation.isPending ? "Saving..." : "Finalize"}
        </Button>
      </div>
      <div className="space-y-2">
        {roster.map((slot) => {
          const player = playerById.get(slot.player_id);
          const selected = selectedIds.has(slot.player_id);
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => togglePlayer(slot.player_id)}
              className={`neo-border flex w-full items-center justify-between gap-3 p-3 text-left ${selected ? "bg-[#D7F8E8]" : "bg-gray-50"}`}
            >
              <span className="flex items-center gap-3">
                {selected ? <CheckSquare className="h-5 w-5 text-green-700" /> : <Square className="h-5 w-5 text-gray-500" />}
                <span>
                  <span className="block font-black">{player?.player_display_name || player?.full_name || slot.player_id}</span>
                  <span className="block text-xs font-bold text-gray-500">{player?.team || "FA"} | {player?.position || slot.slot_type}</span>
                </span>
              </span>
              <span className="font-black uppercase">{slot.slot_type}</span>
            </button>
          );
        })}
        {!roster.length && <EmptyState title="No roster yet" detail="Draft or roster assignment must happen before you can set a lineup." />}
      </div>
      <p className="mt-4 text-xs font-bold uppercase text-gray-500">
        {lineup?.finalized_at ? `Last finalized ${new Date(lineup.finalized_at).toLocaleString()}` : "Not finalized for this week."}
      </p>
    </section>
  );
}

function ManagerResultsPanel({ weekResults, manager }) {
  const myResults = weekResults
    .filter((result) => result.league_member_id === manager.id)
    .sort((a, b) => Number(b.week_number || 0) - Number(a.week_number || 0));

  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <Trophy className="h-6 w-6" />
        Results
      </h2>
      <div className="space-y-2">
        {myResults.slice(0, 6).map((result) => (
          <div key={result.id} className="neo-border grid grid-cols-4 gap-3 bg-gray-50 p-3 text-sm font-bold">
            <span className="font-black uppercase">Week {result.week_number}</span>
            <span>{formatNumber(result.total_points, 2)} pts</span>
            <span>Rank {result.weekly_rank || "--"}</span>
            <span>{formatNumber(result.league_points, 1)} LP</span>
          </div>
        ))}
        {!myResults.length && <EmptyState title="No results yet" detail="Your weekly results will appear after scoring resolves." />}
      </div>
    </section>
  );
}

function ManagerMessagingPanel({ league, manager }) {
  return (
    <section className="neo-card bg-white p-6">
      <h2 className="mb-5 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
        <MessageSquare className="h-6 w-6" />
        Messages
      </h2>
      <div className="neo-border bg-[#FFF7D6] p-4">
        <p className="font-black uppercase">Private team channel</p>
        <p className="mt-2 text-sm font-bold text-gray-700">
          Messaging is reserved for {memberName(manager)} inside {league.name}. The panel is gated now, so the message thread can be wired here without exposing other teams.
        </p>
      </div>
    </section>
  );
}

function ManagerPortalPage({ league, season, manager, members, matchups, weekResults }) {
  const currentWeek = season?.current_week || 1;
  return (
    <>
      <div className="neo-card mb-8 bg-black p-6 text-white sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-black uppercase text-[#F7B801]">Manager Portal</p>
            <h1 className="text-4xl font-black uppercase text-orange-500">{memberName(manager)}</h1>
            <p className="mt-2 text-lg font-bold">{league.name}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Current Week" value={currentWeek} tone="bg-white" />
            <StatTile label="Role" value={manager.role_in_league || "Manager"} tone="bg-[#EFFBFF]" />
            <StatTile label="Status" value={manager.is_active === false ? "Inactive" : "Active"} tone="bg-[#D7F8E8]" />
          </div>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <ManagerMatchupPanel league={league} currentWeek={currentWeek} matchups={matchups} weekResults={weekResults} members={members} manager={manager} />
          <ManagerLineupPanel league={league} currentWeek={currentWeek} manager={manager} />
          <ManagerResultsPanel weekResults={weekResults} manager={manager} />
        </div>
        <div className="space-y-8">
          <ManagerMessagingPanel league={league} manager={manager} />
          <TopFreeAgentsPanel league={league} currentWeek={currentWeek} currentMember={manager} />
          <ReleasedPlayersPanel leagueId={league.id} />
        </div>
      </div>
    </>
  );
}

export default function League() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const leagueId = searchParams.get("id") || searchParams.get("leagueId");
  const requestedManagerId = searchParams.get("managerId") || searchParams.get("memberId") || searchParams.get("teamId");
  const isManagerPortal = location.pathname.toLowerCase().startsWith("/league/manager");

  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await appClient.auth.me());
      } catch (error) {
        console.error("Failed to load user", error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!leagueId && !isLoadingUser) navigate(createPageUrl("Leagues"), { replace: true });
  }, [leagueId, isLoadingUser, navigate]);

  const { data: league, isLoading: isLoadingLeague } = useQuery({
    queryKey: ["league-details", leagueId],
    queryFn: async () => {
      const leagues = await appClient.entities.League.filter({ id: leagueId });
      return leagues[0] || null;
    },
    enabled: Boolean(leagueId),
  });

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["league-members", leagueId],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: leagueId }),
    enabled: Boolean(leagueId && user),
  });

  const currentMember = useMemo(() => (
    members.find((member) => member.is_active !== false && !member.is_ai && (
      member.user_email === user?.email || member.profile_id === user?.id
    )) || null
  ), [members, user]);

  const targetManager = useMemo(() => {
    if (!isManagerPortal) return currentMember;
    if (!requestedManagerId) return currentMember;
    return members.find((member) => member.id === requestedManagerId) || null;
  }, [currentMember, isManagerPortal, members, requestedManagerId]);

  const isCommissioner = Boolean(
    user && league && (
      user.email === league.commissioner_email ||
      league.commissioner_id === user.id ||
      currentMember?.role_in_league === "COMMISSIONER"
    )
  );

  useEffect(() => {
    if (isLoadingUser || isLoadingLeague || isLoadingMembers || !leagueId) return;
    if (!league || !currentMember || currentMember.is_active === false) {
      navigate(createPageUrl("Leagues"), { replace: true });
      return;
    }
    if (isManagerPortal && (!targetManager || targetManager.id !== currentMember.id)) {
      navigate(createPageUrl("Leagues"), { replace: true });
    }
  }, [currentMember, isLoadingLeague, isLoadingMembers, isLoadingUser, isManagerPortal, league, leagueId, navigate, targetManager]);

  const { data: standings = [], isLoading: isLoadingStandings } = useQuery({
    queryKey: ["league-standings", leagueId, league?.ranking_system],
    queryFn: async () => {
      const rows = await appClient.entities.Standing.filter({ league_id: leagueId });
      return rows.sort((a, b) =>
        Number(b.wins || 0) - Number(a.wins || 0) ||
        Number(b.ties || 0) - Number(a.ties || 0) ||
        (league?.ranking_system === "offl" ? Number(b.league_points || 0) - Number(a.league_points || 0) : 0) ||
        Number(b.points_for || 0) - Number(a.points_for || 0)
      );
    },
    enabled: Boolean(leagueId && league && currentMember),
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ["league-audit-events", leagueId],
    queryFn: () => appClient.entities.LeagueAuditEvent.filter({ league_id: leagueId }, "-created_date"),
    enabled: Boolean(leagueId && league && currentMember),
  });

  const { data: auditFeedback = [], refetch: refetchAuditFeedback } = useQuery({
    queryKey: ["league-audit-feedback", leagueId],
    queryFn: () => appClient.entities.LeagueAuditFeedback.filter({ league_id: leagueId }),
    enabled: Boolean(leagueId && league && currentMember),
  });

  const { data: season = null } = useQuery({
    queryKey: ["league-season", leagueId],
    queryFn: async () => {
      const seasons = await appClient.entities.Season.filter({ league_id: leagueId });
      return seasons[0] || null;
    },
    enabled: Boolean(leagueId && currentMember),
  });

  const currentWeek = season?.current_week || 1;
  const { data: leagueWeekData } = useLeagueWeek(currentMember ? leagueId : null, currentWeek);

  const { data: schedule = [] } = useQuery({
    queryKey: ["league-schedule", leagueId],
    queryFn: async () => {
      const rows = await appClient.entities.GameSchedule.filter({ league_id: leagueId }, "week_number", "game_number");
      return rows.sort((a, b) => Number(a.week_number || 0) - Number(b.week_number || 0) || Number(a.game_number || 0) - Number(b.game_number || 0));
    },
    enabled: Boolean(leagueId && currentMember),
  });

  const { data: matchups = [] } = useQuery({
    queryKey: ["league-matchups", leagueId],
    queryFn: async () => {
      const rows = await appClient.entities.Matchup.filter({ league_id: leagueId });
      return rows.sort((a, b) => Number(a.week_number || 0) - Number(b.week_number || 0));
    },
    enabled: Boolean(leagueId && currentMember),
  });

  const { data: weekResults = [] } = useQuery({
    queryKey: ["league-week-results", leagueId],
    queryFn: async () => {
      const rows = await appClient.entities.LeagueWeekResult.filter({ league_id: leagueId });
      return rows.sort((a, b) => Number(b.week_number || 0) - Number(a.week_number || 0));
    },
    enabled: Boolean(leagueId && currentMember),
  });

  const voteMutation = useMutation({
    mutationFn: ({ auditEventId, vote }) => appClient.functions.invoke("vote_league_audit", { audit_event_id: auditEventId, vote }),
    onSuccess: () => {
      toast.success("Feedback saved.");
      refetchAuditFeedback();
    },
    onError: (error) => toast.error(error.message || "Failed to save feedback."),
  });

  if (isLoadingUser || isLoadingLeague || isLoadingMembers || !league || !currentMember || (isManagerPortal && !targetManager)) {
    return <LoadingLeague />;
  }

  return (
    <LeagueShell>
      <LeagueNav league={league} currentMember={currentMember} isCommissioner={isCommissioner} isManagerPortal={isManagerPortal} />
      {isManagerPortal ? (
        <ManagerPortalPage
          league={league}
          season={season}
          manager={targetManager}
          members={members}
          matchups={matchups}
          weekResults={weekResults}
        />
      ) : (
        <LeagueInfoPage
          league={league}
          season={season}
          currentMember={currentMember}
          isCommissioner={isCommissioner}
          members={members}
          standings={standings}
          isLoadingStandings={isLoadingStandings}
          schedule={schedule}
          matchups={matchups}
          auditEvents={auditEvents}
          auditFeedback={auditFeedback}
          voteMutation={voteMutation}
          leagueWeekData={leagueWeekData}
        />
      )}
    </LeagueShell>
  );
}
