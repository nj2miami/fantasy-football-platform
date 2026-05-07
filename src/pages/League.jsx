import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
  Mail,
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
import { useLeagueWeek, useLineup, useReleasedPlayers } from "@/api/hooks";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

const HUB_TABS = [
  { id: "overview", label: "Overview", icon: Trophy },
  { id: "news", label: "League News", icon: Newspaper },
  { id: "free-agents", label: "Free Agent Board", icon: Shuffle },
  { id: "rules", label: "League Rules", icon: ClipboardList },
  { id: "schedule", label: "Full Schedule", icon: CalendarDays },
];

const FREE_AGENT_POSITIONS = ["QB", "OFF", "DEF", "K"];
const FREE_AGENT_TIERS = [5, 4, 3, 2, 1];
const RULE_DEFINITIONS = [
  {
    key: "draft_cadence",
    label: "Draft",
    value: (league) => league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft" ? "Weekly redraft" : "Season snake",
    description: "Controls whether managers draft once for the season or draft from the available pool each week.",
  },
  {
    key: "schedule",
    label: "Schedule",
    value: (league) => league.schedule_type === "league_wide" ? "League-wide scoring" : "Head to head",
    description: "Controls how teams are paired and how weekly matchups are presented.",
  },
  {
    key: "ranking",
    label: "Ranking",
    value: (league) => league.ranking_system === "offl" ? "H2H + league points" : "Standard record",
    description: "Controls how standings are ordered after weekly matchups and scoring are resolved.",
  },
  {
    key: "retention",
    label: "Retention",
    value: (league) => league.player_retention_mode === "two_use_release" ? "Two-use release" : "Retained rosters",
    description: "Controls whether players stay rostered or return to the free agent board after usage limits.",
  },
  {
    key: "player_names",
    label: "Player Names",
    value: (league) => league.draft_player_name_visibility === "hidden_until_drafted" ? "Hidden until drafted" : "Shown",
    description: "Controls whether player names are visible during the draft before a player is selected.",
  },
  {
    key: "durability",
    label: "Durability",
    value: (league) => league.durability_mode === "off" ? "Off" : league.durability_mode === "revealed_at_draft" ? "Revealed at draft" : "Hidden until drafted",
    description: "Controls whether durability changes affect scoring and when managers can see durability state.",
  },
  {
    key: "manager_points",
    label: "Manager Points",
    value: (league) => league.manager_points_enabled ? `${Number(league.manager_points_starting || 0)} starting points` : "Off",
    description: "Controls whether managers have a points bank for future league actions and skills.",
  },
  {
    key: "roster_draft",
    label: "Roster / Draft Settings",
    value: (league) => {
      const rules = league.roster_rules || {};
      const draftGroups = rules.draft_groups || {};
      const total = Number(rules.total_drafted || 0);
      return total ? `${total} drafted players` : Object.entries(draftGroups).map(([key, value]) => `${key} ${value}`).join(" / ") || "Standard roster";
    },
    description: "Controls roster composition, draft group counts, and the shape of each manager's team.",
  },
];

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

function lineupSlotStatus(slot) {
  return String(slot?.status || slot?.lineup_status || slot?.slot_status || slot?.role || "active").toLowerCase();
}

function slotGroupLabel(slot) {
  const status = lineupSlotStatus(slot);
  if (status === "bench" || status === "benched") return "Bench";
  if (status === "treating" || status === "treatment" || status === "treated") return "Treatment";
  return "Starters";
}

function memberName(member) {
  return member?.team_name || (member?.is_ai ? "AI Manager" : "Manager");
}

