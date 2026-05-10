import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CalendarDays, Eye, FastForward, Lock, Pause, Play, RefreshCw, Save, ShieldCheck, Unlock } from "lucide-react";
import { toast } from "sonner";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_LEAGUE_PLAY_SETTINGS } from "@/api/appClient";
import { LeaguePlayFields, ScheduleConfigFields } from "@/components/league/LeagueConfigFields";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function LeagueScheduleSettings({ league }) {
  const queryClient = useQueryClient();
  const [playSettings, setPlaySettings] = useState({
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    ...league,
    schedule_config: { ...DEFAULT_LEAGUE_PLAY_SETTINGS.schedule_config, ...(league.schedule_config || {}) },
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ["league-seasons", league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id }),
  });
  const { data: weeks = [] } = useQuery({
    queryKey: ["league-weeks", league.id],
    queryFn: () => appClient.entities.Week.filter({ league_id: league.id }),
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["league-game-schedule", league.id],
    queryFn: () => appClient.entities.GameSchedule.filter({ league_id: league.id }, "week_number"),
  });
  const { data: matchups = [] } = useQuery({
    queryKey: ["league-matchups", league.id],
    queryFn: () => appClient.entities.Matchup.filter({ league_id: league.id }, "week_number"),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["league-schedule-members", league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
  });

  const activeSeason = seasons[0];
  const currentWeekNumber = activeSeason?.current_week || 1;
  const { data: currentWeekLineups = [] } = useQuery({
    queryKey: ["league-lineups", league.id, currentWeekNumber],
    queryFn: () => appClient.entities.Lineup.filter({ league_id: league.id, week_number: currentWeekNumber }),
    enabled: Boolean(league.id && currentWeekNumber),
  });
  const currentWeek = weeks.find((week) => Number(week.week_number) === Number(currentWeekNumber));
  const leagueStarted = seasons.length > 0;
  const isPaused = league.league_status === "PAUSED";
  const scheduleLocked = playSettings.schedule_config?.schedule_locked === true;
  const scheduleFieldsLocked = scheduleLocked || leagueStarted;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-seasons", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-weeks", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-schedule", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-game-schedule", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-matchups", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-lineups", league.id, currentWeekNumber] });
    queryClient.invalidateQueries({ queryKey: ["league-standings", league.id, league.ranking_system] });
  };

  const saveScheduleMutation = useMutation({
    mutationFn: () => appClient.entities.League.update(league.id, {
      schedule_type: playSettings.schedule_type,
      ranking_system: playSettings.ranking_system,
      advancement_mode: playSettings.advancement_mode,
      playoff_mode: playSettings.playoff_mode,
      playoff_start_week: Number(playSettings.playoff_start_week) || 9,
      playoff_team_count: Number(playSettings.playoff_team_count) || 4,
      schedule_config: playSettings.schedule_config,
    }),
    onSuccess: () => {
      toast.success("Schedule settings saved.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to save schedule settings."),
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }) => appClient.functions.invoke(action, payload),
    onSuccess: (_, variables) => {
      const labels = {
        start_season: "Season framework created.",
        open_week_draft: "Draft room opened.",
        pause_league: "League paused.",
        resume_league: "League resumed.",
        advance_week: "Advanced to next week.",
        resolve_week: "Week resolved.",
        reveal_week_results: "Results revealed.",
        recalculate_standings: "Standings recalculated.",
        generate_schedule: "Schedule generated.",
        generate_ai_lineups: "AI lineups rebuilt.",
      };
      toast.success(labels[variables.action] || "Action complete.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "League operation failed."),
  });

  const updateWeekMutation = useMutation({
    mutationFn: async ({ status }) => {
      const { data, error } = await supabase
        .from("league_weeks")
        .upsert(
          {
            league_id: league.id,
            week_number: currentWeekNumber,
            status,
            reveal_state: currentWeek?.reveal_state || "hidden",
          },
          { onConflict: "league_id,week_number" }
        )
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Week status updated.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update week status."),
  });

  const toggleScheduleLockMutation = useMutation({
    mutationFn: () => {
      const scheduleConfig = { ...(playSettings.schedule_config || {}), schedule_locked: !scheduleLocked };
      return appClient.entities.League.update(league.id, { schedule_config: scheduleConfig });
    },
    onSuccess: () => {
      setPlaySettings((current) => ({
        ...current,
        schedule_config: { ...(current.schedule_config || {}), schedule_locked: !scheduleLocked },
      }));
      toast.success(scheduleLocked ? "Schedule unlocked." : "Schedule locked.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update schedule lock."),
  });

  const run = (action, payload = {}) => actionMutation.mutate({ action, payload: { league_id: league.id, ...payload } });
  const currentWeekMatchups = matchups.filter((matchup) => Number(matchup.week_number) === Number(currentWeekNumber));
  const activeMembers = members.filter((member) => member.is_active !== false);
  const submittedLineups = currentWeekLineups.filter((lineup) => lineup.finalized_at);
  const lineupReady = activeMembers.length > 0 && submittedLineups.length >= activeMembers.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">Schedule</h3>
        <p className="text-sm font-bold text-gray-600">
          Generate the season schedule, lock it when final, then manage weekly season operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="neo-border p-4 bg-[#EFFBFF]">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Status</p>
          <p className="text-lg font-black">{league.league_status || (leagueStarted ? "ACTIVE" : "RECRUITING")}</p>
        </div>
        <div className="neo-border p-4 bg-white">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Current Week</p>
          <p className="text-lg font-black">{leagueStarted ? currentWeekNumber : "Not Started"}</p>
        </div>
        <div className="neo-border p-4 bg-white">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Week State</p>
          <p className="text-lg font-black">{currentWeek?.status || "None"}</p>
        </div>
        <div className="neo-border p-4 bg-white">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Schedule Lock</p>
          <p className="text-lg font-black">{scheduleLocked ? "Locked" : "Unlocked"}</p>
        </div>
        <div className="neo-border p-4 bg-white md:col-span-4">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Lineups Ready</p>
          <p className="text-lg font-black">{submittedLineups.length} / {activeMembers.length || 0}</p>
          <p className="mt-1 text-xs font-bold uppercase text-gray-500">{lineupReady ? "Ready to resolve" : "Resolve Week stays locked until every active team finalizes."}</p>
        </div>
      </div>

      <div className="neo-card bg-white p-6">
        <h4 className="text-xl font-black uppercase mb-4">Schedule Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <LeaguePlayFields
            value={playSettings}
            onChange={setPlaySettings}
            disabled={scheduleFieldsLocked}
            compactLabels
            showDescriptions
            fields={["schedule_type", "ranking_system"]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <LeaguePlayFields
            value={playSettings}
            onChange={setPlaySettings}
            disabled={scheduleFieldsLocked}
            compactLabels
            showDescriptions
            showPlayoffDetails
            fields={["advancement_mode", "playoff_mode"]}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ScheduleConfigFields
            value={playSettings.schedule_config}
            onChange={(scheduleConfig) => setPlaySettings({ ...playSettings, schedule_config: scheduleConfig })}
            disabled={scheduleFieldsLocked}
          />
        </div>
        <Button onClick={() => saveScheduleMutation.mutate()} disabled={saveScheduleMutation.isPending || scheduleFieldsLocked} className="neo-btn bg-[#00D9FF] text-black w-full mt-6">
          <Save className="w-5 h-5 mr-2" />
          {scheduleFieldsLocked ? "Schedule Settings Locked" : "Save Schedule Settings"}
        </Button>
      </div>

      <div className="neo-card bg-white p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-xl font-black uppercase">Generated Schedule</h4>
            <p className="text-sm font-bold text-gray-600">{matchups.length} matchups across {schedules.length || 0} scheduled weeks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("generate_schedule", { force: true })} disabled={actionMutation.isPending || scheduleLocked} className="neo-btn bg-[#F7B801] text-black">
              <CalendarDays className="w-5 h-5 mr-2" />
              Generate Schedule
            </Button>
            <Button onClick={() => toggleScheduleLockMutation.mutate()} disabled={toggleScheduleLockMutation.isPending} className="neo-btn bg-white text-black">
              {scheduleLocked ? <Unlock className="w-5 h-5 mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
              {scheduleLocked ? "Unlock Schedule" : "Lock Schedule"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {schedules.slice(0, 9).map((item) => (
            <div key={item.id} className="neo-border p-3 bg-gray-50">
              <p className="font-black uppercase">Week {item.week_number}</p>
              <p className="text-xs font-bold text-gray-600">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "Unscheduled"}</p>
              <p className="text-xs font-black text-[#6A4C93]">{item.status}</p>
            </div>
          ))}
          {!schedules.length && <p className="text-sm font-bold text-gray-600">Generate the full regular-season schedule before starting the season.</p>}
        </div>
        {currentWeekMatchups.length > 0 && (
          <div className="mt-4 neo-border bg-[#F7F7F7] p-4">
            <p className="mb-2 text-sm font-black uppercase">Current Week Matchups</p>
            <p className="text-sm font-bold text-gray-700">{currentWeekMatchups.length} games are ready for Week {currentWeekNumber}.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Button onClick={() => run("start_season", { source_season_year: league.source_season_year })} disabled={actionMutation.isPending || leagueStarted} className="neo-btn bg-black text-white py-4">
          <Play className="w-5 h-5 mr-2" />
          Start Season
        </Button>
        <Button onClick={() => run("open_week_draft", { week_number: currentWeekNumber, timer_seconds: DEFAULT_DRAFT_CONFIG.timer_seconds, type: league.draft_config?.type || DEFAULT_DRAFT_CONFIG.type })} disabled={actionMutation.isPending} className="neo-btn bg-[#F7B801] text-black py-4">
          <RefreshCw className="w-5 h-5 mr-2" />
          Open Current Draft
        </Button>
        <Button onClick={() => run(isPaused ? "resume_league" : "pause_league")} disabled={actionMutation.isPending} className="neo-btn bg-[#6A4C93] text-white py-4">
          <Pause className="w-5 h-5 mr-2" />
          {isPaused ? "Resume League" : "Pause League"}
        </Button>
        <Button onClick={() => updateWeekMutation.mutate({ status: currentWeek?.status === "LOCKED" ? "LINEUPS_OPEN" : "LOCKED" })} disabled={updateWeekMutation.isPending || !leagueStarted} className="neo-btn bg-white text-black py-4">
          {currentWeek?.status === "LOCKED" ? <Unlock className="w-5 h-5 mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
          {currentWeek?.status === "LOCKED" ? "Unlock Week" : "Lock Week"}
        </Button>
        <Button onClick={() => run("advance_week")} disabled={actionMutation.isPending || !leagueStarted} className="neo-btn bg-white text-black py-4">
          <FastForward className="w-5 h-5 mr-2" />
          Advance Week
        </Button>
        <Button onClick={() => run("generate_ai_lineups", { week_number: currentWeekNumber, force: true })} disabled={actionMutation.isPending || !leagueStarted} className="neo-btn bg-[#D7F8E8] text-black py-4">
          <Bot className="w-5 h-5 mr-2" />
          Rebuild AI Lineups
        </Button>
        <Button onClick={() => run("resolve_week", { week_number: currentWeekNumber })} disabled={actionMutation.isPending || !leagueStarted || !lineupReady} title={lineupReady ? "Resolve week" : "All active teams must finalize lineups first."} className="neo-btn bg-white text-black py-4">
          <ShieldCheck className="w-5 h-5 mr-2" />
          Resolve Week
        </Button>
        <Button onClick={() => run("reveal_week_results", { week_number: currentWeekNumber })} disabled={actionMutation.isPending || !leagueStarted} className="neo-btn bg-white text-black py-4">
          <Eye className="w-5 h-5 mr-2" />
          Reveal Results
        </Button>
        <Button onClick={() => run("recalculate_standings")} disabled={actionMutation.isPending || !leagueStarted} className="neo-btn bg-[#FF6B35] text-white py-4">
          Recalculate Standings
        </Button>
      </div>
    </div>
  );
}
