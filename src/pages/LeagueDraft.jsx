import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Play,
  Plus,
  Search,
  Trash2,
  Trophy,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 10;
const POSITION_OPTIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const DEFAULT_ROSTER_NEEDS = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };

function formatDateTime(value) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleString();
}

function useNowMs() {
  const [nowMs, setNowMs] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return nowMs;
}

function formatCountdown(target, nowMs) {
  if (!target) return "Set a draft time";
  const remaining = Math.max(0, new Date(target).getTime() - nowMs);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function memberName(member) {
  return member?.team_name || member?.profile?.display_name || member?.profile?.profile_name || (member?.is_ai ? "AI Manager" : "Manager");
}

function playerName(player) {
  return player?.player_display_name || player?.full_name || "Player";
}

function statValue(value) {
  return Number(value || 0).toFixed(1);
}

function getPickRemaining(room, nowMs) {
  if (!room) return 60;
  const timerSeconds = Number(room.timer_seconds || room.state?.timer_seconds || 60);
  const startedAt = room.state?.pick_started_at || room.pick_started_at || room.updated_date || room.created_date;
  if (!startedAt) return timerSeconds;
  const elapsed = Math.floor((nowMs - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, timerSeconds - elapsed);
}

function normalizePosition(position) {
  const value = String(position || "").toUpperCase();
  if (value === "D/ST" || value === "DST") return "DEF";
  return value || "UNK";
}

function buildRosterNeeds(league, roster) {
  const starters = league?.roster_rules?.starters;
  const required = starters && typeof starters === "object" && Object.keys(starters).length
    ? Object.fromEntries(Object.entries(starters).map(([key, value]) => [String(key).toUpperCase(), Number(value || 0)]))
    : DEFAULT_ROSTER_NEEDS;
  const drafted = roster.reduce((counts, slot) => {
    const position = normalizePosition(slot.player?.position || slot.slot_type);
    counts[position] = (counts[position] || 0) + 1;
    return counts;
  }, {});
  const offenseDrafted = ["RB", "WR", "TE"].reduce((sum, position) => sum + Number(drafted[position] || 0), 0);
  return Object.entries(required)
    .filter(([, needed]) => Number(needed) > 0)
    .map(([position, needed]) => {
      const filled = position === "OFF" || position === "FLEX"
        ? Math.min(Number(needed), offenseDrafted)
        : Math.min(Number(needed), Number(drafted[position] || 0));
      return { position, needed: Number(needed), filled, remaining: Math.max(0, Number(needed) - filled) };
    });
}

function playPickChime() {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
  master.connect(context.destination);
  [392, 523.25, 659.25].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.11;
    oscillator.type = index === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + 0.26);
  });
  window.setTimeout(() => context.close().catch(() => {}), 1000);
}

function PlayerMiniStats({ player, weeksPlayed }) {
  return (
    <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-black uppercase sm:gap-2">
      <div><p className="text-gray-500">Avg</p><p>{statValue(player?.avg_points)}</p></div>
      <div><p className="text-gray-500">Tot</p><p>{statValue(player?.total_points)}</p></div>
      <div><p className="text-gray-500">High</p><p>{statValue(player?.high_score)}</p></div>
      <div><p className="text-gray-500">Low</p><p>{statValue(player?.low_score)}</p></div>
      <div><p className="text-gray-500">Wks</p><p>{weeksPlayed ?? "--"}</p></div>
    </div>
  );
}