function draftBucket(position) {
  const value = String(position || "").toUpperCase();
  if (value === "QB" || value === "K") return value;
  if (value === "DEF" || value === "DST" || value === "D/ST") return "DEF";
  return "OFF";
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
    <div className={`neo-border ${tone} p-3`}>
      <p className="text-xs font-black uppercase text-gray-500">{label}</p>
      <p className="text-xl font-black text-black">{value}</p>
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

function Panel({ title, icon: Icon, children, action }) {
  return (
    <section className="neo-border bg-white p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase text-orange-600">
          {Icon && <Icon className="h-5 w-5" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function LeagueNav({ league, currentMember, isCommissioner, activeArea }) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Link to={createPageUrl("Leagues")}>
        <Button className="neo-btn bg-black text-white">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Leagues
        </Button>
      </Link>
      <div className="flex flex-wrap gap-2">
        <Link to={createPageUrl(`League?id=${league.id}`)}>
          <Button className={`neo-btn ${activeArea === "hub" ? "bg-[#F7B801] text-black" : "bg-white text-black"}`}>
            <Trophy className="mr-2 h-5 w-5" />
            League Hub
          </Button>
        </Link>
        {currentMember && (
          <Link to={`/league/manager?id=${league.id}&managerId=${currentMember.id}`}>
            <Button className={`neo-btn ${activeArea === "manager" ? "bg-[#00D9FF] text-black" : "bg-white text-black"}`}>
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

function CompactHeader({ league, season, currentMember, memberCount, context }) {
  return (
    <div className="neo-border mb-4 bg-black p-4 text-white">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="neo-border bg-[#F7B801] px-2 py-1 text-xs font-black uppercase text-black">Private</span>
            <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase text-black">{league.league_status || "Recruiting"}</span>
            {context && <span className="text-xs font-black uppercase text-[#00D9FF]">{context}</span>}
          </div>
          <h1 className="mt-2 truncate text-2xl font-black uppercase text-orange-500 sm:text-3xl">{league.name}</h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px]">
          <StatTile label="Week" value={season?.current_week || 1} tone="bg-white" />
          <StatTile label="Teams" value={`${memberCount}/${league.max_members || memberCount}`} tone="bg-[#D7F8E8]" />
          <StatTile label="Your Team" value={currentMember ? memberName(currentMember) : "--"} tone="bg-[#EFFBFF]" />
        </div>
      </div>
    </div>
  );
}

function matchupScore(matchup, result, side) {
  return result?.total_points ?? (side === "home" ? matchup?.home_score : matchup?.away_score);
}

function matchupStatus(matchup, resultRows) {
  const hasResults = resultRows.some((result) => Number(result.week_number) === Number(matchup.week_number));
  if (hasResults) return "Final";
  if (Number(matchup.home_score || 0) || Number(matchup.away_score || 0)) return "Final";
  return "Scheduled";
}

function CurrentMatchupsPanel({ leagueId, currentWeek, matchups, weekResults, members }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const currentMatchups = matchups.filter((matchup) => Number(matchup.week_number) === Number(currentWeek));
  return (
    <Panel
      title={`Week ${currentWeek} Matchups`}
      icon={ShieldCheck}
      action={<Link className="text-sm font-black uppercase text-orange-600" to={`/league/week/${currentWeek}?id=${leagueId}`}>Full Week</Link>}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {currentMatchups.map((matchup) => {
          const homeResult = weekResults.find((result) => result.league_member_id === matchup.home_member_id && Number(result.week_number) === Number(currentWeek));
          const awayResult = weekResults.find((result) => result.league_member_id === matchup.away_member_id && Number(result.week_number) === Number(currentWeek));
          return (
            <Link key={matchup.id} to={`/league/week/${currentWeek}?id=${leagueId}&matchId=${matchup.id}`} className="neo-border block bg-gray-50 p-3 hover:bg-[#FFF7D6]">
              <div className="flex items-center justify-between gap-3 text-sm font-black uppercase text-gray-500">
                <span>{matchupStatus(matchup, [homeResult, awayResult].filter(Boolean))}</span>
                <span>Week {currentWeek}</span>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-black">
                <span>{memberName(memberById.get(matchup.home_member_id))}</span>
                <span className="bg-black px-2 py-1 text-white">{formatNumber(matchupScore(matchup, homeResult, "home"), 2)} - {formatNumber(matchupScore(matchup, awayResult, "away"), 2)}</span>
                <span className="text-right">{memberName(memberById.get(matchup.away_member_id))}</span>
              </div>
            </Link>
          );
        })}
        {!currentMatchups.length && <EmptyState title="No matchups yet" detail="The weekly schedule has not generated matchups." />}
      </div>
    </Panel>
  );
}

function StandingsPanel({ league, standings, members, isLoading, compact = false }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const rows = compact ? standings.slice(0, 6) : standings;
  return (
    <Panel title="Overall Standings" icon={Trophy}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b-4 border-black">
            <tr>
              <th className="p-2 font-black uppercase">Rank</th>
              <th className="p-2 font-black uppercase">Team</th>
              <th className="p-2 font-black uppercase">Record</th>
              {league.ranking_system === "offl" && <th className="p-2 font-black uppercase">LP</th>}
              <th className="p-2 font-black uppercase">PF</th>
              <th className="p-2 font-black uppercase">PA</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={league.ranking_system === "offl" ? 6 : 5} className="p-3 text-center font-bold">Loading standings...</td></tr>}
            {!isLoading && rows.map((standing, index) => {
              const member = memberById.get(standing.league_member_id);
              return (
                <tr key={standing.id || standing.league_member_id} className="border-b-2 border-gray-200">
                  <td className="p-2 font-black">{index + 1}</td>
                  <td className="p-2 font-bold">
                    <span className="inline-flex items-center gap-2">
                      {memberName(member)}
                      {member?.is_ai && <Bot className="h-4 w-4 text-gray-500" />}
                    </span>
                  </td>
                  <td className="p-2 font-bold">{`${standing.wins || 0}-${standing.losses || 0}-${standing.ties || 0}`}</td>
                  {league.ranking_system === "offl" && <td className="p-2 font-bold">{formatNumber(standing.league_points, 1)}</td>}
                  <td className="p-2 font-bold">{formatNumber(standing.points_for, 2)}</td>
                  <td className="p-2 font-bold">{formatNumber(standing.points_against, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && standings.length === 0 && <EmptyState title="No standings yet" detail="Standings will populate once matchups are resolved." />}
    </Panel>
  );
}

function CommissionerMessagePanel({ league, isCommissioner }) {
  const note = league.commissioner_message_of_day || league.commissioner_notes || league.notes || league.manager_message || "";
  return (
    <Panel title="Commissioner Message" icon={MessageSquare}>
      {note ? (
        <div className="neo-border bg-[#FFF7D6] p-4 font-bold leading-relaxed text-black">{note}</div>
      ) : (
        <EmptyState title="No message posted" detail={isCommissioner ? "Commissioner tools can publish the next update." : "No priority note is posted."} />
      )}
    </Panel>
  );
}

function NewsPanel({ newsItems, auditEvents, season, leagueWeekData, leagueId }) {
  const currentRevealState = leagueWeekData?.randomization?.reveal_state || season?.reveal_state || "hidden";
  const generatedItems = [
    {
      id: "week-status",
      title: `Week ${season?.current_week || 1} is ${leagueWeekData?.week?.status || "pending"}`,
      body: currentRevealState === "revealed" ? "Hidden-week scoring is visible." : "Hidden-week scoring is protected until reveal.",
      published_at: new Date().toISOString(),
    },
    ...auditEvents.slice(0, 4).map((event) => ({
      id: event.id,
      title: (event.changed_keys || ["League settings"]).join(", "),
      body: `${event.actor_email || "Commissioner"} updated league rules ${formatDate(event.created_date)}.`,
      published_at: event.created_date,
    })),
  ];
  const items = newsItems.length ? newsItems : generatedItems;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {items.map((item) => (
          <article key={item.id} className="neo-border bg-white p-4">
            <p className="text-xs font-black uppercase text-gray-500">{formatDate(item.published_at || item.created_date)}</p>
            <h2 className="mt-1 text-xl font-black uppercase text-orange-600">{item.title}</h2>
            <p className="mt-2 font-bold text-gray-700">{item.body}</p>
          </article>
        ))}
      </div>
      <ReleasedPlayersPanel leagueId={leagueId} />
    </div>
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
  const ruleNotes = league.league_rule_notes || {};
  return (
    <Panel title="League Rules" icon={ClipboardList}>
      <div className="grid gap-3 lg:grid-cols-2">
        {RULE_DEFINITIONS.map((rule) => (
          <div key={rule.key} className="neo-border bg-gray-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-gray-500">{rule.label}</p>
                <p className="text-xl font-black text-black">{rule.value(league)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm font-bold text-gray-700">{rule.description}</p>
            {ruleNotes[rule.key] && (
              <div className="neo-border mt-3 bg-[#FFF7D6] p-3">
                <p className="text-xs font-black uppercase text-gray-500">Commissioner Note</p>
                <p className="mt-1 text-sm font-bold text-black">{ruleNotes[rule.key]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {auditEvents.length > 0 && (
        <div className="mt-5 space-y-3">
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
    </Panel>
  );
}

function FreeAgentBoard({ league, currentMember }) {
  const { data: board = { tiers: [], playersById: new Map() } } = useQuery({
    queryKey: ["free-agent-draft-tiers", league.id, currentMember?.id],
    queryFn: async () => {
      const tiers = await appClient.entities.LeaguePlayerDraftTier.filter({ league_id: league.id });
      const tierPlayerIds = [...new Set(tiers.map((tier) => tier.player_id).filter(Boolean))];
      const [members, rosters, usage, picks] = await Promise.all([
        appClient.entities.LeagueMember.filter({ league_id: league.id }),
        appClient.entities.Roster.list(),
        currentMember?.id ? appClient.entities.ManagerPlayerUsage.filter({ league_id: league.id, league_member_id: currentMember.id }) : [],
        appClient.entities.DraftPick.filter({ league_id: league.id }),
      ]);
      const leagueMemberIds = new Set((members || []).map((member) => member.id));
      const unavailableIds = new Set([
        ...(rosters || []).filter((slot) => leagueMemberIds.has(slot.league_member_id)).map((slot) => slot.player_id),
        ...(picks || []).map((pick) => pick.player_id),
        ...(league.draft_mode === "weekly_redraft" || league.mode === "weekly_redraft" ? (usage || []).map((item) => item.player_id) : []),
      ]);
      const availableTierIds = tierPlayerIds.filter((playerId) => !unavailableIds.has(playerId));
      const playerChunks = [];
      for (let index = 0; index < availableTierIds.length; index += 100) {
        playerChunks.push(availableTierIds.slice(index, index + 100));
      }
      const playerRows = playerChunks.length
        ? (await Promise.all(playerChunks.map((ids) => appClient.entities.Player.filter({ id: ids })))).flat()
        : [];
      return {
        tiers: tiers.filter((tier) => availableTierIds.includes(tier.player_id)),
        playersById: new Map(playerRows.map((player) => [player.id, player])),
      };
    },
    enabled: Boolean(league.id),
  });
  const tiers = useMemo(() => board.tiers || [], [board.tiers]);
  const playerById = useMemo(() => board.playersById || new Map(), [board.playersById]);
  const rowsByPosition = useMemo(() => {
    const grouped = Object.fromEntries(FREE_AGENT_POSITIONS.map((position) => [position, []]));
    tiers
      .forEach((tier) => {
        const bucket = draftBucket(tier.position);
        if (!grouped[bucket]) return;
        const player = playerById.get(tier.player_id);
        if (!player) return;
        grouped[bucket].push({ tier, player });
      });
    for (const position of FREE_AGENT_POSITIONS) {
      grouped[position] = grouped[position]
        .sort((a, b) => Number(a.tier.position_rank || 999) - Number(b.tier.position_rank || 999))
        .slice(0, 30);
    }
    return grouped;
  }, [playerById, tiers]);
  const visibleCount = FREE_AGENT_POSITIONS.reduce((sum, position) => sum + rowsByPosition[position].length, 0);
  return (
    <Panel title="Free Agent Board" icon={Shuffle}>
      <div className="grid gap-4 xl:grid-cols-4">
        {FREE_AGENT_POSITIONS.map((position) => (
          <div key={position} className="neo-border bg-gray-50">
            <div className="border-b-4 border-black bg-black p-3 text-white">
              <p className="text-center text-lg font-black uppercase">{position}</p>
            </div>
            <div className="p-3">
              {FREE_AGENT_TIERS.map((tierValue) => {
                const tierRows = rowsByPosition[position].filter((row) => Number(row.tier.tier_value || 1) === tierValue);
                if (!tierRows.length) return null;
                return (
                  <div key={`${position}-${tierValue}`} className="mb-4 last:mb-0">
                    <div className="mb-2 border-b-4 border-black pb-1">
                      <p className="text-xs font-black uppercase text-gray-500">Tier {tierValue}</p>
                    </div>
                    <div className="space-y-1">
                      {tierRows.map(({ player, tier }) => (
                        <Link key={player.id} to={createPageUrl(`PlayerStats?id=${player.id}`)} className="block bg-white p-2 text-sm font-bold hover:bg-[#FFF7D6]">
                          <span className="font-black">{player.player_display_name || player.full_name}</span>
                          <span className="text-gray-500"> | {player.team || "FA"}</span>
                          <span className="sr-only"> Rank {tier.position_rank}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!rowsByPosition[position].length && <p className="p-3 text-center text-sm font-bold text-gray-500">No available players</p>}
            </div>
          </div>
        ))}
      </div>
      {!visibleCount && <EmptyState title="No free agents visible" detail="Prepare the league draft pool or check whether all tiered players are already rostered." />}
    </Panel>
  );
}

function ReleasedPlayersPanel({ leagueId }) {
  const { data: releases = [] } = useReleasedPlayers(leagueId);
  return (
    <Panel title="Newly Released" icon={Users}>
      <div className="space-y-2">
        {releases.slice(0, 10).map((event) => (
          <div key={event.id} className="neo-border bg-gray-50 p-3">
            <p className="font-black">{event.player?.player_display_name || event.player?.full_name || event.player_id}</p>
            <p className="text-xs font-bold text-gray-600">Released by {memberName(event.member)} after week {event.week_number}</p>
          </div>
        ))}
        {!releases.length && <EmptyState title="No released players" detail="Released players will appear after weekly roster movement." />}
      </div>
    </Panel>
  );
}

function FullSchedulePanel({ leagueId, schedule, matchups, weekResults, members }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const weeks = schedule.length
    ? schedule
    : [...new Set(matchups.map((matchup) => Number(matchup.week_number || 0)).filter(Boolean))].map((weekNumber) => ({ id: `week-${weekNumber}`, week_number: weekNumber }));
  return (
    <Panel title="Full Schedule" icon={CalendarDays}>
      <div className="space-y-4">
        {weeks.map((week) => {
          const weekNumber = Number(week.week_number);
          const weekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === weekNumber);
          return (
            <div key={week.id || weekNumber} className="neo-border bg-gray-50 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to={`/league/week/${weekNumber}?id=${leagueId}`} className="font-black uppercase text-orange-600">Week {weekNumber}</Link>
                  <p className="text-xs font-bold uppercase text-gray-500">{formatDate(week.scheduled_at)} | {week.status || "Scheduled"}</p>
                </div>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {weekMatchups.map((matchup) => {
                  const homeResult = weekResults.find((result) => result.league_member_id === matchup.home_member_id && Number(result.week_number) === weekNumber);
                  const awayResult = weekResults.find((result) => result.league_member_id === matchup.away_member_id && Number(result.week_number) === weekNumber);
                  return (
                    <Link key={matchup.id} to={`/league/week/${weekNumber}?id=${leagueId}&matchId=${matchup.id}`} className="neo-border bg-white p-3 font-bold hover:bg-[#FFF7D6]">
                      {memberName(memberById.get(matchup.home_member_id))} {formatNumber(matchupScore(matchup, homeResult, "home"), 2)}
                      <span className="mx-2 text-gray-500">vs</span>
                      {memberName(memberById.get(matchup.away_member_id))} {formatNumber(matchupScore(matchup, awayResult, "away"), 2)}
                    </Link>
                  );
                })}
                {!weekMatchups.length && <p className="text-sm font-bold text-gray-500">No matchups scheduled.</p>}
              </div>
            </div>
          );
        })}
        {!weeks.length && <EmptyState title="No schedule yet" detail="The commissioner can generate the league calendar." />}
      </div>
    </Panel>
  );
}

function LeagueHubPage(props) {
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
    weekResults,
    auditEvents,
    auditFeedback,
    voteMutation,
    leagueWeekData,
    newsItems,
    activeTab,
  } = props;
  const currentWeek = season?.current_week || 1;
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {HUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link key={tab.id} to={`/league?id=${league.id}&tab=${tab.id}`} className={`neo-border inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-black uppercase ${activeTab === tab.id ? "bg-[#F7B801] text-black" : "bg-white text-black"}`}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {activeTab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <CommissionerMessagePanel league={league} isCommissioner={isCommissioner} />
            <CurrentMatchupsPanel leagueId={league.id} currentWeek={currentWeek} matchups={matchups} weekResults={weekResults} members={members} />
          </div>
          <StandingsPanel league={league} standings={standings} members={members} isLoading={isLoadingStandings} compact />
        </div>
      )}
      {activeTab === "news" && <NewsPanel newsItems={newsItems} auditEvents={auditEvents} season={season} leagueWeekData={leagueWeekData} leagueId={league.id} />}
      {activeTab === "free-agents" && <FreeAgentBoard league={league} currentMember={currentMember} />}
      {activeTab === "rules" && (
        <RulesPanel
          league={league}
          auditEvents={auditEvents}
          auditFeedback={auditFeedback}
          isVoting={voteMutation.isPending}
          onVote={(auditEventId, vote) => voteMutation.mutate({ auditEventId, vote })}
        />
      )}
      {activeTab === "schedule" && <FullSchedulePanel leagueId={league.id} schedule={schedule} matchups={matchups} weekResults={weekResults} members={members} />}
    </>
  );
}

function resultForMember(weekResults, memberId, weekNumber) {
  return weekResults.find((result) => result.league_member_id === memberId && Number(result.week_number) === Number(weekNumber));
}

function WeekMatchupsPage({ league, season, currentMember, members, matchups, weekResults, schedule, weekNumber }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const weekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === Number(weekNumber));
  const weekSchedule = schedule.find((item) => Number(item.week_number) === Number(weekNumber));
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} context={`Week ${weekNumber}`} />
      <Panel title={`Week ${weekNumber}`} icon={CalendarDays} action={<Link className="text-sm font-black uppercase text-orange-600" to={`/league?id=${league.id}&tab=schedule`}>Schedule</Link>}>
        <p className="mb-4 text-sm font-bold uppercase text-gray-500">{formatDate(weekSchedule?.scheduled_at)} | {weekSchedule?.status || "Scheduled"}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {weekMatchups.map((matchup) => {
            const homeResult = resultForMember(weekResults, matchup.home_member_id, weekNumber);
            const awayResult = resultForMember(weekResults, matchup.away_member_id, weekNumber);
            return (
              <Link key={matchup.id} to={`/league/week/${weekNumber}?id=${league.id}&matchId=${matchup.id}`} className="neo-border block bg-gray-50 p-4 hover:bg-[#FFF7D6]">
                <div className="mb-3 flex items-center justify-between text-xs font-black uppercase text-gray-500">
                  <span>{matchupStatus(matchup, [homeResult, awayResult].filter(Boolean))}</span>
                  <span>{formatNumber(homeResult?.league_points, 1)} LP / {formatNumber(awayResult?.league_points, 1)} LP</span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-black">
                  <span>{memberName(memberById.get(matchup.home_member_id))}</span>
                  <span className="bg-black px-2 py-1 text-white">{formatNumber(matchupScore(matchup, homeResult, "home"), 2)} - {formatNumber(matchupScore(matchup, awayResult, "away"), 2)}</span>
                  <span className="text-right">{memberName(memberById.get(matchup.away_member_id))}</span>
                </div>
              </Link>
            );
          })}
          {!weekMatchups.length && <EmptyState title="No matchups" detail={`Week ${weekNumber} does not have scheduled matchups.`} />}
        </div>
      </Panel>
    </>
  );
}

function TeamScoringDetail({ title, result, lineup, playerById }) {
  const details = normalizeSlots(result?.scoring_details).length ? normalizeSlots(result.scoring_details) : normalizeSlots(lineup?.slots);
  const groups = ["Starters", "Bench", "Treatment"];
  return (
    <Panel title={title} icon={Users}>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <StatTile label="Total" value={formatNumber(result?.total_points, 2)} tone="bg-[#EFFBFF]" />
        <StatTile label="Rank" value={result?.weekly_rank || "--"} tone="bg-white" />
        <StatTile label="League Pts" value={formatNumber(result?.league_points, 1)} tone="bg-[#D7F8E8]" />
      </div>
      <div className="space-y-4">
        {groups.map((group) => {
          const rows = details.filter((slot) => slotGroupLabel(slot) === group);
          return (
            <div key={group}>
              <p className="mb-2 text-xs font-black uppercase text-gray-500">{group}</p>
              <div className="space-y-2">
                {rows.map((slot, index) => {
                  const player = playerById.get(slot.player_id);
                  const samples = normalizeSlots(slot.source_week_values);
                  return (
                    <div key={`${slot.player_id}-${index}`} className="neo-border bg-gray-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">{player?.player_display_name || player?.full_name || slot.player_id}</p>
                          <p className="text-xs font-bold uppercase text-gray-500">{player?.position || slot.slot || "--"} | {player?.team || "FA"} | {lineupSlotStatus(slot)}</p>
                        </div>
                        <p className="text-lg font-black">{formatNumber(slot.scored_points, 2)}</p>
                      </div>
                      {samples.length > 0 && (
                        <p className="mt-2 text-xs font-bold text-gray-600">
                          {samples.map((sample) => `Week ${sample.week}: ${formatNumber(sample.points, 2)}`).join(" | ")}
                          {slot.average_points !== undefined ? ` | Avg ${formatNumber(slot.average_points, 2)}` : ""}
                          {slot.lineup_multiplier !== undefined ? ` | x${formatNumber(slot.lineup_multiplier, 2)}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
                {!rows.length && <p className="text-sm font-bold text-gray-500">None</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MatchupDetailPage({ league, season, currentMember, members, matchups, weekResults, lineups, players, weekNumber, matchId }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const matchup = matchups.find((item) => item.id === matchId && Number(item.week_number) === Number(weekNumber));
  if (!matchup) {
    return (
      <>
        <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} context={`Week ${weekNumber}`} />
        <EmptyState title="Matchup not found" detail="This matchup is not available in the selected league week." />
      </>
    );
  }
  const home = memberById.get(matchup.home_member_id);
  const away = memberById.get(matchup.away_member_id);
  const homeResult = resultForMember(weekResults, matchup.home_member_id, weekNumber);
  const awayResult = resultForMember(weekResults, matchup.away_member_id, weekNumber);
  const homeLineup = lineups.find((lineup) => lineup.league_member_id === matchup.home_member_id && Number(lineup.week_number) === Number(weekNumber));
  const awayLineup = lineups.find((lineup) => lineup.league_member_id === matchup.away_member_id && Number(lineup.week_number) === Number(weekNumber));
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} context={`Week ${weekNumber} Matchup`} />
      <Panel title={`${memberName(home)} vs ${memberName(away)}`} icon={ShieldCheck} action={<Link className="text-sm font-black uppercase text-orange-600" to={`/league/week/${weekNumber}?id=${league.id}`}>Week {weekNumber}</Link>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label={memberName(home)} value={formatNumber(matchupScore(matchup, homeResult, "home"), 2)} tone="bg-[#EFFBFF]" />
          <div className="neo-border flex items-center justify-center bg-black p-3 text-2xl font-black text-white">VS</div>
          <StatTile label={memberName(away)} value={formatNumber(matchupScore(matchup, awayResult, "away"), 2)} tone="bg-[#FFF7D6]" />
        </div>
      </Panel>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <TeamScoringDetail title={memberName(home)} result={homeResult} lineup={homeLineup} playerById={playerById} />
        <TeamScoringDetail title={memberName(away)} result={awayResult} lineup={awayLineup} playerById={playerById} />
      </div>
    </>
  );
}

function ManagerMatchupPanel({ league, matchups, weekResults, members, manager, currentWeek }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const managerMatchups = matchups
    .filter((item) => item.home_member_id === manager.id || item.away_member_id === manager.id)
    .sort((a, b) => Number(a.week_number || 0) - Number(b.week_number || 0));
  const nextMatchup = managerMatchups.find((item) => Number(item.week_number) >= Number(currentWeek) && !resultForMember(weekResults, manager.id, item.week_number)) || managerMatchups.find((item) => Number(item.week_number) === Number(currentWeek));
  const weekNumber = Number(nextMatchup?.week_number || currentWeek);
  const opponentId = nextMatchup?.home_member_id === manager.id ? nextMatchup.away_member_id : nextMatchup?.home_member_id;
  const opponent = memberById.get(opponentId);
  const myResult = resultForMember(weekResults, manager.id, weekNumber);
  const opponentResult = resultForMember(weekResults, opponentId, weekNumber);
  return (
    <Panel title={`Week ${weekNumber} Matchup`} icon={ShieldCheck} action={nextMatchup && <Link className="text-sm font-black uppercase text-orange-600" to={`/league/week/${weekNumber}?id=${league.id}&matchId=${nextMatchup.id}`}>Game Detail</Link>}>
      {nextMatchup ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label={memberName(manager)} value={formatNumber(myResult?.total_points ?? (nextMatchup.home_member_id === manager.id ? nextMatchup.home_score : nextMatchup.away_score), 2)} tone="bg-[#EFFBFF]" />
          <div className="neo-border flex items-center justify-center bg-black p-4 text-3xl font-black text-white">VS</div>
          <StatTile label={memberName(opponent)} value={formatNumber(opponentResult?.total_points ?? (nextMatchup.home_member_id === manager.id ? nextMatchup.away_score : nextMatchup.home_score), 2)} tone="bg-[#FFF7D6]" />
        </div>
      ) : (
        <EmptyState title="No matchup yet" detail={`${league.name} has not generated your next matchup.`} />
      )}
    </Panel>
  );
}

function ManagerLineupPanel({ league, lineupWeek, manager }) {
  const queryClient = useQueryClient();
  const { data: lineup } = useLineup(league.id, lineupWeek, manager.id);
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
  useEffect(() => setSelectedIds(new Set(initialSelection)), [initialSelection]);

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
        week_number: lineupWeek,
        slots,
      });
    },
    onSuccess: () => {
      toast.success("Lineup finalized.");
      queryClient.invalidateQueries({ queryKey: ["lineup", league.id, lineupWeek, manager.id] });
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
    <Panel
      title={`Set Lineup: Week ${lineupWeek}`}
      icon={ClipboardList}
      action={(
        <Button onClick={() => finalizeLineupMutation.mutate()} disabled={finalizeLineupMutation.isPending || !roster.length || selectedIds.size === 0} className="neo-btn bg-[#FF6B35] text-white">
          <Save className="mr-2 h-5 w-5" />
          {finalizeLineupMutation.isPending ? "Saving..." : "Finalize"}
        </Button>
      )}
    >
      <div className="grid gap-2 lg:grid-cols-2">
        {roster.map((slot) => {
          const player = playerById.get(slot.player_id);
          const selected = selectedIds.has(slot.player_id);
          return (
            <button key={slot.id} type="button" onClick={() => togglePlayer(slot.player_id)} className={`neo-border flex w-full items-center justify-between gap-3 p-3 text-left ${selected ? "bg-[#D7F8E8]" : "bg-gray-50"}`}>
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
      </div>
      {!roster.length && <EmptyState title="No roster yet" detail="Draft or roster assignment must happen before lineup lock." />}
      <p className="mt-4 text-xs font-bold uppercase text-gray-500">{lineup?.finalized_at ? `Last finalized ${new Date(lineup.finalized_at).toLocaleString()}` : "Not finalized for this week."}</p>
    </Panel>
  );
}

function ManagerResultsPanel({ league, weekResults, matchups, members, manager }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const myResults = weekResults
    .filter((result) => result.league_member_id === manager.id)
    .sort((a, b) => Number(b.week_number || 0) - Number(a.week_number || 0));
  return (
    <Panel title="Previously Played" icon={Trophy}>
      <div className="space-y-2">
        {myResults.map((result) => {
          const matchup = matchups.find((item) => Number(item.week_number) === Number(result.week_number) && (item.home_member_id === manager.id || item.away_member_id === manager.id));
          const opponentId = matchup?.home_member_id === manager.id ? matchup.away_member_id : matchup?.home_member_id;
          return (
            <Link key={result.id} to={matchup ? `/league/week/${result.week_number}?id=${league.id}&matchId=${matchup.id}` : `/league/week/${result.week_number}?id=${league.id}`} className="neo-border grid gap-2 bg-gray-50 p-3 text-sm font-bold hover:bg-[#FFF7D6] sm:grid-cols-5">
              <span className="font-black uppercase">Week {result.week_number}</span>
              <span>{memberName(memberById.get(opponentId))}</span>
              <span>{formatNumber(result.total_points, 2)} pts</span>
              <span>Rank {result.weekly_rank || "--"}</span>
              <span>{formatNumber(result.league_points, 1)} LP</span>
            </Link>
          );
        })}
        {!myResults.length && <EmptyState title="No results yet" detail="Your weekly results will appear after scoring resolves." />}
      </div>
    </Panel>
  );
}

function ManagerMessagingPanel({ messages, members }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  return (
    <Panel title="Messages" icon={Mail}>
      <div className="space-y-2">
        {messages.map((message) => (
          <div key={message.id} className="neo-border bg-[#FFF7D6] p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-black uppercase">{message.subject}</p>
              <p className="text-xs font-bold uppercase text-gray-500">{formatDate(message.created_date)}</p>
            </div>
            <p className="mt-2 text-sm font-bold text-gray-700">{message.body}</p>
            {message.sender_member_id && <p className="mt-2 text-xs font-bold uppercase text-gray-500">From {memberName(memberById.get(message.sender_member_id))}</p>}
          </div>
        ))}
        {!messages.length && <EmptyState title="No messages" detail="No manager messages received." />}
      </div>
    </Panel>
  );
}

function ManagerPortalPage({ league, season, manager, members, matchups, weekResults, messages }) {
  const currentWeek = season?.current_week || 1;
  const nextMatchup = matchups
    .filter((item) => item.home_member_id === manager.id || item.away_member_id === manager.id)
    .sort((a, b) => Number(a.week_number || 0) - Number(b.week_number || 0))
    .find((item) => Number(item.week_number) >= Number(currentWeek) && !resultForMember(weekResults, manager.id, item.week_number));
  const lineupWeek = Number(nextMatchup?.week_number || currentWeek);
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={manager} memberCount={members.length} context="Manager Portal" />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <ManagerMatchupPanel league={league} currentWeek={currentWeek} matchups={matchups} weekResults={weekResults} members={members} manager={manager} />
          <ManagerLineupPanel league={league} lineupWeek={lineupWeek} manager={manager} />
          <ManagerResultsPanel league={league} weekResults={weekResults} matchups={matchups} members={members} manager={manager} />
        </div>
        <div className="space-y-5">
          <ManagerMessagingPanel messages={messages} members={members} />
          <FreeAgentBoard league={league} currentWeek={lineupWeek} currentMember={manager} />
        </div>
      </div>
    </>
  );
}

export default function League() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const searchParams = new URLSearchParams(location.search);
  const leagueId = searchParams.get("id") || searchParams.get("leagueId");
  const requestedManagerId = searchParams.get("managerId") || searchParams.get("memberId") || searchParams.get("teamId");
  const requestedMatchId = searchParams.get("matchId");
  const routeWeekNumber = Number(params.weekNumber || 0);
  const isManagerPortal = location.pathname.toLowerCase().startsWith("/league/manager");
  const isWeekView = location.pathname.toLowerCase().startsWith("/league/week/");
  const activeTab = HUB_TABS.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "overview";

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

  const { data: newsItems = [] } = useQuery({
    queryKey: ["league-news", leagueId],
    queryFn: async () => {
      const rows = await appClient.entities.LeagueNewsItem.filter({ league_id: leagueId, status: "PUBLISHED" }, "-published_at");
      return rows.sort((a, b) => new Date(b.published_at || b.created_date).getTime() - new Date(a.published_at || a.created_date).getTime());
    },
    enabled: Boolean(leagueId && currentMember),
  });

  const { data: managerMessages = [] } = useQuery({
    queryKey: ["manager-messages", leagueId, targetManager?.id],
    queryFn: async () => {
      const rows = await appClient.entities.ManagerMessage.filter({ league_id: leagueId, recipient_member_id: targetManager.id }, "-created_date");
      return rows.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    },
    enabled: Boolean(leagueId && targetManager?.id),
  });

  const { data: lineups = [] } = useQuery({
    queryKey: ["league-lineups", leagueId],
    queryFn: () => appClient.entities.Lineup.filter({ league_id: leagueId }),
    enabled: Boolean(leagueId && currentMember && isWeekView),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["league-detail-players", leagueId, isWeekView],
    queryFn: () => appClient.entities.Player.list(),
    enabled: Boolean(leagueId && currentMember && isWeekView && requestedMatchId),
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

  const activeArea = isManagerPortal ? "manager" : "hub";

  return (
    <LeagueShell>
      <LeagueNav league={league} currentMember={currentMember} isCommissioner={isCommissioner} activeArea={activeArea} />
      {isWeekView ? (
        requestedMatchId ? (
          <MatchupDetailPage
            league={league}
            season={season}
            currentMember={currentMember}
            members={members}
            matchups={matchups}
            weekResults={weekResults}
            lineups={lineups}
            players={players}
            weekNumber={routeWeekNumber}
            matchId={requestedMatchId}
          />
        ) : (
          <WeekMatchupsPage
            league={league}
            season={season}
            currentMember={currentMember}
            members={members}
            matchups={matchups}
            weekResults={weekResults}
            schedule={schedule}
            weekNumber={routeWeekNumber}
          />
        )
      ) : isManagerPortal ? (
        <ManagerPortalPage
          league={league}
          season={season}
          manager={targetManager}
          members={members}
          matchups={matchups}
          weekResults={weekResults}
          messages={managerMessages}
        />
      ) : (
        <LeagueHubPage
          league={league}
          season={season}
          currentMember={currentMember}
          isCommissioner={isCommissioner}
          members={members}
          standings={standings}
          isLoadingStandings={isLoadingStandings}
          schedule={schedule}
          matchups={matchups}
          weekResults={weekResults}
          auditEvents={auditEvents}
          auditFeedback={auditFeedback}
          voteMutation={voteMutation}
          leagueWeekData={leagueWeekData}
          newsItems={newsItems}
          activeTab={activeTab}
        />
      )}
    </LeagueShell>
  );
}
