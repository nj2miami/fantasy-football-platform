
import React from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEAM_DETAILS = {
  ARI: { name: "Arizona Cardinals", primary: "#97233F", secondary: "#FFB612" },
  ATL: { name: "Atlanta Falcons", primary: "#A71930", secondary: "#000000" },
  BAL: { name: "Baltimore Ravens", primary: "#241773", secondary: "#9E7C0C" },
  BUF: { name: "Buffalo Bills", primary: "#00338D", secondary: "#C60C30" },
  CAR: { name: "Carolina Panthers", primary: "#0085CA", secondary: "#101820" },
  CHI: { name: "Chicago Bears", primary: "#0B162A", secondary: "#C83803" },
  CIN: { name: "Cincinnati Bengals", primary: "#FB4F14", secondary: "#000000" },
  CLE: { name: "Cleveland Browns", primary: "#311D00", secondary: "#FF3C00" },
  DAL: { name: "Dallas Cowboys", primary: "#041E42", secondary: "#869397" },
  DEN: { name: "Denver Broncos", primary: "#FB4F14", secondary: "#002244" },
  DET: { name: "Detroit Lions", primary: "#0076B6", secondary: "#B0B7BC" },
  GB: { name: "Green Bay Packers", primary: "#203731", secondary: "#FFB612" },
  HOU: { name: "Houston Texans", primary: "#03202F", secondary: "#A71930" },
  IND: { name: "Indianapolis Colts", primary: "#002C5F", secondary: "#A2AAAD" },
  JAX: { name: "Jacksonville Jaguars", primary: "#006778", secondary: "#D7A22A" },
  KC: { name: "Kansas City Chiefs", primary: "#E31837", secondary: "#FFB81C" },
  LAC: { name: "Los Angeles Chargers", primary: "#0080C6", secondary: "#FFC20E" },
  LAR: { name: "Los Angeles Rams", primary: "#003594", secondary: "#FFA300" },
  LV: { name: "Las Vegas Raiders", primary: "#000000", secondary: "#A5ACAF" },
  MIA: { name: "Miami Dolphins", primary: "#008E97", secondary: "#FC4C02" },
  MIN: { name: "Minnesota Vikings", primary: "#4F2683", secondary: "#FFC62F" },
  NE: { name: "New England Patriots", primary: "#002244", secondary: "#C60C30" },
  NO: { name: "New Orleans Saints", primary: "#D3BC8D", secondary: "#101820" },
  NYG: { name: "New York Giants", primary: "#0B2265", secondary: "#A71930" },
  NYJ: { name: "New York Jets", primary: "#125740", secondary: "#000000" },
  PHI: { name: "Philadelphia Eagles", primary: "#004C54", secondary: "#A5ACAF" },
  PIT: { name: "Pittsburgh Steelers", primary: "#FFB612", secondary: "#101820" },
  SF: { name: "San Francisco 49ers", primary: "#AA0000", secondary: "#B3995D" },
  SEA: { name: "Seattle Seahawks", primary: "#002244", secondary: "#69BE28" },
  TB: { name: "Tampa Bay Buccaneers", primary: "#D50A0A", secondary: "#34302B" },
  TEN: { name: "Tennessee Titans", primary: "#0C2340", secondary: "#4B92DB" },
  WAS: { name: "Washington Commanders", primary: "#773141", secondary: "#FFB612" },
};

async function loadPlayerHeadshot(player) {
  const existingUrl = player?.headshot_public_url || player?.headshot_url;
  const playerKey = player?.player_key || player?.player_id || player?.id;
  if (!playerKey) return existingUrl || null;
  try {
    const response = await appClient.functions.invoke("load_player_headshot", { player_key: playerKey });
    return response?.data?.headshot_url || existingUrl || null;
  } catch (error) {
    console.warn("[PlayerStats] Headshot load failed:", error);
    return existingUrl || null;
  }
}

function statNumber(value) {
  return Number(value || 0);
}

function pointsLabel(points) {
  const value = Number(points || 0);
  if (value > 0) return `+${value.toFixed(2)}`;
  return value.toFixed(2);
}

