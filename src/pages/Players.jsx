
import React, { useEffect, useMemo, useState } from "react";
import { appClient } from "@/api/appClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, TrendingUp, Award, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PAGE_SIZE = 20;

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

function splitPlayerName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] || "Unknown", "\u00a0"];
  return [parts[0], parts.slice(1).join(" ")];
}

export default function Players() {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("-avg_points");
  const [selectedYear, setSelectedYear] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data: availableYears = [], isLoading: isYearsLoading } = useQuery({
    queryKey: ["player-pool-years"],
    queryFn: () => appClient.playerPool.listYears(),
    staleTime: 60 * 60 * 1000,
    cacheTime: 2 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedYear && availableYears.length) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  const { data: queryResult = { data: [], hasMore: false, totalCount: 0 }, isLoading } = useQuery({
    queryKey: ["players", selectedYear, positionFilter, searchTerm, sortBy, page],
    queryFn: () => appClient.playerPool.listPlayers({
      seasonYear: selectedYear ? Number(selectedYear) : null,
      position: positionFilter,
      searchTerm,
      sortBy,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: Boolean(selectedYear || (!isYearsLoading && availableYears.length === 0)),
    keepPreviousData: true,
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });

  const { data: positionSummary = null } = useQuery({
    queryKey: ["player-position-year-count", selectedYear, positionFilter],
    queryFn: () => appClient.playerPool.getPositionYearCount({
      seasonYear: Number(selectedYear),
      position: positionFilter,
    }),
    enabled: Boolean(selectedYear && positionFilter !== "ALL"),
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });

  const playersToRender = queryResult.data;
  const hasMoreData = queryResult.hasMore;

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

  const searchButton = (
    <Button onClick={handleSearch} className="neo-btn h-10 bg-[#00D9FF] text-black px-4">
      <Search className="w-5 h-5" />
      Search
    </Button>
  );

  const formatCount = (value) => Number(value || 0).toLocaleString();

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

          <div className="flex-none">{searchButton}</div>
        </div>
      </div>

      {positionFilter !== "ALL" && positionSummary && (
        <div className={`neo-card ${positionColors[positionFilter]} p-4 mb-8 text-black`}>
          <p className="text-sm font-black uppercase">
            {positionFilter} - {formatCount(positionSummary.total_players)} players total /{" "}
            {formatCount(positionSummary.players_with_stats)} with stats /{" "}
            {formatCount(positionSummary.stat_weeks)} stat weeks
          </p>
        </div>
      )}

      {/* Player Grid */}
      {isLoading || isYearsLoading ? (
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
              const [firstName, lastName] = splitPlayerName(player.player_display_name || player.full_name);

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
                      <div className="min-w-0 pr-3">
                        <h3 className="min-h-[3.5rem] text-xl font-black uppercase leading-none text-black">
                          <span className="block truncate">{firstName}</span>
                          <span className="block truncate pt-1">{lastName}</span>
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
                          <div className={`mt-0.5 flex w-10 flex-none items-center justify-center ${teamColor.bg} ${teamColor.text} px-2 py-1 neo-border text-xs font-black`}>
                            {player.team}
                          </div>
                        )}
                        {player.active_years && player.active_years.length > 0 && (
                          <div className="min-w-0">
                          <p className="text-sm font-bold text-black">
                            <span className="text-xs font-black uppercase text-gray-500">Years:</span>{" "}
                            {Math.min(...player.active_years)} - {Math.max(...player.active_years)}
                          </p>
                          <p className="text-sm font-bold text-black">
                            <span className="text-xs font-black uppercase text-gray-500">Weeks:</span>{" "}
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
