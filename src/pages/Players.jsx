
import React, { useEffect, useMemo, useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, TrendingUp, Award, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PAGE_SIZE = 20;
const FILTER_FETCH_SIZE = 1000;

async function fetchAllPlayers(sortBy) {
  const allPlayers = [];
  let skip = 0;
  let batch = [];

  do {
    batch = await appClient.entities.Player.list(sortBy, FILTER_FETCH_SIZE, skip);
    allPlayers.push(...batch);
    skip += FILTER_FETCH_SIZE;
  } while (batch.length === FILTER_FETCH_SIZE);

  return allPlayers;
}

async function fetchDisplayedPlayerWeeks(year, playerIds) {
  if (!year || !playerIds.length) return [];
  return appClient.entities.PlayerWeek.filter(
    { season_year: Number(year), player_id: playerIds },
    "player_id,week",
    PAGE_SIZE * 20,
    0
  );
}

function buildDisplayedWeekMap(playerWeeks) {
  const grouped = new Map();

  playerWeeks.forEach((week) => {
    const points = Number(week.fantasy_points || 0);
    grouped.set(week.player_id, (grouped.get(week.player_id) || 0) + (points !== 0 ? 1 : 0));
  });

  return grouped;
}

function getPlayerStat(player, field) {
  return Number(player?.[field] ?? 0);
}

function sortPlayers(players, sortBy) {
  const descending = sortBy.startsWith("-");
  const field = descending ? sortBy.slice(1) : sortBy;

  return [...players].sort((left, right) => {
    const leftValue = getPlayerStat(left, field);
    const rightValue = getPlayerStat(right, field);

    if (leftValue !== rightValue) {
      return descending ? rightValue - leftValue : leftValue - rightValue;
    }

    const leftName = left?.player_display_name || left?.full_name || "";
    const rightName = right?.player_display_name || right?.full_name || "";
    return leftName.localeCompare(rightName);
  });
}

export default function Players() {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("-avg_points");
  const [excludeZeroes, setExcludeZeroes] = useState(true);
  const [selectedYear, setSelectedYear] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Query for player counts from Global table
  const { data: counts = {} } = useQuery({
    queryKey: ['player-counts'],
    queryFn: async () => {
      const [qbCount, kCount, offCount, defCount] = await Promise.all([
        appClient.entities.Global.filter({ key: "COUNT_PLAYERS_QB" }),
        appClient.entities.Global.filter({ key: "COUNT_PLAYERS_K" }),
        appClient.entities.Global.filter({ key: "COUNT_PLAYERS_OFF" }),
        appClient.entities.Global.filter({ key: "COUNT_PLAYERS_DEF" })
      ]);

      return {
        QB: qbCount[0]?.value_number || 0,
        K: kCount[0]?.value_number || 0,
        OFF: offCount[0]?.value_number || 0,
        DEF: defCount[0]?.value_number || 0
      };
    },
    staleTime: 60 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  // Main query for paginated players with caching
  const { data: queryResult = { data: [], hasMore: false }, isLoading } = useQuery({
    queryKey: ['players', sortBy, page],
    queryFn: async () => {
        const players = await appClient.entities.Player.list(sortBy, PAGE_SIZE, page * PAGE_SIZE);
        console.log('[Players] Sample player data:', players[0]);
        return {
            data: players,
            hasMore: players.length === PAGE_SIZE,
        }
    },
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });

  // Query for ALL players with longer cache
  const { data: allPlayers = [], isLoading: isFilteringLoading } = useQuery({
    queryKey: ['allPlayersForFiltering', sortBy],
    queryFn: () => fetchAllPlayers(sortBy),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });

  const availableYears = useMemo(() => {
    const years = new Set();
    allPlayers.forEach((player) => {
      (player.active_years || []).forEach((year) => years.add(Number(year)));
      if (player.source_season_year) years.add(Number(player.source_season_year));
    });
    return [...years].filter(Boolean).sort((a, b) => b - a);
  }, [allPlayers]);

  useEffect(() => {
    if (!selectedYear && availableYears.length) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  // Determine if local filtering is active
  const isLocalFilteringActive = searchTerm || positionFilter !== "ALL" || excludeZeroes || selectedYear;

  // Choose the source of players for filtering
  const playersSource = isLocalFilteringActive ? allPlayers : queryResult.data;

  // Apply search and position filters
  const filteredPlayers = sortPlayers(playersSource.filter((p) => {
    const playerName = `${p.player_display_name || ""} ${p.full_name || ""}`.toLowerCase();
    const matchesSearch = !searchTerm || playerName.includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === "ALL" || p.position === positionFilter;
    const matchesYear = !selectedYear || (p.active_years || []).includes(Number(selectedYear)) || Number(p.source_season_year) === Number(selectedYear);
    const matchesPoints = !excludeZeroes || getPlayerStat(p, "total_points") !== 0;
    return matchesSearch && matchesPosition && matchesYear && matchesPoints;
  }), sortBy);

  // Determine the players to render
  const playersToRender = isLocalFilteringActive
    ? filteredPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : filteredPlayers;

  // Determine if there's more data for pagination
  const hasMoreData = isLocalFilteringActive
    ? filteredPlayers.length > (page + 1) * PAGE_SIZE
    : queryResult.hasMore;

  const displayedPlayerIds = useMemo(() => playersToRender.map((player) => player.id).filter(Boolean), [playersToRender]);

  const { data: displayedWeeks = [], isLoading: isDisplayedWeeksLoading } = useQuery({
    queryKey: ["displayed-player-weeks", selectedYear, displayedPlayerIds],
    queryFn: () => fetchDisplayedPlayerWeeks(selectedYear, displayedPlayerIds),
    enabled: Boolean(selectedYear && displayedPlayerIds.length),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    keepPreviousData: true,
  });

  const displayedWeekCounts = useMemo(() => buildDisplayedWeekMap(displayedWeeks), [displayedWeeks]);

  const positionColors = {
    QB: "bg-[#FF6B35]",
    K: "bg-[#F7B801]",
    OFF: "bg-[#00D9FF]",
    DEF: "bg-[#6A4C93]"
  };

  const teamColors = {
    "ARI": { bg: "bg-[#97233F]", text: "text-white" },
    "ATL": { bg: "bg-[#A71930]", text: "text-white" },
    "BAL": { bg: "bg-[#241773]", text: "text-white" },
    "BUF": { bg: "bg-[#00338D]", text: "text-white" },
    "CAR": { bg: "bg-[#0085CA]", text: "text-white" },
    "CHI": { bg: "bg-[#0B162A]", text: "text-white" },
    "CIN": { bg: "bg-[#FB4F14]", text: "text-white" },
    "CLE": { bg: "bg-[#311D00]", text: "text-white" },
    "DAL": { bg: "bg-[#041E42]", text: "text-white" },
    "DEN": { bg: "bg-[#FB4F14]", text: "text-white" },
    "DET": { bg: "bg-[#0076B6]", text: "text-white" },
    "GB": { bg: "bg-[#203731]", text: "text-white" },
    "HOU": { bg: "bg-[#03202F]", text: "text-white" },
    "IND": { bg: "bg-[#002C5F]", text: "text-white" },
    "JAX": { bg: "bg-[#006778]", text: "text-white" },
    "KC": { bg: "bg-[#E31837]", text: "text-white" },
    "LAC": { bg: "bg-[#0080C6]", text: "text-white" },
    "LAR": { bg: "bg-[#003594]", text: "text-white" },
    "LV": { bg: "bg-[#000000]", text: "text-white" },
    "MIA": { bg: "bg-[#008E97]", text: "text-white" },
    "MIN": { bg: "bg-[#4F2683]", text: "text-white" },
    "NE": { bg: "bg-[#002244]", text: "text-white" },
    "NO": { bg: "bg-[#D3BC8D]", text: "text-black" },
    "NYG": { bg: "bg-[#0B2265]", text: "text-white" },
    "NYJ": { bg: "bg-[#125740]", text: "text-white" },
    "PHI": { bg: "bg-[#004C54]", text: "text-white" },
    "PIT": { bg: "bg-[#FFB612]", text: "text-black" },
    "SF": { bg: "bg-[#AA0000]", text: "text-white" },
    "SEA": { bg: "bg-[#002244]", text: "text-white" },
    "TB": { bg: "bg-[#D50A0A]", text: "text-white" },
    "TEN": { bg: "bg-[#0C2340]", text: "text-white" },
    "WAS": { bg: "bg-[#773141]", text: "text-white" }
  };

  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
    setPage(0);
  };

  const searchInputControl = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
        placeholder="Search by name..."
        className="neo-border pl-12 font-bold"
      />
    </div>
  );

  const yearControl = (
    <Select value={selectedYear} onValueChange={(value) => {
      setSelectedYear(value);
      setPage(0);
    }}>
      <SelectTrigger className="neo-border font-bold">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((year) => (
          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const positionControl = (
    <Select value={positionFilter} onValueChange={(value) => {
      setPositionFilter(value);
      setPage(0);
    }}>
      <SelectTrigger className="neo-border font-bold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All</SelectItem>
        <SelectItem value="QB">QB</SelectItem>
        <SelectItem value="K">K</SelectItem>
        <SelectItem value="OFF">OFF</SelectItem>
        <SelectItem value="DEF">DEF</SelectItem>
      </SelectContent>
    </Select>
  );

  const sortControl = (
    <Select value={sortBy} onValueChange={(value) => {
      setSortBy(value);
      setPage(0);
    }}>
      <SelectTrigger className="neo-border font-bold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="-avg_points">Average Points</SelectItem>
        <SelectItem value="-total_points">Total Points</SelectItem>
        <SelectItem value="-high_score">High Score</SelectItem>
        <SelectItem value="-low_score">Low Score</SelectItem>
      </SelectContent>
    </Select>
  );

  const excludeZeroesControl = (
    <label className="neo-border flex h-10 items-center gap-3 bg-[#FFFBEB] px-4 py-3 font-black uppercase">
      <Checkbox
        checked={excludeZeroes}
        onCheckedChange={(checked) => {
          setExcludeZeroes(Boolean(checked));
          setPage(0);
        }}
        className="h-5 w-5 border-2 border-black data-[state=checked]:bg-[#FF6B35] data-[state=checked]:text-black"
      />
      Exclude 0's
    </label>
  );

  const searchButton = (
    <Button onClick={handleSearch} className="neo-btn h-10 bg-[#00D9FF] text-black px-4">
      <Search className="w-5 h-5" />
      Search
    </Button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="neo-card bg-black text-white p-8 mb-8 rotate-[0.5deg]">
        <div className="rotate-[-0.5deg]">
          <h1 className="text-orange-600 mb-3 text-4xl font-black uppercase md:text-5xl">PLAYER POOL</h1>
          <p className="text-lg font-bold text-[#F7B801]">
            Browse and analyze retro football legends
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="neo-card bg-white p-6 mb-8">
        <div className="md:hidden space-y-4">
          <div>
            <label className="block text-sm font-black uppercase mb-2">Search Players</label>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">{searchInputControl}</div>
              <Button
                onClick={() => setMobileFiltersOpen((open) => !open)}
                className="neo-btn h-10 flex-none bg-white text-black px-3"
                aria-expanded={mobileFiltersOpen}
              >
                <Filter className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-black uppercase mb-2">Year</label>
                {yearControl}
              </div>
              <div>
                <label className="block text-sm font-black uppercase mb-2">Position</label>
                {positionControl}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-black uppercase mb-2">Sort By</label>
                {sortControl}
              </div>
              <div className="col-span-2">{excludeZeroesControl}</div>
            </div>
          )}

          <div className="flex justify-end">{searchButton}</div>
        </div>

        <div className="hidden md:flex flex-nowrap items-end gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-[270px] flex-none">
            <label className="block text-sm font-black uppercase mb-2">Search Players</label>
            {searchInputControl}
          </div>

          <div className="w-[88px] flex-none">
            <label className="block text-sm font-black uppercase mb-2">Year</label>
            {yearControl}
          </div>

          <div className="w-[118px] flex-none">
            <label className="block text-sm font-black uppercase mb-2">Position</label>
            {positionControl}
          </div>

          <div className="w-[232px] flex-none">
            <label className="block text-sm font-black uppercase mb-2">Sort By</label>
            {sortControl}
          </div>

          <div className="w-[158px] flex-none">
            {excludeZeroesControl}
          </div>

          <div className="flex-none">{searchButton}</div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {['QB', 'K', 'OFF', 'DEF'].map((pos, idx) => {
          const count = counts[pos] || 0;
          const rotation = idx % 2 === 0 ? 'rotate-[0.5deg]' : 'rotate-[-0.5deg]';

          return (
            <div key={pos} className={`neo-card ${positionColors[pos]} p-6 ${rotation}`}>
              <p className="text-sm font-black uppercase text-black mb-1">{pos}</p>
              <p className="text-3xl font-black text-black">{count}</p>
              <p className="text-xs font-bold text-black/70 uppercase">Players</p>
            </div>
          );
        })}
      </div>

      {/* Player Grid */}
      {(isLoading && !isLocalFilteringActive) || (isFilteringLoading && isLocalFilteringActive) ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
          <p className="mt-4 font-black uppercase">Loading Players...</p>
        </div>
      ) : playersToRender.length === 0 ? (
        <div className="neo-card bg-white p-12 text-center">
          <Filter className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-2xl font-black uppercase mb-2">No Players Found</h3>
          <p className="text-gray-600 font-bold">
            Try adjusting your filters or search term
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playersToRender.map((player, idx) => {
              const rotation = idx % 3 === 0 ? 'rotate-[0.3deg]' : idx % 3 === 1 ? 'rotate-[-0.3deg]' : 'rotate-[0.1deg]';
              const teamColor = teamColors[player.team] || { bg: "bg-gray-500", text: "text-white" };
              const teamAccentClass = player.team && player.team !== 'FA' ? teamColor.bg : "bg-black";
              const teamHex = teamColor.bg.match(/\[#([A-Fa-f0-9]+)\]/)?.[1];
              const teamShadow = player.team && player.team !== 'FA' && teamHex ? `#${teamHex}` : "#000000";
              const activeWeeks = displayedWeekCounts.get(player.id) || 0;
              const avgPoints = getPlayerStat(player, "avg_points");
              const highScore = getPlayerStat(player, "high_score");
              const lowScore = getPlayerStat(player, "low_score");
              const totalPoints = getPlayerStat(player, "total_points");
              const rank = page * PAGE_SIZE + idx + 1;

              return (
                <Link key={player.id} to={createPageUrl(`PlayerStats?id=${player.id}`)}>
                  <div className={`relative ${teamAccentClass} p-1 neo-border shadow-[6px_6px_0_var(--team-shadow)] hover:translate-x-1 hover:translate-y-1 transition-transform ${rotation}`} style={{ "--team-shadow": teamShadow }}>
                    <div className="bg-white p-5">
                    {player.team && player.team !== 'FA' && (
                      <>
                        <div className={`absolute left-0 top-0 h-full w-2 ${teamColor.bg}`} />
                        <div className={`absolute left-0 right-0 top-0 h-1 ${teamColor.bg}`} />
                      </>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-black uppercase text-black">
                          {player.player_display_name || player.full_name}
                        </h3>
                      </div>
                      <div className={`${positionColors[player.position]} text-black px-3 py-1 neo-border text-sm font-black`}>
                        {player.position}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-black uppercase text-gray-500">Avg</p>
                        </div>
                        <p className="text-2xl font-black text-black">
                          {avgPoints.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Award className="w-4 h-4 text-gray-400" />
                          <p className="text-xs font-black uppercase text-gray-500">High</p>
                        </div>
                        <p className="text-2xl font-black text-black">
                          {highScore.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-gray-500 mb-1">Low</p>
                        <p className="text-2xl font-black text-black">
                          {lowScore.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-gray-500 mb-1">Total</p>
                        <p className="text-2xl font-black text-black">
                          {totalPoints.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className={`mt-4 h-2 ${teamAccentClass}`} />

                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3 pr-2">
                        {player.team && player.team !== 'FA' && (
                          <div className={`mt-0.5 flex-none ${teamColor.bg} ${teamColor.text} px-2 py-1 neo-border text-xs font-black`}>
                            {player.team}
                          </div>
                        )}
                        {player.active_years && player.active_years.length > 0 && (
                          <div className="min-w-0">
                          <p className="text-sm font-bold text-black">
                            <span className="text-xs font-black uppercase text-gray-500">Active Years:</span>{" "}
                            {Math.min(...player.active_years)} - {Math.max(...player.active_years)}
                          </p>
                          <p className="text-sm font-bold text-black">
                            <span className="text-xs font-black uppercase text-gray-500">Active Weeks:</span>{" "}
                            {isDisplayedWeeksLoading ? "..." : activeWeeks}
                          </p>
                        </div>
                        )}
                      </div>

                      <div className="flex-none text-right">
                        <p className="text-xs font-black uppercase text-gray-500">Rank</p>
                        <p className="text-3xl font-black text-black leading-none">#{rank}</p>
                      </div>
                    </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {/* Pagination Controls */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <Button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="neo-btn bg-white">
              <ChevronsLeft className="w-5 h-5"/>
            </Button>
            <span className="font-bold text-lg">Page {page + 1}</span>
            <Button onClick={() => setPage(p => p + 1)} disabled={!hasMoreData} className="neo-btn bg-white">
              <ChevronsRight className="w-5 h-5"/>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