function ScoredLine({ label, value, points }) {
  const hasValue = typeof value === "string"
    ? value.trim() !== "" && value !== "0/0"
    : Boolean(statNumber(value));
  if (!hasValue && !Number(points || 0)) return null;
  const pointValue = Number(points || 0);
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="min-w-0 font-bold text-gray-600">{label}:</span>
      <span className="text-center font-black">{value}</span>
      <span className={`neo-border justify-self-end px-2 py-0.5 text-right text-xs font-black ${pointValue < 0 ? "bg-red-100 text-red-700" : "bg-[#F7B801] text-black"}`}>
        {pointsLabel(pointValue)} pts
      </span>
    </div>
  );
}

function mergeScoringRules(rules) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SCORING_RULES).map(([category, defaultRules]) => [
      category,
      {
        ...defaultRules,
        ...((rules || {})[category] || {}),
      },
    ])
  );
}

function scoringRuleNumber(rules, category, key, fallback) {
  const parsed = Number(rules?.[category]?.[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildScoringSections(week, rules = DEFAULT_SCORING_RULES, playerPosition = "OFF") {
  const n = (field) => statNumber(week[field]);
  const r = (category, key, fallback) => scoringRuleNumber(rules, category, key, fallback);
  const completions = n("completions");
  const attempts = n("attempts");
  const incompletions = Math.max(attempts - completions, 0);
  const completionEfficiencyPoints =
    completions * r("OFFENSE", "completion", 0.2) +
    incompletions * r("OFFENSE", "incompletion", -0.3);
  const isDefense = String(playerPosition || "").toUpperCase() === "DEF";
  const passing = [
    { label: "Completion Efficiency", value: `${completions}/${attempts}`, points: completionEfficiencyPoints },
    { label: "Passing Yards", value: n("passing_yards"), points: n("passing_yards") * r("OFFENSE", "passing_yard", 0.04) },
    { label: "Passing TDs", value: n("passing_tds"), points: n("passing_tds") * r("OFFENSE", "passing_td", 4) },
    { label: "Interceptions", value: n("passing_interceptions"), points: n("passing_interceptions") * r("OFFENSE", "passing_int", -2) },
    { label: "First Downs", value: n("passing_first_downs"), points: n("passing_first_downs") * r("OFFENSE", "passing_first_down", 0.5) },
    { label: "2PT Conv", value: n("passing_2pt_conversions"), points: n("passing_2pt_conversions") * r("OFFENSE", "two_pt_conversion", 2) },
  ];
  const rushing = [
    { label: "Carries", value: n("carries"), points: 0 },
    { label: "Rushing Yards", value: n("rushing_yards"), points: n("rushing_yards") * r("OFFENSE", "rushing_yard", 0.1) },
    { label: "Rushing TDs", value: n("rushing_tds"), points: n("rushing_tds") * r("OFFENSE", "rushing_td", 6) },
    { label: "First Downs", value: n("rushing_first_downs"), points: n("rushing_first_downs") * r("OFFENSE", "rushing_first_down", 0.5) },
    { label: "Fumbles", value: n("rushing_fumbles"), points: n("rushing_fumbles") * r("OFFENSE", "fumble", -1) },
    { label: "Fumbles Lost", value: n("rushing_fumbles_lost"), points: n("rushing_fumbles_lost") * r("OFFENSE", "fumble_lost", -2) },
    { label: "2PT Conv", value: n("rushing_2pt_conversions"), points: n("rushing_2pt_conversions") * r("OFFENSE", "two_pt_conversion", 2) },
  ];
  const receiving = [
    { label: "Receptions/Targets", value: `${n("receptions")}/${n("targets")}`, points: n("receptions") * r("OFFENSE", "reception", 1) },
    { label: "Receiving Yards", value: n("receiving_yards"), points: n("receiving_yards") * r("OFFENSE", "receiving_yard", 0.1) },
    { label: "Receiving TDs", value: n("receiving_tds"), points: n("receiving_tds") * r("OFFENSE", "receiving_td", 6) },
    { label: "First Downs", value: n("receiving_first_downs"), points: n("receiving_first_downs") * r("OFFENSE", "receiving_first_down", 0.5) },
    { label: "Fumbles", value: n("receiving_fumbles"), points: n("receiving_fumbles") * r("OFFENSE", "fumble", -1) },
    { label: "Fumbles Lost", value: n("receiving_fumbles_lost"), points: n("receiving_fumbles_lost") * r("OFFENSE", "fumble_lost", -2) },
    { label: "2PT Conv", value: n("receiving_2pt_conversions"), points: n("receiving_2pt_conversions") * r("OFFENSE", "two_pt_conversion", 2) },
  ];
  const defense = [
    { label: "Solo Tackles", value: n("def_tackles_solo"), points: n("def_tackles_solo") * r("DEFENSE", "solo_tackle", 1.5) },
    { label: "Assist Tackles", value: n("def_tackle_assists"), points: n("def_tackle_assists") * r("DEFENSE", "assist_tackle", 0.75) },
    { label: "TFL", value: n("def_tackles_for_loss"), points: n("def_tackles_for_loss") * r("DEFENSE", "tackle_for_loss", 1) },
    { label: "Sacks", value: n("def_sacks"), points: n("def_sacks") * r("DEFENSE", "sack", 3) },
    { label: "QB Hits", value: n("def_qb_hits"), points: n("def_qb_hits") * r("DEFENSE", "qb_hit", 0.5) },
    { label: "Interceptions", value: n("def_interceptions"), points: n("def_interceptions") * r("DEFENSE", "interception", 4) },
    { label: "Pass Defended", value: n("def_pass_defended"), points: n("def_pass_defended") * r("DEFENSE", "pass_defended", 1) },
    { label: "Fumbles Forced", value: n("def_fumbles_forced"), points: n("def_fumbles_forced") * r("DEFENSE", "fumble_forced", 2) },
    { label: "Safeties", value: n("def_safeties"), points: n("def_safeties") * r("DEFENSE", "safety", 2) },
    { label: "Def TDs", value: n("def_tds"), points: n("def_tds") * r("DEFENSE", "touchdown", 6) },
  ];
  const kicking = [
    { label: "FG Made/Att", value: `${n("fg_made")}/${n("fg_att")}`, points: 0 },
    { label: "FG 0-19 Made", value: n("fg_made_0_19"), points: n("fg_made_0_19") * r("KICKER", "fg_0_39", 3) },
    { label: "FG 20-29 Made", value: n("fg_made_20_29"), points: n("fg_made_20_29") * r("KICKER", "fg_0_39", 3) },
    { label: "FG 30-39 Made", value: n("fg_made_30_39"), points: n("fg_made_30_39") * r("KICKER", "fg_0_39", 3) },
    { label: "FG 40-49 Made", value: n("fg_made_40_49"), points: n("fg_made_40_49") * r("KICKER", "fg_40_49", 4) },
    { label: "FG 50-59 Made", value: n("fg_made_50_59"), points: n("fg_made_50_59") * r("KICKER", "fg_50_plus", 5) },
    { label: "FG 60+ Made", value: n("fg_made_60_"), points: n("fg_made_60_") * r("KICKER", "fg_50_plus", 5) },
    { label: "XP Made/Att", value: `${n("pat_made")}/${n("pat_att") || n("pat_made") + n("pat_missed")}`, points: n("pat_made") * r("KICKER", "xp_made", 1) },
    { label: "FG Missed Penalty", value: n("fg_missed"), points: n("fg_missed") * r("KICKER", "fg_miss", -1) },
    { label: "XP Missed Penalty", value: n("pat_missed"), points: n("pat_missed") * r("KICKER", "xp_miss", -1) },
  ];
  const fumbles = [
    { label: "Own Recovered", value: n("fumble_recovery_own"), points: isDefense ? n("fumble_recovery_own") * r("DEFENSE", "fumble_recovered", 2) : 0 },
    { label: "Opp Recovered", value: n("fumble_recovery_opp"), points: isDefense ? n("fumble_recovery_opp") * r("DEFENSE", "fumble_recovered", 2) : 0 },
    { label: "Recovery TDs", value: n("fumble_recovery_tds"), points: n("fumble_recovery_tds") * (isDefense ? r("DEFENSE", "touchdown", 6) : r("OFFENSE", "rushing_td", 6)) },
  ];
  const bonuses = [
    { label: "300 Pass Yards", value: n("passing_yards") >= 300 ? 1 : 0, points: n("passing_yards") >= 300 ? r("OFFENSE", "bonus_300_pass_yards", 3) : 0 },
    { label: "100 Rush/Rec Yards", value: n("rushing_yards") + n("receiving_yards") >= 100 ? 1 : 0, points: n("rushing_yards") + n("receiving_yards") >= 100 ? r("OFFENSE", "bonus_100_rush_rec_yards", 3) : 0 },
  ];
  return [
    ["Passing", passing],
    ["Rushing", rushing],
    ["Receiving", receiving],
    ["Defense", defense],
    ["Kicking", kicking],
    ["Fumbles", fumbles],
    ["Bonuses", bonuses],
  ].map(([title, lines]) => ({
    title,
    lines: lines.filter((line) => {
      const hasValue = typeof line.value === "string" ? line.value !== "0/0" : Boolean(statNumber(line.value));
      return hasValue || Number(line.points || 0) !== 0;
    }),
  })).filter((section) => section.lines.length > 0);
}

export default function PlayerStats() {
  const location = useLocation();
  const playerId = new URLSearchParams(location.search).get("id");
  const [selectedWeek, setSelectedWeek] = React.useState(null);

  const { data: player, isLoading: isLoadingPlayer } = useQuery({
    queryKey: ['player', playerId],
    queryFn: async () => {
      const players = await appClient.entities.Player.filter({ id: playerId });
      return players[0];
    },
    enabled: !!playerId
  });

  const { data: weeks = [], isLoading: isLoadingWeeks } = useQuery({
    queryKey: ['player-weeks', player?.id],
    queryFn: async () => {
      if (!player?.id) return [];
      return appClient.playerStats.listWeeklySummaries({ playerId: player.id });
    },
    enabled: !!player?.id
  });

  const { data: aggregateStats } = useQuery({
    queryKey: ["player-stats-aggregate", player?.id],
    queryFn: () => appClient.playerStats.getAggregate({ playerId: player.id }),
    enabled: !!player?.id,
  });

  const { data: headshotUrl } = useQuery({
    queryKey: ["player-headshot", player?.player_key || player?.player_id || player?.id],
    queryFn: () => loadPlayerHeadshot(player),
    enabled: Boolean(player?.player_key || player?.player_id || player?.id || player?.headshot_public_url || player?.headshot_url),
    initialData: player?.headshot_public_url || player?.headshot_url || null,
    staleTime: 24 * 60 * 60 * 1000,
    cacheTime: 24 * 60 * 60 * 1000,
  });

  const { data: seasonScoringRules = [] } = useQuery({
    queryKey: ["player-season-scoring-rules"],
    queryFn: () => appClient.entities.SeasonScoringRule.list("-season_year"),
  });

  const scoringRulesBySeason = React.useMemo(() => {
    return new Map(
      seasonScoringRules.map((row) => [
        Number(row.season_year),
        mergeScoringRules(row.rules),
      ])
    );
  }, [seasonScoringRules]);

  const displayWeeks = weeks;
  const stats = {
    avg_points: aggregateStats?.avg_points ?? player?.avg_points ?? 0,
    total_points: aggregateStats?.total_points ?? player?.total_points ?? 0,
    high_score: aggregateStats?.high_score ?? player?.high_score ?? 0,
    low_score: aggregateStats?.low_score ?? player?.low_score ?? 0
  };

  const activeWeeks = displayWeeks.filter((week) => Number(week.fantasy_points || 0) !== 0).length;
  const selectedWeekIndex = selectedWeek
    ? displayWeeks.findIndex((week) => (
      (week.id && selectedWeek.id && week.id === selectedWeek.id)
      || (
        Number(week.season || 0) === Number(selectedWeek.season || 0)
        && Number(week.week || 0) === Number(selectedWeek.week || 0)
        && (week.team || "") === (selectedWeek.team || "")
      )
    ))
    : -1;
  const previousWeek = selectedWeekIndex > 0 ? displayWeeks[selectedWeekIndex - 1] : null;
  const nextWeek = selectedWeekIndex >= 0 && selectedWeekIndex < displayWeeks.length - 1
    ? displayWeeks[selectedWeekIndex + 1]
    : null;
  const {
    data: selectedWeekDetail,
    isLoading: isLoadingSelectedWeekDetail,
    isError: isSelectedWeekDetailError,
  } = useQuery({
    queryKey: ["player-week-detail", selectedWeek?.id, selectedWeek?.player_id, selectedWeek?.season_year, selectedWeek?.week],
    queryFn: () => appClient.playerStats.getWeekDetail({
      playerWeekId: selectedWeek?.id,
      playerId: selectedWeek?.player_id || player?.id,
      seasonYear: selectedWeek?.season_year || selectedWeek?.season,
      week: selectedWeek?.week,
    }),
    enabled: Boolean(selectedWeek && player?.id),
  });
  const selectedScoringRules = React.useMemo(() => {
    const seasonYear = Number(selectedWeek?.season || selectedWeek?.season_year || 0);
    return scoringRulesBySeason.get(seasonYear) || mergeScoringRules();
  }, [scoringRulesBySeason, selectedWeek]);
  const selectedScoringSections = React.useMemo(() => {
    if (!selectedWeekDetail) return [];
    return buildScoringSections(selectedWeekDetail, selectedScoringRules, player?.position);
  }, [player?.position, selectedScoringRules, selectedWeekDetail]);
  const selectedCalculatedPoints = React.useMemo(
    () => Number(selectedWeekDetail?.fantasy_points ?? selectedWeek?.fantasy_points ?? 0),
    [selectedWeek, selectedWeekDetail]
  );

  if (isLoadingPlayer) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading Player Stats...</p>
      </div>
    );
  }

  if (!player) {
    return <div className="text-center font-bold text-2xl text-red-500">Player not found.</div>;
  }

  const team = TEAM_DETAILS[player.team] || {
    name: player.team === "FA" || !player.team ? "Free Agent" : player.team,
    primary: "#111827",
    secondary: "#F7B801",
  };
  const activeYears = player.active_years && player.active_years.length > 0
    ? `${Math.min(...player.active_years)} - ${Math.max(...player.active_years)}`
    : "N/A";
  const statCards = [
    ["Total Points", stats.total_points],
    ["Average", stats.avg_points],
    ["High", stats.high_score],
    ["Low", stats.low_score],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <Link to={createPageUrl("Players")}>
          <Button className="neo-btn bg-black text-white">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Players
          </Button>
        </Link>
      </div>

      <div
        className="neo-border mb-8 p-1 shadow-[8px_8px_0_var(--team-secondary)]"
        style={{ backgroundColor: team.primary, "--team-secondary": team.secondary }}
      >
        <div className="grid grid-cols-1 gap-6 bg-black/85 p-5 text-white lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="h-40 w-40 overflow-hidden neo-border bg-white">
            {headshotUrl ? (
              <img src={headshotUrl} alt={player.player_display_name || player.full_name} className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-black text-black">
                {(player.player_display_name || player.full_name || "?").slice(0, 1)}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-3xl font-black uppercase text-white md:text-5xl">
              {player.player_display_name || player.full_name}
              <span className="ml-3 inline-block align-middle text-xl text-white md:text-3xl">
                {player.position}
              </span>
            </h1>
            <p className="mt-2 text-xl font-black uppercase text-white">
              {team.name}
            </p>
            <div className="mt-4 space-y-1 text-sm font-bold text-white">
              <p><span className="font-black uppercase text-white">Years:</span> {activeYears}</p>
              <p><span className="font-black uppercase text-white">Weeks:</span> {activeWeeks}</p>
              <p><span className="font-black uppercase text-white">Player ID:</span> {player.player_key || player.player_id || player.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
            {statCards.map(([label, value]) => (
              <div key={label} className="neo-border bg-white p-4 text-black">
                <p className="text-xs font-black uppercase text-gray-500">{label}</p>
                <p className="text-3xl font-black">{Number(value || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="neo-card bg-white p-8">
        <h2 className="text-orange-600 mb-6 text-2xl font-black uppercase flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          WEEKLY PERFORMANCE
        </h2>

        {isLoadingWeeks ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-black border-t-transparent"></div>
            <p className="mt-2 font-bold text-gray-500">Loading stats...</p>
          </div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 font-bold mb-2">No weekly stats available for this player.</p>
            <p className="text-sm text-gray-400">Player ID: {player.player_key || player.player_id || player.id}</p>
            <p className="text-sm text-gray-400">Stats lookup ID: {player.id}</p>
            <p className="text-sm text-gray-400 mt-2">Try importing player data in Admin panel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b-4 border-black">
                <tr>
                  <th className="p-3 font-black uppercase">Season</th>
                  <th className="p-3 font-black uppercase">Week</th>
                  <th className="p-3 font-black uppercase">Team</th>
                  <th className="p-3 font-black uppercase">Opponent</th>
                  <th className="p-3 font-black uppercase text-right">Fantasy Points</th>
                  <th className="p-3 font-black uppercase text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {displayWeeks.map((week, idx) => (
                  <tr key={idx} className="border-b-2 border-gray-200 hover:bg-gray-50">
                    <td className="p-3 font-bold">{week.season}</td>
                    <td className="p-3 font-bold">Week {week.week}</td>
                    <td className="p-3 font-bold">{week.team || 'N/A'}</td>
                    <td className="p-3 font-bold">{week.opponent_team || 'N/A'}</td>
                    <td className="p-3 font-black text-right text-lg">{Number(week.fantasy_points || 0).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Button
                        onClick={() => setSelectedWeek(week)}
                        className="neo-btn bg-[#00D9FF] text-black px-4 py-2 text-sm"
                      >
                        View Stats
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mt-6 p-4 bg-gray-50 neo-border">
              <p className="text-sm font-bold text-gray-600">
                Total weeks displayed: <span className="text-black font-black">{weeks.length}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Stats Modal */}
      {selectedWeek && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWeek(null)}>
          <div className="neo-card bg-white p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-black uppercase text-black">
                  {player.player_display_name || player.full_name}
                </h3>
                <p className="text-lg font-bold text-gray-600">
                  {selectedWeek.season} | Week {selectedWeek.week} | {selectedWeek.team || 'N/A'}
                </p>
              </div>
              <Button onClick={() => setSelectedWeek(null)} className="neo-btn bg-black text-white">
                Close
              </Button>
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={() => previousWeek && setSelectedWeek(previousWeek)}
                disabled={!previousWeek}
                className="neo-btn bg-white text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Prev Week
              </Button>
              <p className="text-center text-sm font-black uppercase text-gray-500">
                Stat Record {selectedWeekIndex + 1} of {displayWeeks.length}
              </p>
              <Button
                onClick={() => nextWeek && setSelectedWeek(nextWeek)}
                disabled={!nextWeek}
                className="neo-btn bg-white text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next Week
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {isLoadingSelectedWeekDetail ? (
              <div className="neo-border bg-gray-50 p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-black border-t-transparent"></div>
                <p className="mt-3 font-black uppercase text-gray-600">Loading week detail...</p>
              </div>
            ) : isSelectedWeekDetailError || !selectedWeekDetail ? (
              <div className="neo-border bg-red-50 p-8 text-center">
                <p className="font-black uppercase text-red-700">Could not load week detail.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
                <div className="neo-border bg-[#F7B801] p-6">
                  <p className="mb-2 text-sm font-black uppercase text-black">Fantasy Points</p>
                  <p className="text-5xl font-black text-black">{selectedCalculatedPoints.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {selectedScoringSections.map((section) => (
                    <div key={section.title} className="neo-border p-4 bg-gray-50">
                      <h4 className="font-black uppercase text-sm mb-3">{section.title}</h4>
                      <div className="space-y-2 text-sm">
                        {section.lines.map((line) => (
                          <ScoredLine
                            key={line.label}
                            label={line.label}
                            value={line.value}
                            points={line.points}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
