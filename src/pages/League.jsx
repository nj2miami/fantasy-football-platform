import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle,
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
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { useLeagueWeek, useLineup, useReleasedPlayers } from "@/api/hooks";
import { supabase } from "@/lib/supabase";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

const HUB_TABS = [
  { id: "overview", path: "", label: "Overview", icon: Trophy },
  { id: "news", path: "news", label: "League News", icon: Newspaper },
  { id: "player-leaders", path: "player-leaders", label: "Player Leaders", icon: BarChart3 },
  { id: "free-agents", path: "free-agents", label: "Free Agent Board", icon: Shuffle },
  { id: "rules", path: "rules", label: "League Rules", icon: ClipboardList },
  { id: "schedule", path: "schedule", label: "Full Schedule", icon: CalendarDays },
];

const FREE_AGENT_POSITIONS = ["QB", "OFF", "DEF", "K"];
const FREE_AGENT_TIERS = [5, 4, 3, 2, 1];
const GAME_PLAN_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
  { value: "conservative", label: "Conservative" },
  { value: "counter", label: "Counter" },
];
const MANAGER_PORTAL_TABS = [
  { id: "lineup", path: "lineup", label: "Set Lineup", icon: ClipboardList },
  { id: "matches", path: "matches", label: "Previous Matches", icon: Trophy },
  { id: "messages", path: "messages", label: "Messages", icon: Mail },
  { id: "free-agents", path: "free-agents", label: "Free Agent Board", icon: Shuffle },
  { id: "roster", path: "roster", label: "Manage Roster", icon: Users },
];
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
    value: (league) => league.player_retention_mode === "limited_use" || league.player_retention_mode === "two_use_release" ? `Limited use (${Number(league.player_retention_limit || 2)} starts)` : "Retained rosters",
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

function collectSlotPlayerIds(slots, targetSet = new Set()) {
  normalizeSlots(slots).forEach((slot) => {
    if (slot?.player_id) targetSet.add(slot.player_id);
  });
  return targetSet;
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

function rosterCapacity(league) {
  const groups = league?.roster_rules?.draft_groups || {};
  const configured = Object.values(groups).reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.max(1, Number(league?.draft_config?.rounds || 0), configured || 0);
}

function leagueStatusLabel(league, season) {
  const status = String(league?.league_status || "").toUpperCase();
  const seasonStatus = String(season?.status || "").toUpperCase();
  if (status && status !== "RECRUITING") return status.replace(/_/g, " ");
  if (seasonStatus && seasonStatus !== "DRAFTING") return seasonStatus.replace(/_/g, " ");
  if (season || status === "DRAFTING") return "DRAFTING";
  return "RECRUITING";
}

function playerDisplayName(player, fallback = "Unknown Player") {
  return player?.player_display_name || player?.full_name || player?.name || fallback;
}

function playerTeamText(player) {
  return player?.team || "Team hidden";
}

function rosterSlotPlayer(slot, playerById) {
  const joinedPlayer = Array.isArray(slot?.players) ? slot.players[0] : slot?.players;
  return joinedPlayer || playerById.get(slot?.player_id) || null;
}

function TierBadge({ tier }) {
  if (tier === null || tier === undefined) {
    return <span className="neo-border bg-gray-200 px-2 py-1 text-[11px] font-black uppercase text-black">T--</span>;
  }
  const tierValue = Number(tier || 1);
  const classes = {
    5: "bg-[#F7B801] text-black",
    4: "bg-[#00D9FF] text-black",
    3: "bg-[#D7F8E8] text-black",
    2: "bg-white text-black",
    1: "bg-gray-200 text-black",
  };
  return <span className={`neo-border px-2 py-1 text-[11px] font-black uppercase ${classes[tierValue] || classes[1]}`}>T{tierValue}</span>;
}

function DurabilityBadge({ durability }) {
  if (durability === null || durability === undefined) return <span className="neo-border bg-gray-200 px-2 py-1 text-[11px] font-black uppercase text-black">Dur --</span>;
  const value = Number(durability || 100);
  const classes = value >= 100 ? "bg-[#D7F8E8] text-black" : value <= 70 ? "bg-red-100 text-red-800" : "bg-white text-black";
  return <span className={`neo-border px-2 py-1 text-[11px] font-black uppercase ${classes}`}>Dur {value}%</span>;
}

function formatBonus(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "+0.00";
  if (Math.abs(numeric) < 0.005) return "+0.00";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function durabilityBonusForSlot(slot) {
  if (slot?.durability_bonus !== undefined) return Number(slot.durability_bonus || 0);
  if (slot?.scored_points === undefined) return 0;
  const average = Number(slot.average_points || 0);
  const multiplier = Number(slot.lineup_multiplier ?? 1);
  return Number(slot.scored_points || 0) - average * multiplier;
}

function durabilityText(value) {
  if (value === null || value === undefined) return "Dur --";
  const numeric = Number(value || 100);
  return `Dur ${numeric}%`;
}

function lineupSlotIsPlayed(slot) {
  const status = lineupSlotStatus(slot);
  return !["bench", "benched", "treating", "treatment", "treated"].includes(status);
}

function lineupSlotIsTreatment(slot) {
  const status = lineupSlotStatus(slot);
  return ["treating", "treatment", "treated"].includes(status);
}

function StyledNewsBody({ body }) {
  const lines = String(body || "").split(/\r?\n/);
  const elements = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="my-3 list-disc space-y-1 pl-6 text-sm font-bold text-gray-700">
        {listItems.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    );
    listItems = [];
  };
  const cleanInline = (value) => value.replace(/\*\*/g, "").replace(/^[-*]\s+/, "").trim();
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={index} className="mt-5 text-base font-black uppercase text-black">{cleanInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={index} className="mt-6 text-lg font-black uppercase text-orange-600">{cleanInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={index} className="mt-2 text-xl font-black uppercase text-orange-600">{cleanInline(line.slice(2))}</h2>);
    } else if (/^[-*]\s+/.test(line)) {
      listItems.push(cleanInline(line));
    } else {
      flushList();
      elements.push(<p key={index} className="mt-3 text-sm font-bold leading-7 text-gray-700">{cleanInline(line)}</p>);
    }
  });
  flushList();
  return <div className="mt-2">{elements}</div>;
}