function PlayerStatsDialog({ player, seasonYear, open, onOpenChange }) {
  const { data: aggregate } = useQuery({
    queryKey: ["draft-player-aggregate", player?.id, seasonYear],
    queryFn: () => appClient.playerStats.getAggregate({ playerId: player.id, seasonYear }),
    enabled: open && !!player?.id,
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ["draft-player-weeks", player?.id],
    queryFn: () => appClient.playerStats.listWeeklySummaries({ playerId: player.id }),
    enabled: open && !!player?.id,
  });

  const headshot = player?.headshot_public_url || player?.headshot_url;
  const stats = aggregate || player || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase">Player Stats</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-black uppercase leading-tight">{playerName(player)}</p>
              <p className="mt-1 text-sm font-black uppercase text-gray-500">{player?.position || "--"} | {player?.team || "FA"}</p>
            </div>
            <div className="neo-border flex aspect-square w-full items-center justify-center overflow-hidden bg-gray-100">
              {headshot ? <img src={headshot} alt="" className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-gray-400" />}
            </div>
            <div className="neo-border bg-[#EFFBFF] p-3">
              <p className="text-xs font-black uppercase text-gray-500">{seasonYear || "Season"} Stats</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase">
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Avg</p><p className="text-lg">{statValue(stats.avg_points)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Total</p><p className="text-lg">{statValue(stats.total_points)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">High</p><p className="text-lg">{statValue(stats.high_score)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Low</p><p className="text-lg">{statValue(stats.low_score)}</p></div>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm font-black uppercase text-gray-500">{aggregate?.weeks_played ?? player?.weeks_played ?? weeks.length} Stat Weeks</p>
            <div className="mt-4 overflow-hidden neo-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="p-2 font-black uppercase">Week</th>
                    <th className="p-2 font-black uppercase">Opp</th>
                    <th className="p-2 text-right font-black uppercase">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.id || `${week.season_year}-${week.week}`} className="border-t-2 border-black/10">
                      <td className="p-2 font-bold">Week {week.week}</td>
                      <td className="p-2 font-bold">{week.opponent_team || "--"}</td>
                      <td className="p-2 text-right font-black">{statValue(week.fantasy_points)}</td>
                    </tr>
                  ))}
                  {!weeks.length && (
                    <tr><td colSpan={3} className="p-4 text-center text-sm font-bold text-gray-500">No weekly stats found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftPlayerRow({ player, canDraft, onAdd, onDraft, onStats, isBusy, isInBoard }) {
  return (
    <div className="neo-border grid grid-cols-1 gap-3 bg-gray-50 p-3 lg:grid-cols-[minmax(190px,1fr)_300px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-black uppercase sm:text-base">{playerName(player)}</p>
          {isInBoard && <span className="neo-border bg-[#D7F8E8] px-2 py-0.5 text-[10px] font-black uppercase text-black">On Board</span>}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">{player.position || "--"} | {player.team || "FA"}</p>
      </div>
      <PlayerMiniStats player={player} weeksPlayed={player.weeks_played} />
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button onClick={() => onStats(player)} className="neo-btn bg-white p-2 text-black" title="Open player stats">
          <Info className="h-4 w-4" />
        </Button>
        <Button onClick={() => onAdd(player)} disabled={isBusy || isInBoard} className="neo-btn bg-[#00D9FF] p-2 text-black" title="Add to draft board">
          <Plus className="h-4 w-4" />
        </Button>
        {canDraft && (
          <Button onClick={() => onDraft(player.id)} disabled={isBusy} className="neo-btn bg-[#F7B801] px-4 text-black">
            Draft
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LeagueDraft() {
  const location = useLocation();
  const leagueId = new URLSearchParams(location.search).get("id");
  const queryClient = useQueryClient();
  const nowMs = useNowMs();
  const [searchInput, setSearchInput] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [positionFilter, setPositionFilter] = React.useState("ALL");
  const [sortBy, setSortBy] = React.useState("-avg_points");
  const [page, setPage] = React.useState(0);
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["draft-user"],
    queryFn: () => appClient.auth.me(),
  });

  const { data: state, isLoading } = useQuery({
    queryKey: ["league-draft-state", leagueId],
    queryFn: () => appClient.draftDay.getState(leagueId),
    enabled: !!leagueId,
    refetchInterval: 10000,
  });

  const draftId = state?.draft?.id;
  const currentMember = state?.members?.find((member) => member.user_email === user?.email || member.profile_id === user?.id);
  const isCommissioner = user && state?.league && (
    user.role === "admin" ||
    state.league.commissioner_email === user.email ||
    state.league.commissioner_id === user.id ||
    currentMember?.role_in_league === "COMMISSIONER"
  );
  const isOpen = String(state?.draft?.status || "").toUpperCase() === "OPEN";
  const isCompleted = String(state?.draft?.status || "").toUpperCase() === "COMPLETED";
  const canStart = isCommissioner && state?.draft?.start && Date.now() >= new Date(state.draft.start).getTime() && !isOpen && !isCompleted;
  const requiredWeeks = Number(state?.league?.season_length_weeks || 8) + 4;
  const seasonYear = Number(state?.league?.source_season_year || new Date().getFullYear() - 1);
  const currentTurnMember = state?.members?.find((member) => member.id === state?.currentTurn?.league_member_id);
  const isMyTurn = isOpen && currentMember?.id && currentMember.id === state?.currentTurn?.league_member_id;
  const countdown = isOpen ? "Live" : isCompleted ? "Complete" : formatCountdown(state?.draft?.start, nowMs);
  const pickRemaining = getPickRemaining(state?.room, nowMs);

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["league-draft-state", leagueId] });
    queryClient.invalidateQueries({ queryKey: ["draft-eligible-players", leagueId, draftId] });
  }, [draftId, leagueId, queryClient]);

  const { data: eligibleResult = { data: [], hasMore: false }, isFetching: isEligibleFetching } = useQuery({
    queryKey: ["draft-eligible-players", leagueId, draftId, searchTerm, positionFilter, sortBy, page],
    queryFn: () => appClient.draftDay.listEligiblePlayers({
      leagueId,
      draftId,
      searchTerm,
      position: positionFilter,
      sortBy,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    enabled: !!leagueId && !!currentMember,
    keepPreviousData: true,
    refetchInterval: isOpen ? 10000 : false,
  });

  React.useEffect(() => {
    if (!isOpen || !draftId) return undefined;
    const timer = window.setInterval(() => {
      appClient.functions.invoke("process_draft_timer", { draft_id: draftId }).then(invalidate).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [draftId, invalidate, isOpen]);

  const startMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("start_draft", { league_id: leagueId, draft_id: draftId }),
    onSuccess: () => {
      toast.success("Draft started.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to start draft."),
  });

  const pickMutation = useMutation({
    mutationFn: (playerId) => appClient.functions.invoke("submit_draft_pick", { draft_id: draftId, player_id: playerId }),
    onSuccess: () => {
      playPickChime();
      toast.success("Pick submitted.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to submit pick."),
  });

  const boardMutation = useMutation({
    mutationFn: ({ action, payload }) => {
      if (action === "add") return appClient.draftDay.addBoardItem(payload);
      if (action === "remove") return appClient.draftDay.removeBoardItem(payload.id);
      return appClient.draftDay.setBoardOrder(payload);
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message || "Could not update draft board."),
  });

  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
    setPage(0);
  };

  if (isLoading || isUserLoading) {
    return <div className="mx-auto max-w-5xl px-4"><div className="neo-card bg-white p-8 text-center font-black uppercase">Loading Draft...</div></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="neo-card bg-white p-8 text-center">
          <h1 className="text-3xl font-black uppercase text-orange-600">Login Required</h1>
          <p className="mt-2 font-bold text-gray-600">You need to be logged in to view this draft room.</p>
          <Link to={createPageUrl("Login")}>
            <Button className="neo-btn mt-5 bg-black text-white">Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!state?.league) {
    return <div className="text-center text-2xl font-bold text-red-500">League not found.</div>;
  }

  if (!currentMember) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="neo-card bg-white p-8 text-center">
          <h1 className="text-3xl font-black uppercase text-orange-600">League Access Only</h1>
          <p className="mt-2 font-bold text-gray-600">Only active members of this league can view the draft room.</p>
          <Link to={createPageUrl(`League?id=${leagueId}`)}>
            <Button className="neo-btn mt-5 bg-black text-white">Back to League</Button>
          </Link>
        </div>
      </div>
    );
  }

  const pickedIds = new Set((state.picks || []).map((pick) => pick.player_id));
  const board = (state.board || []).filter((item) => item.league_member_id === currentMember?.id && !pickedIds.has(item.player_id));
  const roster = (state.rosters || []).filter((slot) => slot.league_member_id === currentMember?.id);
  const boardPlayerIds = new Set(board.map((item) => item.player_id));
  const rosterNeeds = buildRosterNeeds(state.league, roster);
  const eligiblePlayers = eligibleResult.data || [];
  const commissioner = state.commissionerProfile;
  const commissionerName = commissioner?.display_name || commissioner?.profile_name || "Commissioner";
  const commissionerProfileUrl = commissioner?.profile_name ? createPageUrl(`Profile?name=${encodeURIComponent(commissioner.profile_name)}`) : null;

  const moveBoardItem = (index, direction) => {
    const next = [...board];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    boardMutation.mutate({
      action: "order",
      payload: { draftId, leagueMemberId: currentMember.id, playerIds: next.map((item) => item.player_id) },
    });
  };

  const addToBoard = (player) => {
    boardMutation.mutate({ action: "add", payload: { draftId, leagueMemberId: currentMember?.id, playerId: player.id } });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={createPageUrl(`League?id=${leagueId}`)}>
          <Button className="neo-btn bg-black text-white"><ArrowLeft className="mr-2 h-5 w-5" />Back to League</Button>
        </Link>
        {isCommissioner && (
          <Button onClick={() => startMutation.mutate()} disabled={!canStart || startMutation.isPending} className="neo-btn bg-[#F7B801] text-black">
            <Play className="mr-2 h-5 w-5" />Start Draft
          </Button>
        )}
      </div>

      <div className="neo-card mb-5 bg-black p-5 text-white">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr] lg:items-stretch">
          <section className="flex flex-col justify-center">
            <h1 className="text-3xl font-black uppercase text-[#FF6B35]">{state.league.name} Draft Day</h1>
            <p className="mt-2 text-lg font-black">Start: {formatDateTime(state.draft?.start)}</p>
            <p className="text-sm font-black uppercase text-[#00D9FF]">{countdown}</p>
          </section>

          <section className="neo-border flex items-center gap-4 bg-white p-4 text-black">
            <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden neo-border bg-gray-100">
              {commissioner?.avatar_url ? <img src={commissioner.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-7 w-7 text-gray-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-gray-500">Commissioner</p>
              <p className="truncate text-xl font-black uppercase">{commissionerName}</p>
              {commissionerProfileUrl ? (
                <Link to={commissionerProfileUrl} className="text-sm font-black uppercase text-[#00A6D6] underline">View Profile</Link>
              ) : (
                <p className="text-sm font-bold text-gray-500">Profile pending</p>
              )}
            </div>
          </section>

          <section className={`neo-border p-4 ${isMyTurn ? "bg-[#F7B801] text-black" : "bg-white text-black"}`}>
            <p className="text-xs font-black uppercase text-gray-500">On The Clock</p>
            <p className="mt-1 truncate text-2xl font-black uppercase">{isMyTurn ? "DRAFT NOW" : memberName(currentTurnMember) || "Waiting"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="neo-border bg-gray-50 p-2">
                <p className="text-xs font-black uppercase text-gray-500">Pick</p>
                <p className="text-xl font-black">{state.room?.current_pick || 1}</p>
              </div>
              <div className="neo-border bg-gray-50 p-2">
                <p className="text-xs font-black uppercase text-gray-500">Timer</p>
                <p className="text-xl font-black">{isOpen ? `${pickRemaining}s` : "--"}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="neo-card mb-8 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-black uppercase text-orange-600">
          <Trophy className="h-5 w-5" />Draft Order
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(state.turns?.length ? state.turns : state.members || []).map((turnOrMember, index) => {
            const isTurn = Boolean(turnOrMember.league_member_id);
            const turn = isTurn ? turnOrMember : null;
            const member = isTurn ? state.members.find((item) => item.id === turn.league_member_id) : turnOrMember;
            const pick = turn ? state.picks.find((item) => Number(item.overall_pick) === Number(turn.overall_pick)) : null;
            const isCurrent = turn && Number(turn.overall_pick) === Number(state.room?.current_pick);
            return (
              <div key={turn?.id || member?.id || index} className={`neo-border w-44 flex-none p-2 text-xs ${isCurrent ? "bg-[#F7B801]" : pick ? "bg-[#D7F8E8]" : "bg-gray-50"}`}>
                <p className="font-black uppercase">{turn ? `#${turn.overall_pick} R${turn.round}` : `Team ${index + 1}`}</p>
                <p className="truncate font-black">{memberName(member)}</p>
                <p className="truncate font-bold text-gray-600">{pick ? playerName(pick.player) : turn ? "Pending" : "Registered"}</p>
              </div>
            );
          })}
          {!state.turns?.length && !state.members?.length && (
            <div className="neo-border bg-gray-50 p-3 text-sm font-bold text-gray-500">Teams will appear here as managers join.</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <main className="space-y-8">
          <section className={`neo-card bg-white p-5 ${isMyTurn ? "shadow-[8px_8px_0_#F7B801]" : ""}`}>
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-2xl font-black uppercase text-orange-600">{isMyTurn ? "DRAFT NOW" : "Eligible Players"}</h2>
                  <p className="text-sm font-bold text-gray-600">Minimum weeks required: {requiredWeeks}{isMyTurn ? ` | ${pickRemaining}s remaining` : ""}</p>
                </div>
                <div className="neo-border bg-[#EFFBFF] p-3">
                  <p className="mb-2 text-xs font-black uppercase text-gray-500">Players Needed</p>
                  <div className="flex flex-wrap gap-2">
                    {rosterNeeds.map((need) => (
                      <span key={need.position} className={`neo-border px-2 py-1 text-xs font-black uppercase ${need.remaining ? "bg-white text-black" : "bg-[#D7F8E8] text-black"}`}>
                        {need.position} {need.remaining}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSearch();
                    }}
                    placeholder="Search by name..."
                    className="neo-border pl-11 font-bold"
                  />
                </div>
                <Select value={positionFilter} onValueChange={(value) => {
                  setPositionFilter(value);
                  setPage(0);
                }}>
                  <SelectTrigger className="neo-border w-full font-bold sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((position) => (
                      <SelectItem key={position} value={position}>{position === "ALL" ? "All Pos" : position}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value) => {
                  setSortBy(value);
                  setPage(0);
                }}>
                  <SelectTrigger className="neo-border w-full font-bold sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-avg_points">Average Points</SelectItem>
                    <SelectItem value="-total_points">Total Points</SelectItem>
                    <SelectItem value="-high_score">High Score</SelectItem>
                    <SelectItem value="-low_score">Low Score</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} className="neo-btn bg-[#00D9FF] text-black">
                  <Search className="mr-2 h-5 w-5" />Search
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {eligiblePlayers.map((player) => (
                <DraftPlayerRow
                  key={player.id}
                  player={player}
                  canDraft={isMyTurn}
                  onAdd={addToBoard}
                  onDraft={(playerId) => pickMutation.mutate(playerId)}
                  onStats={setSelectedPlayer}
                  isInBoard={boardPlayerIds.has(player.id)}
                  isBusy={!draftId || !currentMember || pickedIds.has(player.id) || boardMutation.isPending || pickMutation.isPending}
                />
              ))}
              {!eligiblePlayers.length && (
                <div className="neo-border bg-gray-50 p-6 text-center font-bold text-gray-500">
                  {isEligibleFetching ? "Loading players..." : "No eligible players found."}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <Button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} className="neo-btn bg-white">
                <ChevronsLeft className="h-5 w-5" />
              </Button>
              <span className="text-lg font-bold">Page {page + 1}</span>
              <Button onClick={() => setPage((value) => value + 1)} disabled={!eligibleResult.hasMore} className="neo-btn bg-white">
                <ChevronsRight className="h-5 w-5" />
              </Button>
            </div>
          </section>
        </main>

        <aside className="space-y-8">
          <section className="neo-card bg-white p-5">
            <h2 className="mb-4 text-2xl font-black uppercase text-orange-600">My Draft Board</h2>
            <div className="space-y-3">
              {board.map((item, index) => (
                <div key={item.id} className="neo-border bg-gray-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-black uppercase">{playerName(item.player)}</p>
                      <p className="text-xs font-bold text-gray-500">{item.player?.team || "FA"} | {item.player?.position || "--"}</p>
                    </div>
                    <div className="flex flex-none gap-1">
                      <Button onClick={() => moveBoardItem(index, -1)} disabled={index === 0 || boardMutation.isPending} className="neo-btn bg-white p-2 text-black"><ArrowUp className="h-4 w-4" /></Button>
                      <Button onClick={() => moveBoardItem(index, 1)} disabled={index === board.length - 1 || boardMutation.isPending} className="neo-btn bg-white p-2 text-black"><ArrowDown className="h-4 w-4" /></Button>
                      <Button onClick={() => boardMutation.mutate({ action: "remove", payload: { id: item.id } })} disabled={boardMutation.isPending} className="neo-btn bg-red-500 p-2 text-white"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <PlayerMiniStats player={item.player} weeksPlayed={item.weeks_played} />
                </div>
              ))}
              {!board.length && <p className="text-sm font-bold text-gray-500">Add players from the eligible list to protect your draft plan.</p>}
            </div>
          </section>

          <section className="neo-card bg-white p-5">
            <h2 className="mb-4 text-2xl font-black uppercase text-orange-600">Roster</h2>
            <div className="space-y-2">
              {roster.map((slot) => (
                <div key={slot.id} className="neo-border bg-gray-50 p-3">
                  <p className="truncate font-black uppercase">{playerName(slot.player)}</p>
                  <p className="text-xs font-bold text-gray-500">{slot.slot_type}</p>
                </div>
              ))}
              {!roster.length && <p className="text-sm font-bold text-gray-500">Draft picks will appear here.</p>}
            </div>
          </section>
        </aside>
      </div>

      <PlayerStatsDialog
        player={selectedPlayer}
        seasonYear={seasonYear}
        open={!!selectedPlayer}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayer(null);
        }}
      />
    </div>
  );
}
