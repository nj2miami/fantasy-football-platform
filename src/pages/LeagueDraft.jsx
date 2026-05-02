import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowDown, ArrowUp, Clock3, Play, Plus, Search, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatDateTime(value) {
  if (!value) return "Unscheduled";
  return new Date(value).toLocaleString();
}

function useCountdown(target) {
  const [nowMs, setNowMs] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!target) return "Set a draft time";
  const remaining = Math.max(0, new Date(target).getTime() - nowMs);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function PlayerMiniStats({ player, weeksPlayed }) {
  return (
    <div className="grid grid-cols-5 gap-2 text-center text-xs font-black uppercase">
      <div><p className="text-gray-500">Tot</p><p>{Number(player?.total_points || 0).toFixed(1)}</p></div>
      <div><p className="text-gray-500">Avg</p><p>{Number(player?.avg_points || 0).toFixed(1)}</p></div>
      <div><p className="text-gray-500">High</p><p>{Number(player?.high_score || 0).toFixed(1)}</p></div>
      <div><p className="text-gray-500">Low</p><p>{Number(player?.low_score || 0).toFixed(1)}</p></div>
      <div><p className="text-gray-500">Wks</p><p>{weeksPlayed ?? "--"}</p></div>
    </div>
  );
}

export default function LeagueDraft() {
  const location = useLocation();
  const leagueId = new URLSearchParams(location.search).get("id");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [scheduleValue, setScheduleValue] = React.useState("");

  const { data: user } = useQuery({
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
  const countdown = useCountdown(state?.draft?.start);
  const requiredWeeks = Number(state?.league?.season_length_weeks || 8) + 4;
  const currentTurnMember = state?.members?.find((member) => member.id === state?.currentTurn?.league_member_id);
  const isMyTurn = isOpen && currentMember?.id && currentMember.id === state?.currentTurn?.league_member_id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league-draft-state", leagueId] });
    queryClient.invalidateQueries({ queryKey: ["draft-eligible-players", leagueId, draftId, searchTerm] });
  };

  const { data: eligiblePlayers = [] } = useQuery({
    queryKey: ["draft-eligible-players", leagueId, draftId, searchTerm],
    queryFn: () => appClient.draftDay.listEligiblePlayers({ leagueId, draftId, searchTerm, limit: 80 }),
    enabled: !!leagueId,
    refetchInterval: isOpen ? 10000 : false,
  });

  React.useEffect(() => {
    if (state?.draft?.start) {
      const date = new Date(state.draft.start);
      setScheduleValue(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [state?.draft?.start]);

  React.useEffect(() => {
    if (!isOpen || !draftId) return undefined;
    const timer = window.setInterval(() => {
      appClient.functions.invoke("process_draft_timer", { draft_id: draftId }).then(invalidate).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [draftId, isOpen]);

  const scheduleMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("schedule_draft", {
      league_id: leagueId,
      start: new Date(scheduleValue).toISOString(),
      type: state?.league?.draft_config?.type || "snake",
    }),
    onSuccess: () => {
      toast.success("Draft scheduled.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to schedule draft."),
  });

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

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-4"><div className="neo-card bg-white p-8 text-center font-black uppercase">Loading Draft...</div></div>;
  }

  if (!state?.league) {
    return <div className="text-center font-bold text-2xl text-red-500">League not found.</div>;
  }

  const board = (state.board || []).filter((item) => item.league_member_id === currentMember?.id);
  const pickedIds = new Set((state.picks || []).map((pick) => pick.player_id));
  const roster = (state.rosters || []).filter((slot) => slot.league_member_id === currentMember?.id);

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

      <div className="neo-card mb-8 bg-black p-8 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-[#00D9FF]">{state.league.name}</p>
            <h1 className="text-4xl font-black uppercase text-[#FF6B35]">Draft Day</h1>
            <p className="mt-2 text-lg font-black">Draft Scheduled: {formatDateTime(state.draft?.start)}</p>
          </div>
          <div className="neo-border bg-white p-5 text-black">
            <p className="text-xs font-black uppercase text-gray-500">Countdown</p>
            <p className="text-3xl font-black">{isOpen ? "Live" : isCompleted ? "Complete" : countdown}</p>
          </div>
        </div>
        {isCommissioner && !isOpen && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Input type="datetime-local" value={scheduleValue} onChange={(event) => setScheduleValue(event.target.value)} className="neo-border bg-white font-bold text-black" />
            <Button onClick={() => scheduleMutation.mutate()} disabled={!scheduleValue || scheduleMutation.isPending} className="neo-btn bg-[#00D9FF] text-black">
              <Clock3 className="mr-2 h-5 w-5" />Schedule Draft
            </Button>
          </div>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(state.members || []).map((member) => (
          <div key={member.id} className="neo-border bg-white p-4">
            <p className="font-black uppercase">{member.team_name}</p>
            <p className="text-xs font-bold text-gray-500">{member.is_ai ? "AI Manager" : member.user_email}</p>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="neo-card bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black uppercase text-orange-600">
              <Trophy className="h-6 w-6" />Active Draft Board
            </h2>
            <div className="mb-4 neo-border bg-[#EFFBFF] p-4">
              <p className="text-xs font-black uppercase text-gray-500">On The Clock</p>
              <p className="text-2xl font-black">{currentTurnMember?.team_name || "Draft complete"}</p>
              <p className="text-sm font-bold text-gray-600">Pick {state.room?.current_pick || 1}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(state.turns || []).map((turn) => {
                const member = state.members.find((item) => item.id === turn.league_member_id);
                const pick = state.picks.find((item) => Number(item.overall_pick) === Number(turn.overall_pick));
                return (
                  <div key={turn.id} className={`neo-border p-3 ${Number(turn.overall_pick) === Number(state.room?.current_pick) ? "bg-[#F7B801]" : "bg-gray-50"}`}>
                    <p className="text-xs font-black uppercase text-gray-500">Pick {turn.overall_pick} | Round {turn.round}</p>
                    <p className="font-black">{member?.team_name || "Team"}</p>
                    <p className="text-sm font-bold text-gray-600">{pick?.player?.player_display_name || pick?.player?.full_name || "Pending"}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="neo-card bg-white p-6">
            <h3 className="mb-4 text-xl font-black uppercase">Roster</h3>
            <div className="space-y-2">
              {roster.map((slot) => (
                <div key={slot.id} className="neo-border bg-gray-50 p-3">
                  <p className="font-black">{slot.player?.player_display_name || slot.player?.full_name || slot.player_id}</p>
                  <p className="text-xs font-bold text-gray-500">{slot.slot_type}</p>
                </div>
              ))}
              {!roster.length && <p className="text-sm font-bold text-gray-500">Draft picks will appear here.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">
        <div className="neo-card bg-white p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-black uppercase text-orange-600">Eligible Players</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search players" className="neo-border pl-9 font-bold" />
            </div>
          </div>
          <p className="mb-4 text-sm font-bold text-gray-600">Minimum weeks required: {requiredWeeks}</p>
          <div className="space-y-3">
            {eligiblePlayers.map((player) => (
              <div key={player.id} className="neo-border grid grid-cols-1 gap-3 bg-gray-50 p-4 xl:grid-cols-[1fr_340px_auto] xl:items-center">
                <div>
                  <p className="font-black">{player.player_display_name || player.full_name}</p>
                  <p className="text-xs font-bold text-gray-500">{player.team || "FA"} | {player.position}</p>
                </div>
                <PlayerMiniStats player={player} weeksPlayed={player.weeks_played} />
                <div className="flex gap-2">
                  <Button
                    onClick={() => boardMutation.mutate({ action: "add", payload: { draftId, leagueMemberId: currentMember?.id, playerId: player.id } })}
                    disabled={!draftId || !currentMember || pickedIds.has(player.id)}
                    className="neo-btn bg-[#00D9FF] text-black"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {isMyTurn && (
                    <Button onClick={() => pickMutation.mutate(player.id)} disabled={pickMutation.isPending} className="neo-btn bg-[#F7B801] text-black">
                      Draft
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="neo-card bg-white p-6">
          <h2 className="mb-4 text-2xl font-black uppercase text-orange-600">My Draft Board</h2>
          <div className="space-y-3">
            {board.map((item, index) => (
              <div key={item.id} className="neo-border bg-gray-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{item.player?.player_display_name || item.player?.full_name || item.player_id}</p>
                    <p className="text-xs font-bold text-gray-500">{item.player?.team || "FA"} | {item.player?.position}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button onClick={() => moveBoardItem(index, -1)} disabled={index === 0 || boardMutation.isPending} className="neo-btn bg-white p-2 text-black"><ArrowUp className="h-4 w-4" /></Button>
                    <Button onClick={() => moveBoardItem(index, 1)} disabled={index === board.length - 1 || boardMutation.isPending} className="neo-btn bg-white p-2 text-black"><ArrowDown className="h-4 w-4" /></Button>
                    <Button onClick={() => boardMutation.mutate({ action: "remove", payload: { id: item.id } })} disabled={boardMutation.isPending} className="neo-btn bg-red-500 p-2 text-white"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <PlayerMiniStats player={item.player} weeksPlayed={item.weeks_played} />
              </div>
            ))}
            {!board.length && <p className="text-sm font-bold text-gray-500">Add players from the eligible list to protect yourself if you miss draft day.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