function newsSummary(item) {
  const summary = String(item?.summary || "").trim();
  if (summary) return summary;
  const body = String(item?.body || "").replace(/\s+/g, " ").trim();
  const match = body.match(/^(.{40,180}?[.!?])(\s|$)/);
  return (match?.[1] || body.slice(0, 160) || "Open the full story for details.").trim();
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

function hubTabPath(leagueId, tab) {
  return tab.path ? `/league/${tab.path}?id=${leagueId}` : `/league?id=${leagueId}`;
}

function managerTabPath(leagueId, managerId, tab) {
  return `/league/manager/${tab.path}?id=${leagueId}&managerId=${managerId}`;
}

function resolveHubTabId(routeSection, queryTab) {
  const routeValue = String(routeSection || "").toLowerCase();
  const byPath = HUB_TABS.find((tab) => tab.path === routeValue);
  if (byPath) return byPath.id;
  const byQuery = HUB_TABS.find((tab) => tab.id === queryTab);
  return byQuery?.id || "overview";
}

function resolveManagerTabId(routeSection) {
  const routeValue = String(routeSection || "").toLowerCase();
  return MANAGER_PORTAL_TABS.find((tab) => tab.path === routeValue || tab.id === routeValue)?.id || "lineup";
}

function LeagueNav({ league, currentMember, isCommissioner, activeArea, draftStatus }) {
  const draftIsCompleted = String(draftStatus || "").toUpperCase() === "COMPLETED";
  const draftHref = draftIsCompleted ? `/league/draft-recap?id=${league.id}` : `/league/draft?id=${league.id}`;
  const draftLabel = draftIsCompleted ? "Draft Recap" : "Draft Day";
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
          <Link to={`/league/manager/lineup?id=${league.id}&managerId=${currentMember.id}`}>
            <Button className={`neo-btn ${activeArea === "manager" ? "bg-[#00D9FF] text-black" : "bg-white text-black"}`}>
              <LayoutDashboard className="mr-2 h-5 w-5" />
              Manager Portal
            </Button>
          </Link>
        )}
        <Link to={draftHref}>
          <Button className="neo-btn bg-white text-black">
            <PenSquare className="mr-2 h-5 w-5" />
            {draftLabel}
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
            <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase text-black">{leagueStatusLabel(league, season)}</span>
            {context && <span className="text-xs font-black uppercase text-[#00D9FF]">{context}</span>}
          </div>
          <h1 className="mt-2 truncate text-2xl font-black uppercase text-orange-500 sm:text-3xl">{league.name}</h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px]">
          <StatTile label="Week" value={season?.current_week || 1} tone="bg-white" />
          <StatTile label="Teams" value={memberCount} tone="bg-[#D7F8E8]" />
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

function standingsWithResolvedRecords(standings, matchups, weekResults, league) {
  if (!weekResults.length) return standings;
  const recordByMember = new Map();
  const ensureRecord = (memberId) => {
    const key = String(memberId || "");
    if (!recordByMember.has(key)) {
      recordByMember.set(key, { wins: 0, losses: 0, ties: 0, points_against: 0 });
    }
    return recordByMember.get(key);
  };

  matchups.forEach((matchup) => {
    const homeResult = resultForMember(weekResults, matchup.home_member_id, matchup.week_number);
    const awayResult = resultForMember(weekResults, matchup.away_member_id, matchup.week_number);
    if (!homeResult || !awayResult) return;

    const home = ensureRecord(matchup.home_member_id);
    const away = ensureRecord(matchup.away_member_id);
    const homePoints = Number(homeResult.total_points || 0);
    const awayPoints = Number(awayResult.total_points || 0);
    home.points_against += awayPoints;
    away.points_against += homePoints;

    if (homePoints > awayPoints) {
      home.wins += 1;
      away.losses += 1;
    } else if (homePoints < awayPoints) {
      home.losses += 1;
      away.wins += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  });

  return standings
    .map((standing) => {
      const record = recordByMember.get(String(standing.league_member_id));
      if (!record) return { ...standing, wins: 0, losses: 0, ties: 0, points_against: 0 };
      return {
        ...standing,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        points_against: Number(record.points_against.toFixed(2)),
      };
    })
    .sort((a, b) =>
      Number(b.wins || 0) - Number(a.wins || 0) ||
      Number(b.ties || 0) - Number(a.ties || 0) ||
      (league?.ranking_system === "offl" ? Number(b.league_points || 0) - Number(a.league_points || 0) : 0) ||
      Number(b.points_for || 0) - Number(a.points_for || 0)
    );
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
              <th className="p-2 font-black uppercase">W-L-T</th>
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

function CommissionerMessagePanel({ league }) {
  const note = String(league.commissioner_message_of_day || league.commissioner_notes || league.notes || league.manager_message || "").trim();
  if (!note) return null;
  return (
    <Panel title="Commissioner Message" icon={MessageSquare}>
      <div className="neo-border bg-[#FFF7D6] p-4 font-bold leading-relaxed text-black">{note}</div>
    </Panel>
  );
}

function NewsPanel({ newsItems, auditEvents, season, leagueWeekData, leagueId, selectedNewsId }) {
  const { data: selectedNews = null, isLoading: isLoadingSelected, error: selectedError } = useQuery({
    queryKey: ["league-news-story", leagueId, selectedNewsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_news_items")
        .select("*")
        .eq("league_id", leagueId)
        .eq("id", selectedNewsId)
        .eq("status", "PUBLISHED")
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    enabled: Boolean(leagueId && selectedNewsId),
  });
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
  if (selectedNewsId) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="League News"
          icon={Newspaper}
          action={<Link className="text-sm font-black uppercase text-orange-600" to={`/league/news?id=${leagueId}`}>Back to Headlines</Link>}
        >
          {selectedError && <div className="neo-border mb-4 bg-red-50 p-3 text-sm font-bold text-red-700">{selectedError.message || "Unable to load story."}</div>}
          {isLoadingSelected ? (
            <p className="p-3 text-center font-bold">Loading story...</p>
          ) : selectedNews ? (
            <article>
              <p className="text-xs font-black uppercase text-gray-500">{formatDate(selectedNews.published_at || selectedNews.created_date)}</p>
              <h2 className="mt-1 text-2xl font-black uppercase text-orange-600">{selectedNews.title}</h2>
              {newsSummary(selectedNews) && <p className="mt-2 text-sm font-black uppercase text-gray-500">{newsSummary(selectedNews)}</p>}
              <StyledNewsBody body={selectedNews.body} />
            </article>
          ) : (
            <EmptyState title="Story not found" detail="This news item is unavailable or has been archived." />
          )}
        </Panel>
        <ReleasedPlayersPanel leagueId={leagueId} />
      </div>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {items.map((item) => (
          <Link key={item.id} to={item.id === "week-status" ? `/league/news?id=${leagueId}` : `/league/news?id=${leagueId}&newsId=${item.id}`} className="neo-border block bg-white p-4 hover:bg-[#FFF7D6]">
            <p className="text-xs font-black uppercase text-gray-500">{formatDate(item.published_at || item.created_date)}</p>
            <h2 className="mt-1 text-xl font-black uppercase text-orange-600">{item.title}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-gray-700">{newsSummary(item)}</p>
          </Link>
        ))}
      </div>
      <ReleasedPlayersPanel leagueId={leagueId} />
    </div>
  );
}

function PlayerLeaderboardPanel({ leagueId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["league-player-leaderboard", leagueId],
    queryFn: async () => {
      const rows = await appClient.entities.LeaguePlayerLeaderboard.filter({ league_id: leagueId });
      return rows[0] || await appClient.functions.invoke("get_player_leaderboard", { league_id: leagueId });
    },
    enabled: Boolean(leagueId),
  });
  const leadersByPosition = data?.leaders || {};
  return (
    <Panel title="Player Leaders" icon={BarChart3}>
      {error && <div className="neo-border mb-4 bg-red-50 p-3 text-sm font-bold text-red-700">{error.message || "Unable to load player leaders."}</div>}
      {isLoading ? (
        <p className="p-3 text-center font-bold">Loading player leaders...</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {FREE_AGENT_POSITIONS.map((position) => {
            const rows = leadersByPosition[position] || [];
            return (
              <div key={position} className="neo-border bg-gray-50">
                <div className="border-b-4 border-black bg-black p-3 text-white">
                  <p className="text-center text-lg font-black uppercase">{position}</p>
                </div>
                <div className="divide-y-2 divide-black/10">
                  <div className="hidden grid-cols-[minmax(150px,1fr)_68px_76px_56px_48px_78px] gap-2 bg-white px-3 py-2 text-[10px] font-black uppercase text-gray-500 sm:grid">
                    <span>Player</span>
                    <span className="text-center">Tier</span>
                    <span className="text-center">Durability</span>
                    <span className="text-center">Starts</span>
                    <span className="text-center">GP</span>
                    <span className="text-right">Points</span>
                  </div>
                  {rows.map((row, index) => (
                    <Link
                      key={row.player_id}
                      to={createPageUrl(`PlayerStats?id=${row.player_id}`)}
                      className="block p-3 text-sm font-bold hover:bg-[#FFF7D6] sm:grid sm:grid-cols-[minmax(150px,1fr)_68px_76px_56px_48px_78px] sm:items-center sm:gap-2"
                    >
                      <span className="min-w-0">
                        <span className="font-black">{index + 1}</span>
                        <span className="break-words"> - {row.player_name}</span>
                        <span className="mt-1 block text-xs font-black uppercase text-gray-500">{row.fantasy_team_owner || "FA"}</span>
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-3 sm:mt-0 sm:block sm:text-center">
                        <span className="text-[10px] font-black uppercase text-gray-500 sm:hidden">Tier</span>
                        <span className="font-black">T{row.tier_value || "--"}</span>
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:block sm:text-center">
                        <span className="text-[10px] font-black uppercase text-gray-500 sm:hidden">Durability</span>
                        <span className="font-black">{durabilityText(row.durability)}</span>
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:block sm:text-center">
                        <span className="text-[10px] font-black uppercase text-gray-500 sm:hidden">Starts</span>
                        <span className="font-black">{row.starts || 0}</span>
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:block sm:text-center">
                        <span className="text-[10px] font-black uppercase text-gray-500 sm:hidden">GP</span>
                        <span className="font-black">{row.games_played || 0}</span>
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:block sm:text-right">
                        <span className="text-[10px] font-black uppercase text-gray-500 sm:hidden">Points</span>
                        <span className="font-black">{formatNumber(row.total_points, 2)}</span>
                      </span>
                    </Link>
                  ))}
                  {!rows.length && <p className="p-3 text-center text-sm font-bold text-gray-500">No leaders yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
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
  const queryClient = useQueryClient();
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTiers, setSelectedTiers] = useState(new Set(FREE_AGENT_TIERS));
  const [appliedFilters, setAppliedFilters] = useState(null);
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
    if (!appliedFilters) return grouped;
    const filterPosition = String(appliedFilters.position || "ALL").toUpperCase();
    const filterTiers = appliedFilters.tiers || new Set();
    const searchTerm = String(appliedFilters.search || "").trim().toLowerCase();
    tiers
      .forEach((tier) => {
        const bucket = draftBucket(tier.position);
        if (!grouped[bucket]) return;
        if (filterPosition !== "ALL" && bucket !== filterPosition) return;
        if (!filterTiers.has(Number(tier.tier_value || 1))) return;
        const player = playerById.get(tier.player_id);
        if (!player) return;
        const searchable = `${player.player_display_name || ""} ${player.full_name || ""} ${player.team || ""}`.toLowerCase();
        if (searchTerm && !searchable.includes(searchTerm)) return;
        grouped[bucket].push({ tier, player });
      });
    for (const position of FREE_AGENT_POSITIONS) {
      grouped[position] = grouped[position]
        .sort((a, b) => Number(a.tier.position_rank || 999) - Number(b.tier.position_rank || 999))
        .slice(0, 30);
    }
    return grouped;
  }, [appliedFilters, playerById, tiers]);
  const visibleCount = FREE_AGENT_POSITIONS.reduce((sum, position) => sum + rowsByPosition[position].length, 0);
  const visiblePositions = appliedFilters?.position && appliedFilters.position !== "ALL" ? [appliedFilters.position] : FREE_AGENT_POSITIONS;
  const toggleTier = (tierValue) => {
    setSelectedTiers((current) => {
      const next = new Set(current);
      if (next.has(tierValue)) next.delete(tierValue);
      else next.add(tierValue);
      return next;
    });
  };
  const runSearch = () => {
    setAppliedFilters({
      position: positionFilter,
      tiers: new Set(selectedTiers),
      search: searchInput,
    });
  };
  const claimMutation = useMutation({
    mutationFn: async ({ player, tier }) => {
      if (!currentMember?.id) throw new Error("Manager membership is required.");
      const { count, error: countError } = await supabase
        .from("roster_slots")
        .select("id", { count: "exact", head: true })
        .eq("league_member_id", currentMember.id);
      if (countError) throw countError;
      if (Number(count || 0) >= rosterCapacity(league)) {
        throw new Error("Roster is full. Drop a player before adding a free agent.");
      }
      const { error } = await supabase.from("roster_slots").insert({
        league_member_id: currentMember.id,
        player_id: player.id,
        slot_type: tier.position || player.position || "OFF",
        week_number: null,
      });
      if (error) throw error;
      return player;
    },
    onSuccess: (player) => {
      toast.success(`${playerDisplayName(player)} added to roster.`);
      queryClient.invalidateQueries({ queryKey: ["free-agent-draft-tiers", league.id, currentMember?.id] });
      queryClient.invalidateQueries({ queryKey: ["manager-roster", currentMember?.id] });
    },
    onError: (error) => toast.error(error.message || "Could not add free agent."),
  });
  return (
    <Panel title="Free Agent Board" icon={Shuffle}>
      <div className="neo-border mb-4 bg-[#EFFBFF] p-3">
        <div className="grid gap-3 lg:grid-cols-[180px_minmax(220px,1fr)_1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-gray-600">Position</span>
            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
              className="neo-border h-10 w-full bg-white px-3 text-sm font-black uppercase text-black"
            >
              <option value="ALL">All Positions</option>
              {FREE_AGENT_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-gray-600">Player Search</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name or team"
              className="neo-border h-10 w-full bg-white px-3 text-sm font-bold text-black"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-black uppercase text-gray-600">Tiers</span>
            <div className="flex flex-wrap gap-2">
              {FREE_AGENT_TIERS.map((tierValue) => (
                <label key={tierValue} className={`neo-border inline-flex h-10 items-center gap-2 bg-white px-3 text-xs font-black uppercase ${selectedTiers.has(tierValue) ? "text-black" : "text-gray-400"}`}>
                  <input
                    type="checkbox"
                    checked={selectedTiers.has(tierValue)}
                    onChange={() => toggleTier(tierValue)}
                    className="h-4 w-4 accent-black"
                  />
                  T{tierValue}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={runSearch} disabled={!selectedTiers.size} className="neo-btn h-10 bg-[#F7B801] px-5 text-black">
            Search
          </Button>
        </div>
      </div>
      {!appliedFilters ? (
        <EmptyState title="Search free agents" detail="Choose a position, tier range, or player name to display available players." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
        {visiblePositions.map((position) => (
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
                        <div key={player.id} className="neo-border bg-white p-2 text-sm font-bold">
                          <Link to={createPageUrl(`PlayerStats?id=${player.id}`)} className="block hover:underline">
                            <span className="font-black">{player.player_display_name || player.full_name}</span>
                            <span className="text-gray-500"> | {player.team || "FA"}</span>
                            <span className="sr-only"> Rank {tier.position_rank}</span>
                          </Link>
                          {currentMember?.id && (
                            <Button
                              onClick={() => claimMutation.mutate({ player, tier })}
                              disabled={claimMutation.isPending}
                              className="neo-btn mt-2 h-8 w-full bg-[#00D9FF] px-2 text-[11px] text-black"
                            >
                              Add
                            </Button>
                          )}
                        </div>
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
      )}
      {appliedFilters && !visibleCount && <EmptyState title="No free agents found" detail="Try another position, tier, or player search." />}
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

function FullSchedulePanel({ league, schedule, matchups, weekResults, members, standings, isLoadingStandings }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const weeks = schedule.length
    ? schedule
    : [...new Set(matchups.map((matchup) => Number(matchup.week_number || 0)).filter(Boolean))].map((weekNumber) => ({ id: `week-${weekNumber}`, week_number: weekNumber }));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <Panel title="Full Schedule" icon={CalendarDays}>
        <div className="space-y-4">
          {weeks.map((week) => {
            const weekNumber = Number(week.week_number);
            const weekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === weekNumber);
            return (
              <div key={week.id || weekNumber} className="neo-border bg-gray-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link to={`/league/week/${weekNumber}?id=${league.id}`} className="font-black uppercase text-orange-600">Week {weekNumber}</Link>
                    <p className="text-xs font-bold uppercase text-gray-500">{formatDate(week.scheduled_at)} | {week.status || "Scheduled"}</p>
                  </div>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {weekMatchups.map((matchup) => {
                    const homeResult = weekResults.find((result) => result.league_member_id === matchup.home_member_id && Number(result.week_number) === weekNumber);
                    const awayResult = weekResults.find((result) => result.league_member_id === matchup.away_member_id && Number(result.week_number) === weekNumber);
                    return (
                      <Link key={matchup.id} to={`/league/week/${weekNumber}?id=${league.id}&matchId=${matchup.id}`} className="neo-border bg-white p-3 font-bold hover:bg-[#FFF7D6]">
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
      <StandingsPanel league={league} standings={standings} members={members} isLoading={isLoadingStandings} compact />
    </div>
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
    selectedNewsId,
  } = props;
  const currentWeek = season?.current_week || 1;
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {HUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link key={tab.id} to={hubTabPath(league.id, tab)} className={`neo-border inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-black uppercase ${activeTab === tab.id ? "bg-[#F7B801] text-black" : "bg-white text-black"}`}>
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
      {activeTab === "news" && <NewsPanel newsItems={newsItems} auditEvents={auditEvents} season={season} leagueWeekData={leagueWeekData} leagueId={league.id} selectedNewsId={selectedNewsId} />}
      {activeTab === "player-leaders" && <PlayerLeaderboardPanel leagueId={league.id} />}
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
      {activeTab === "schedule" && <FullSchedulePanel league={league} schedule={schedule} matchups={matchups} weekResults={weekResults} members={members} standings={standings} isLoadingStandings={isLoadingStandings} />}
    </>
  );
}

function resultForMember(weekResults, memberId, weekNumber) {
  return weekResults.find((result) => result.league_member_id === memberId && Number(result.week_number) === Number(weekNumber));
}

function WeekMatchupsPage({ league, season, currentMember, members, matchups, weekResults, schedule, weekNumber, standings, isLoadingStandings }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const weekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === Number(weekNumber));
  const weekSchedule = schedule.find((item) => Number(item.week_number) === Number(weekNumber));
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={currentMember} memberCount={members.length} context={`Week ${weekNumber}`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel title={`Week ${weekNumber}`} icon={CalendarDays} action={<Link className="text-sm font-black uppercase text-orange-600" to={`/league/schedule?id=${league.id}`}>Schedule</Link>}>
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
        <StandingsPanel league={league} standings={standings} members={members} isLoading={isLoadingStandings} compact />
      </div>
    </>
  );
}

function TeamScoringDetail({ title, result, lineup, playerById, tierByPlayer, durabilityByPlayer }) {
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
                  const tier = tierByPlayer.get(slot.player_id);
                  const durability = durabilityByPlayer.get(slot.player_id);
                  const samples = normalizeSlots(slot.source_week_values);
                  const durabilityBonus = durabilityBonusForSlot(slot);
                  return (
                    <div key={`${slot.player_id}-${index}`} className="neo-border bg-gray-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">{playerDisplayName(player, slot.player_name || slot.player_display_name || slot.full_name || slot.player_id)}</p>
                          <p className="text-xs font-bold uppercase text-gray-500">{player?.position || slot.slot || "--"} | {player?.team || "FA"} | {lineupSlotStatus(slot)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <TierBadge tier={slot.tier_value ?? tier?.tier_value} />
                            <DurabilityBadge durability={slot.durability ?? durability?.durability} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-right sm:min-w-[160px]">
                          <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">+Bonus</p>
                            <p className={`font-black ${durabilityBonus < 0 ? "text-red-600" : "text-green-700"}`}>{formatBonus(durabilityBonus)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Total</p>
                            <p className="text-lg font-black">{formatNumber(slot.scored_points, 2)}</p>
                          </div>
                        </div>
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

function MatchupDetailPage({ league, season, currentMember, members, matchups, weekResults, lineups, players, tiers, durabilityRows, weekNumber, matchId }) {
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const tierByPlayer = useMemo(() => new Map(tiers.map((row) => [row.player_id, row])), [tiers]);
  const durabilityByPlayer = useMemo(() => new Map(durabilityRows.map((row) => [row.player_id, row])), [durabilityRows]);
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
        <TeamScoringDetail title={memberName(home)} result={homeResult} lineup={homeLineup} playerById={playerById} tierByPlayer={tierByPlayer} durabilityByPlayer={durabilityByPlayer} />
        <TeamScoringDetail title={memberName(away)} result={awayResult} lineup={awayLineup} playerById={playerById} tierByPlayer={tierByPlayer} durabilityByPlayer={durabilityByPlayer} />
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

const REQUIRED_LINEUP_COUNTS = { QB: 1, K: 1, FLEX_DEF_OFF: 3 };

function LineupRequirementBadge({ label, value, target, valid }) {
  const Icon = valid ? CheckCircle : XCircle;
  return (
    <span className={`neo-border flex items-center justify-between gap-2 px-2 py-1 ${valid ? "bg-[#D7F8E8] text-black" : "bg-red-100 text-red-800"}`}>
      <span>{label} {target ? `${value}/${target}` : value}</span>
      <Icon className="h-4 w-4 shrink-0" />
    </span>
  );
}

function LineupPositionHeaderStatus({ position, selectedCounts, flexPositionsAreValid, qbIsValid, kickerIsValid }) {
  const rules = {
    QB: { value: selectedCounts.QB, target: "1", valid: qbIsValid },
    OFF: { value: selectedCounts.OFF, target: "1-2", valid: flexPositionsAreValid },
    DEF: { value: selectedCounts.DEF, target: "1-2", valid: flexPositionsAreValid },
    K: { value: selectedCounts.K, target: "1", valid: kickerIsValid },
  };
  const rule = rules[position] || { value: 0, target: "--", valid: false };
  const Icon = rule.valid ? CheckCircle : XCircle;
  return (
    <span className={`neo-border inline-flex items-center gap-1 bg-white px-2 py-1 text-[11px] font-black uppercase ${rule.valid ? "text-green-700" : "text-red-700"}`}>
      <Icon className="h-4 w-4" />
      {rule.value}/{rule.target}
    </span>
  );
}

function ManagerLineupPanel({ league, lineupWeek, manager, scheduleReady, weekResults }) {
  const queryClient = useQueryClient();
  const { data: lineup } = useLineup(league.id, lineupWeek, manager.id);
  const { data: roster = [] } = useQuery({
    queryKey: ["manager-roster", manager.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_slots")
        .select("*, players(id,full_name,player_display_name,position,team)")
        .eq("league_member_id", manager.id);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(manager.id),
  });
  const rosterPlayerIdsKey = roster.map((slot) => slot.player_id).filter(Boolean).join(":");
  const { data: players = [] } = useQuery({
    queryKey: ["manager-roster-players", manager.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      return appClient.entities.Player.filter({ id: playerIds });
    },
    enabled: Boolean(roster.length),
  });
  const { data: tierRows = [] } = useQuery({
    queryKey: ["manager-roster-tiers", league.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from("league_player_draft_tiers")
        .select("player_id,tier_value,position,position_rank")
        .eq("league_id", league.id)
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(league.id && roster.length),
  });
  const { data: durabilityRows = [] } = useQuery({
    queryKey: ["manager-roster-durability", league.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from("league_player_durability")
        .select("player_id,durability,initial_durability")
        .eq("league_id", league.id)
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(league.id && roster.length),
  });
  const { data: usageRows = [] } = useQuery({
    queryKey: ["manager-roster-usage", league.id, manager.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from("manager_player_usage")
        .select("player_id,usage_count,last_used_week")
        .eq("league_id", league.id)
        .eq("league_member_id", manager.id)
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(league.id && manager.id && roster.length),
  });
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const tierByPlayer = useMemo(() => new Map(tierRows.map((row) => [row.player_id, row])), [tierRows]);
  const durabilityByPlayer = useMemo(() => new Map(durabilityRows.map((row) => [row.player_id, row])), [durabilityRows]);
  const usageByPlayer = useMemo(() => new Map(usageRows.map((row) => [row.player_id, row])), [usageRows]);
  const treatmentEligibility = useMemo(() => {
    const eligibility = new Map();
    roster.forEach((slot) => {
      const durability = durabilityByPlayer.get(slot.player_id);
      const currentDurability = Number(durability?.durability ?? 100);
      const usageCount = Number(usageByPlayer.get(slot.player_id)?.usage_count || 0);
      const lastUsedWeek = Number(usageByPlayer.get(slot.player_id)?.last_used_week || 0);
      eligibility.set(slot.player_id, currentDurability < 100 && usageCount >= 1 && lastUsedWeek > 0 && lastUsedWeek < Number(lineupWeek));
    });
    return eligibility;
  }, [durabilityByPlayer, lineupWeek, roster, usageByPlayer]);
  const scoredPointsByPlayer = useMemo(() => {
    const totals = new Map();
    weekResults
      .filter((result) => result.league_member_id === manager.id)
      .forEach((result) => {
        (result.scoring_details || result.lineup_slots || result.slots || []).forEach((slot) => {
          const playerId = slot.player_id;
          if (!playerId) return;
          totals.set(playerId, Number(totals.get(playerId) || 0) + Number(slot.scored_points || 0));
        });
      });
    return totals;
  }, [manager.id, weekResults]);
  const rosterByPosition = useMemo(() => {
    const groups = { QB: [], OFF: [], DEF: [], K: [] };
    roster.forEach((slot) => {
      const player = rosterSlotPlayer(slot, playerById);
      const tier = tierByPlayer.get(slot.player_id);
      const bucket = draftBucket(tier?.position || player?.position || slot.slot_type);
      groups[bucket].push(slot);
    });
    return groups;
  }, [playerById, roster, tierByPlayer]);
  const initialStatusByPlayer = useMemo(() => {
    const statuses = {};
    roster.forEach((slot) => {
      statuses[slot.player_id] = "bench";
    });
    normalizeSlots(lineup?.slots).forEach((slot) => {
      if (!slot.player_id) return;
      statuses[slot.player_id] = lineupSlotIsTreatment(slot) ? "treatment" : lineupSlotIsPlayed(slot) ? "active" : "bench";
    });
    return statuses;
  }, [lineup?.slots, roster]);
  const [statusByPlayer, setStatusByPlayer] = useState(initialStatusByPlayer);
  useEffect(() => setStatusByPlayer(initialStatusByPlayer), [initialStatusByPlayer]);
  const [gamePlanType, setGamePlanType] = useState(lineup?.game_plan_type || lineup?.game_plan?.type || "balanced");
  useEffect(() => setGamePlanType(lineup?.game_plan_type || lineup?.game_plan?.type || "balanced"), [lineup?.game_plan, lineup?.game_plan_type]);
  const selectedIds = useMemo(() => {
    return new Set(Object.entries(statusByPlayer).filter(([, status]) => status === "active").map(([playerId]) => playerId));
  }, [statusByPlayer]);
  const treatmentIds = useMemo(() => {
    return new Set(Object.entries(statusByPlayer).filter(([, status]) => status === "treatment").map(([playerId]) => playerId));
  }, [statusByPlayer]);
  const treatmentCount = treatmentIds.size;
  const treatmentSelectionIsEligible = [...treatmentIds].every((playerId) => treatmentEligibility.get(playerId));
  const treatmentIsValid = treatmentCount <= 1 && treatmentSelectionIsEligible;
  const nextStatus = (currentStatus, playerId) => {
    if (currentStatus === "bench") return "active";
    if (currentStatus === "active" && treatmentEligibility.get(playerId)) return "treatment";
    return "bench";
  };
  const statusLabel = (status) => {
    if (status === "active") return "Played";
    if (status === "treatment") return "Treatment";
    return "Benched";
  };

  const selectedCounts = useMemo(() => {
    const counts = { QB: 0, OFF: 0, DEF: 0, K: 0 };
    roster.forEach((slot) => {
      if (!selectedIds.has(slot.player_id)) return;
      const player = rosterSlotPlayer(slot, playerById);
      const tier = tierByPlayer.get(slot.player_id);
      const bucket = draftBucket(tier?.position || player?.position || slot.slot_type);
      counts[bucket] += 1;
    });
    return counts;
  }, [playerById, roster, selectedIds, tierByPlayer]);
  const offDefTotal = Number(selectedCounts.OFF || 0) + Number(selectedCounts.DEF || 0);
  const qbIsValid = Number(selectedCounts.QB || 0) === 1;
  const kickerIsValid = Number(selectedCounts.K || 0) === 1;
  const flexPositionsAreValid = offDefTotal === 3 &&
    Number(selectedCounts.OFF || 0) >= 1 &&
    Number(selectedCounts.OFF || 0) <= 2 &&
    Number(selectedCounts.DEF || 0) >= 1 &&
    Number(selectedCounts.DEF || 0) <= 2;
  const lineupIsValid = qbIsValid &&
    kickerIsValid &&
    flexPositionsAreValid &&
    treatmentIsValid;
  const lineupRequirementText = "Need 1 QB, 1 K, and either 2 OFF/1 DEF or 1 OFF/2 DEF";
  const finalizeDisabledReason = !scheduleReady
    ? "Schedule must be created first."
    : !lineupIsValid
      ? treatmentCount > 1
        ? "Only one player can be in treatment each week."
        : !treatmentSelectionIsEligible
          ? "Treatment requires prior starter use and durability loss."
          : lineupRequirementText
      : "";

  const finalizeLineupMutation = useMutation({
    mutationFn: () => {
      const slots = roster
        .map((slot) => ({
          slot: slot.slot_type || rosterSlotPlayer(slot, playerById)?.position || "FLEX",
          player_id: slot.player_id,
          status: statusByPlayer[slot.player_id] || "bench",
        }));
      return appClient.functions.invoke("finalize_lineup", {
        league_id: league.id,
        league_member_id: manager.id,
        week_number: lineupWeek,
        slots,
        game_plan_type: gamePlanType,
        game_plan: { type: gamePlanType },
      });
    },
    onSuccess: () => {
      toast.success("Lineup finalized.");
      queryClient.invalidateQueries({ queryKey: ["lineup", league.id, lineupWeek, manager.id] });
    },
    onError: (error) => toast.error(error.message || "Failed to finalize lineup."),
  });

  const togglePlayer = (playerId) => {
    if ((statusByPlayer[playerId] || "bench") === "active" && !treatmentEligibility.get(playerId)) {
      toast.error("Treatment requires prior starter use and durability loss.");
      setStatusByPlayer((current) => ({ ...current, [playerId]: "bench" }));
      return;
    }
    setStatusByPlayer((current) => {
      const currentStatus = current[playerId] || "bench";
      return { ...current, [playerId]: nextStatus(currentStatus, playerId) };
    });
  };

  return (
    <Panel
      title={`Set Lineup: Week ${lineupWeek}`}
      icon={ClipboardList}
      action={(
        <Button onClick={() => finalizeLineupMutation.mutate()} disabled={finalizeLineupMutation.isPending || !roster.length || Boolean(finalizeDisabledReason)} className="neo-btn bg-[#FF6B35] text-white" title={finalizeDisabledReason || "Finalize lineup"}>
          <Save className="mr-2 h-5 w-5" />
          {finalizeLineupMutation.isPending ? "Saving..." : "Finalize"}
        </Button>
      )}
    >
      <div className="neo-border mb-4 grid gap-2 bg-[#EFFBFF] p-3 text-xs font-black uppercase text-black sm:grid-cols-6">
        <LineupRequirementBadge label="QB" value={selectedCounts.QB} target="1" valid={qbIsValid} />
        <LineupRequirementBadge label="K" value={selectedCounts.K} target="1" valid={kickerIsValid} />
        <LineupRequirementBadge label="OFF" value={selectedCounts.OFF} target="1-2" valid={flexPositionsAreValid} />
        <LineupRequirementBadge label="DEF" value={selectedCounts.DEF} target="1-2" valid={flexPositionsAreValid} />
        <LineupRequirementBadge label="Treatment" value={treatmentCount} target="0-1" valid={treatmentIsValid} />
        <LineupRequirementBadge label="Schedule" value={scheduleReady ? "Ready" : "Missing"} valid={scheduleReady} />
      </div>
      <div className="neo-border mb-4 grid gap-3 bg-white p-3 md:grid-cols-[180px_1fr] md:items-center">
        <label className="text-xs font-black uppercase text-gray-500" htmlFor={`game-plan-${manager.id}-${lineupWeek}`}>Game Plan</label>
        <select
          id={`game-plan-${manager.id}-${lineupWeek}`}
          value={gamePlanType}
          onChange={(event) => setGamePlanType(event.target.value)}
          className="neo-border h-10 bg-white px-3 text-sm font-black uppercase text-black"
        >
          {GAME_PLAN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {finalizeDisabledReason && <p className="mb-4 text-xs font-black uppercase text-red-600">{finalizeDisabledReason}</p>}
      <div className="neo-border overflow-hidden bg-white">
        <div className="hidden grid-cols-[110px_minmax(220px,1fr)_120px_120px_110px_110px] gap-3 border-b-4 border-black bg-gray-50 p-3 text-xs font-black uppercase text-gray-500 lg:grid">
          <span>Status</span>
          <span>Player</span>
          <span>Position</span>
          <span>Tier</span>
          <span>Durability</span>
          <span className="text-right">Points</span>
        </div>
        {["QB", "OFF", "DEF", "K"].map((position) => (
            <div key={position}>
              <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2 text-white">
                <h3 className="text-sm font-black uppercase text-white">{position}</h3>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <LineupPositionHeaderStatus
                    position={position}
                    selectedCounts={selectedCounts}
                    flexPositionsAreValid={flexPositionsAreValid}
                    qbIsValid={qbIsValid}
                    kickerIsValid={kickerIsValid}
                  />
                  <span className="text-[11px] font-black uppercase">{selectedCounts[position]} played | {rosterByPosition[position].length} rostered</span>
                </div>
              </div>
            {rosterByPosition[position].map((slot) => {
              const player = rosterSlotPlayer(slot, playerById);
              const tier = tierByPlayer.get(slot.player_id);
              const selected = selectedIds.has(slot.player_id);
              const treating = treatmentIds.has(slot.player_id);
              const status = statusByPlayer[slot.player_id] || "bench";
              const durability = durabilityByPlayer.get(slot.player_id);
              const treatmentEligible = treatmentEligibility.get(slot.player_id);
              return (
                <button key={slot.id} type="button" onClick={() => togglePlayer(slot.player_id)} title={selected && !treatmentEligible ? "Next click will bench this player. Treatment requires prior starter use and durability loss." : undefined} className={`grid w-full gap-3 border-b-2 border-black/10 p-3 text-left transition-colors lg:grid-cols-[110px_minmax(220px,1fr)_120px_120px_110px_110px] lg:items-center ${selected ? "bg-[#D7F8E8]" : treating ? "bg-[#EFFBFF]" : "bg-white hover:bg-gray-50"}`}>
                  <span className={`neo-border inline-flex w-fit items-center gap-2 px-2 py-1 text-[11px] font-black uppercase ${selected ? "bg-[#F7B801] text-black" : treating ? "bg-[#00D9FF] text-black" : "bg-gray-200 text-black"}`}>
                    {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    {statusLabel(status)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-black">{playerDisplayName(player, "Roster Player")}</span>
                    <span className="block text-xs font-bold text-gray-500">{playerTeamText(player)}</span>
                  </span>
                  <span className="text-xs font-black uppercase text-gray-600">{tier?.position || player?.position || slot.slot_type}</span>
                  <span><TierBadge tier={tier?.tier_value} /></span>
                  <span className="flex flex-wrap gap-2">
                    <DurabilityBadge durability={durability?.durability} />
                    {treatmentEligible && <span className="neo-border bg-[#EFFBFF] px-2 py-1 text-[11px] font-black uppercase text-black">Treat OK</span>}
                  </span>
                  <span className="font-black lg:text-right">{formatNumber(scoredPointsByPlayer.get(slot.player_id), 2)}</span>
                </button>
              );
            })}
            {!rosterByPosition[position].length && (
              <div className="border-b-2 border-black/10 p-3 text-xs font-bold uppercase text-gray-400">No {position} players rostered.</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="neo-border bg-white p-3">
          <p className="text-xs font-black uppercase text-gray-500">Played</p>
          <p className="text-2xl font-black text-black">{selectedIds.size}</p>
        </div>
        <div className="neo-border bg-white p-3">
          <p className="text-xs font-black uppercase text-gray-500">Benched</p>
          <p className="text-2xl font-black text-black">{Math.max(0, roster.length - selectedIds.size - treatmentCount)}</p>
        </div>
        <div className="neo-border bg-white p-3 sm:col-span-2">
          <p className="text-xs font-black uppercase text-gray-500">Treatment</p>
          <p className="text-2xl font-black text-black">{treatmentCount}</p>
        </div>
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

function ManagerRosterPanel({ league, manager, weekResults }) {
  const queryClient = useQueryClient();
  const { data: roster = [] } = useQuery({
    queryKey: ["manager-roster", manager.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_slots")
        .select("*, players(id,full_name,player_display_name,position,team)")
        .eq("league_member_id", manager.id);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(manager.id),
  });
  const rosterPlayerIdsKey = roster.map((slot) => slot.player_id).filter(Boolean).join(":");
  const { data: tierRows = [] } = useQuery({
    queryKey: ["manager-roster-tiers", league.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from("league_player_draft_tiers")
        .select("player_id,tier_value,position,position_rank")
        .eq("league_id", league.id)
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(league.id && roster.length),
  });
  const { data: durabilityRows = [] } = useQuery({
    queryKey: ["manager-roster-durability", league.id, rosterPlayerIdsKey],
    queryFn: async () => {
      const playerIds = [...new Set(roster.map((slot) => slot.player_id).filter(Boolean))];
      if (!playerIds.length) return [];
      const { data, error } = await supabase
        .from("league_player_durability")
        .select("player_id,durability")
        .eq("league_id", league.id)
        .in("player_id", playerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(league.id && roster.length),
  });
  const tierByPlayer = useMemo(() => new Map(tierRows.map((row) => [row.player_id, row])), [tierRows]);
  const durabilityByPlayer = useMemo(() => new Map(durabilityRows.map((row) => [row.player_id, row.durability])), [durabilityRows]);
  const scoredPointsByPlayer = useMemo(() => {
    const totals = new Map();
    weekResults
      .filter((result) => result.league_member_id === manager.id)
      .forEach((result) => {
        (result.scoring_details || result.lineup_slots || result.slots || []).forEach((slot) => {
          const playerId = slot.player_id;
          if (!playerId) return;
          totals.set(playerId, Number(totals.get(playerId) || 0) + Number(slot.scored_points || 0));
        });
      });
    return totals;
  }, [manager.id, weekResults]);
  const rosterByPosition = useMemo(() => {
    const groups = { QB: [], OFF: [], DEF: [], K: [] };
    roster.forEach((slot) => {
      const player = rosterSlotPlayer(slot, new Map());
      const tier = tierByPlayer.get(slot.player_id);
      const bucket = draftBucket(tier?.position || player?.position || slot.slot_type);
      groups[bucket].push(slot);
    });
    return groups;
  }, [roster, tierByPlayer]);
  const dropMutation = useMutation({
    mutationFn: async (slot) => {
      const { error } = await supabase
        .from("roster_slots")
        .delete()
        .eq("id", slot.id)
        .eq("league_member_id", manager.id);
      if (error) throw error;
      return slot;
    },
    onSuccess: (slot) => {
      const player = rosterSlotPlayer(slot, new Map());
      toast.success(`${playerDisplayName(player, "Player")} dropped.`);
      queryClient.invalidateQueries({ queryKey: ["manager-roster", manager.id] });
      queryClient.invalidateQueries({ queryKey: ["free-agent-draft-tiers", league.id, manager.id] });
    },
    onError: (error) => toast.error(error.message || "Could not drop player."),
  });

  return (
    <Panel title="Manage Roster" icon={Users}>
      <div className="neo-border mb-4 grid gap-3 bg-[#EFFBFF] p-3 text-xs font-black uppercase text-black sm:grid-cols-3">
        <span className="neo-border bg-white px-2 py-1">Roster {roster.length}/{rosterCapacity(league)}</span>
        <span className="neo-border bg-white px-2 py-1">Used Points {formatNumber([...scoredPointsByPlayer.values()].reduce((sum, value) => sum + Number(value || 0), 0), 2)}</span>
        <span className="neo-border bg-white px-2 py-1">Open Slots {Math.max(0, rosterCapacity(league) - roster.length)}</span>
      </div>
      <div className="neo-border overflow-hidden bg-white">
        <div className="hidden grid-cols-[minmax(220px,1fr)_100px_100px_120px_110px_110px] gap-3 border-b-4 border-black bg-gray-50 p-3 text-xs font-black uppercase text-gray-500 lg:grid">
          <span>Player</span>
          <span>Position</span>
          <span>Tier</span>
          <span>Durability</span>
          <span className="text-right">Points</span>
          <span className="text-right">Action</span>
        </div>
        {FREE_AGENT_POSITIONS.map((position) => (
          <div key={position}>
            <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2 text-white">
              <h3 className="text-sm font-black uppercase">{position}</h3>
              <span className="text-[11px] font-black uppercase">{rosterByPosition[position].length} players</span>
            </div>
            {rosterByPosition[position].map((slot) => {
              const player = rosterSlotPlayer(slot, new Map());
              const tier = tierByPlayer.get(slot.player_id);
              return (
                <div key={slot.id} className="grid gap-3 border-b-2 border-black/10 p-3 lg:grid-cols-[minmax(220px,1fr)_100px_100px_120px_110px_110px] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-black">{playerDisplayName(player, "Roster Player")}</p>
                    <p className="text-xs font-bold text-gray-500">{playerTeamText(player)}</p>
                  </div>
                  <span className="text-xs font-black uppercase text-gray-600">{tier?.position || player?.position || slot.slot_type}</span>
                  <span><TierBadge tier={tier?.tier_value} /></span>
                  <span><DurabilityBadge durability={durabilityByPlayer.get(slot.player_id)} /></span>
                  <span className="font-black lg:text-right">{formatNumber(scoredPointsByPlayer.get(slot.player_id), 2)}</span>
                  <span className="lg:text-right">
                    <Button onClick={() => dropMutation.mutate(slot)} disabled={dropMutation.isPending} className="neo-btn h-8 bg-red-500 px-3 text-xs text-white">Drop</Button>
                  </span>
                </div>
              );
            })}
            {!rosterByPosition[position].length && <div className="border-b-2 border-black/10 p-3 text-xs font-bold uppercase text-gray-400">No {position} players rostered.</div>}
          </div>
        ))}
      </div>
      {!roster.length && <EmptyState title="No roster yet" detail="Use the Free Agent Board to add players after roster setup opens." />}
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

function ManagerPortalPage({ league, season, manager, members, matchups, weekResults, messages, activeTab, standings, isLoadingStandings }) {
  const currentWeek = season?.current_week || 1;
  const nextMatchup = matchups
    .filter((item) => item.home_member_id === manager.id || item.away_member_id === manager.id)
    .sort((a, b) => Number(a.week_number || 0) - Number(b.week_number || 0))
    .find((item) => Number(item.week_number) >= Number(currentWeek) && !resultForMember(weekResults, manager.id, item.week_number));
  const lineupWeek = Number(nextMatchup?.week_number || currentWeek);
  const unreadMessages = messages.filter((message) => !message.read_at).length;
  return (
    <>
      <CompactHeader league={league} season={season} currentMember={manager} memberCount={members.length} context="Manager Portal" />
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ManagerMatchupPanel league={league} currentWeek={currentWeek} matchups={matchups} weekResults={weekResults} members={members} manager={manager} />
          <StandingsPanel league={league} standings={standings} members={members} isLoading={isLoadingStandings} compact />
        </div>
        <div className="neo-border bg-white p-2">
          <div className="flex flex-wrap gap-2">
            {MANAGER_PORTAL_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const badge = tab.id === "messages" ? unreadMessages : 0;
              return (
                <Link
                  key={tab.id}
                  to={managerTabPath(league.id, manager.id, tab)}
                  className={`neo-border relative inline-flex items-center gap-2 px-3 py-2 text-xs font-black uppercase ${active ? "bg-[#F7B801] text-black" : "bg-white text-black hover:bg-[#EFFBFF]"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {badge > 0 && <span className="neo-border ml-1 bg-red-500 px-2 py-0.5 text-[10px] text-white">{badge}</span>}
                </Link>
              );
            })}
          </div>
        </div>
        {activeTab === "lineup" && <ManagerLineupPanel league={league} lineupWeek={lineupWeek} manager={manager} scheduleReady={Boolean(nextMatchup)} weekResults={weekResults} />}
        {activeTab === "matches" && <ManagerResultsPanel league={league} weekResults={weekResults} matchups={matchups} members={members} manager={manager} />}
        {activeTab === "messages" && <ManagerMessagingPanel messages={messages} members={members} />}
        {activeTab === "free-agents" && <FreeAgentBoard league={league} currentMember={manager} />}
        {activeTab === "roster" && <ManagerRosterPanel league={league} manager={manager} weekResults={weekResults} />}
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
  const selectedNewsId = searchParams.get("newsId");
  const routeWeekNumber = Number(params.weekNumber || 0);
  const routeHubSection = params.hubSection;
  const routeManagerSection = params.managerSection;
  const isManagerPortal = location.pathname.toLowerCase().startsWith("/league/manager");
  const isWeekView = location.pathname.toLowerCase().startsWith("/league/week/");
  const activeTab = resolveHubTabId(routeHubSection, searchParams.get("tab"));
  const activeManagerTab = resolveManagerTabId(routeManagerSection);

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

  const { data: drafts = [] } = useQuery({
    queryKey: ["league-nav-drafts", leagueId],
    queryFn: () => appClient.entities.Draft.filter({ league_id: leagueId }, "-created_date"),
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
      const seasons = await appClient.entities.Season.filter({ league_id: leagueId }, "-created_date");
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

  const displayStandings = useMemo(
    () => standingsWithResolvedRecords(standings, matchups, weekResults, league),
    [league, matchups, standings, weekResults]
  );

  const { data: newsItems = [] } = useQuery({
    queryKey: ["league-news", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_news_items")
        .select("id,league_id,title,summary,news_type,status,published_at,created_date,source_week_number,source_draft_id")
        .eq("league_id", leagueId)
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
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

  const matchupPlayerIds = useMemo(() => {
    if (!isWeekView) return [];
    const ids = new Set();
    lineups
      .filter((lineup) => Number(lineup.week_number) === Number(routeWeekNumber))
      .forEach((lineup) => collectSlotPlayerIds(lineup.slots, ids));
    weekResults
      .filter((result) => Number(result.week_number) === Number(routeWeekNumber))
      .forEach((result) => collectSlotPlayerIds(result.scoring_details || result.lineup_slots || result.slots, ids));
    return [...ids].sort();
  }, [isWeekView, lineups, routeWeekNumber, weekResults]);

  const { data: players = [] } = useQuery({
    queryKey: ["league-detail-players", leagueId, routeWeekNumber, matchupPlayerIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").in("id", matchupPlayerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(leagueId && currentMember && isWeekView && requestedMatchId && matchupPlayerIds.length),
  });

  const { data: matchupTiers = [] } = useQuery({
    queryKey: ["league-detail-player-tiers", leagueId, routeWeekNumber, matchupPlayerIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_player_draft_tiers")
        .select("player_id,tier_value,position,position_rank")
        .eq("league_id", leagueId)
        .in("player_id", matchupPlayerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(leagueId && currentMember && isWeekView && requestedMatchId && matchupPlayerIds.length),
  });

  const { data: matchupDurabilityRows = [] } = useQuery({
    queryKey: ["league-detail-player-durability", leagueId, routeWeekNumber, matchupPlayerIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_player_durability")
        .select("player_id,durability")
        .eq("league_id", leagueId)
        .in("player_id", matchupPlayerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(leagueId && currentMember && isWeekView && requestedMatchId && matchupPlayerIds.length),
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
  const latestDraft = drafts[0] || null;

  return (
    <LeagueShell>
      <LeagueNav league={league} currentMember={currentMember} isCommissioner={isCommissioner} activeArea={activeArea} draftStatus={latestDraft?.status} />
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
            tiers={matchupTiers}
            durabilityRows={matchupDurabilityRows}
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
            standings={displayStandings}
            isLoadingStandings={isLoadingStandings}
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
          activeTab={activeManagerTab}
          standings={displayStandings}
          isLoadingStandings={isLoadingStandings}
        />
      ) : (
        <LeagueHubPage
          league={league}
          season={season}
          currentMember={currentMember}
          isCommissioner={isCommissioner}
          members={members}
          standings={displayStandings}
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
          selectedNewsId={selectedNewsId}
        />
      )}
    </LeagueShell>
  );
}
