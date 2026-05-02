import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Play, RefreshCw, Eye, FastForward, Lock, Unlock, Pause, Save } from "lucide-react";
import { toast } from "sonner";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_LEAGUE_PLAY_SETTINGS } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LeagueDraftSettings({ league }) {
  const queryClient = useQueryClient();
  const [draftConfig, setDraftConfig] = useState({ ...DEFAULT_DRAFT_CONFIG, ...(league.draft_config || {}) });
  const [playSettings, setPlaySettings] = useState({
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    ...league,
    schedule_config: { ...DEFAULT_LEAGUE_PLAY_SETTINGS.schedule_config, ...(league.schedule_config || {}) },
  });
  const [sourceSeasonYear, setSourceSeasonYear] = useState(league.source_season_year || new Date().getFullYear() - 1);
  const [draftStart, setDraftStart] = useState("");

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
  const { data: drafts = [] } = useQuery({
    queryKey: ["league-drafts", league.id],
    queryFn: () => appClient.entities.Draft.filter({ league_id: league.id }, "-created_date"),
  });

  const activeSeason = seasons[0];
  const currentWeekNumber = activeSeason?.current_week || 1;
  const currentWeek = weeks.find((week) => Number(week.week_number) === Number(currentWeekNumber));
  const leagueStarted = seasons.length > 0;
  const isPaused = league.league_status === "PAUSED";
  const scheduledDraft = drafts.find((draft) => ["SCHEDULED", "OPEN"].includes(String(draft.status || "").toUpperCase())) || drafts[0];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-seasons", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-weeks", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-drafts", league.id] });
  };

  React.useEffect(() => {
    if (!scheduledDraft?.start) return;
    const date = new Date(scheduledDraft.start);
    setDraftStart(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }, [scheduledDraft?.start]);

  const saveDraftMutation = useMutation({
    mutationFn: () => appClient.entities.League.update(league.id, {
      draft_config: draftConfig,
      source_season_year: sourceSeasonYear,
      mode: playSettings.draft_mode === "weekly_redraft" ? "weekly_redraft" : "traditional",
      draft_mode: playSettings.draft_mode,
      player_retention_mode: playSettings.draft_mode === "weekly_redraft" ? "retained" : playSettings.player_retention_mode,
      schedule_type: playSettings.schedule_type,
      ranking_system: playSettings.ranking_system,
      advancement_mode: playSettings.advancement_mode,
      playoff_mode: playSettings.playoff_mode,
      playoff_start_week: Number(playSettings.playoff_start_week) || 9,
      playoff_team_count: Number(playSettings.playoff_team_count) || 4,
      schedule_config: playSettings.schedule_config,
    }),
    onSuccess: () => {
      toast.success("Draft settings saved.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to save draft settings."),
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
      };
      toast.success(labels[variables.action] || "Action complete.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "League operation failed."),
  });

  const updateWeekMutation = useMutation({
    mutationFn: ({ status }) => {
      if (!currentWeek) {
        return appClient.entities.Week.create({
          league_id: league.id,
          week_number: currentWeekNumber,
          status,
          reveal_state: "hidden",
        });
      }
      return appClient.entities.Week.update(currentWeek.id, { status });
    },
    onSuccess: () => {
      toast.success("Week status updated.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update week status."),
  });

  const scheduleDraftMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("schedule_draft", {
      league_id: league.id,
      start: new Date(draftStart).toISOString(),
      type: draftConfig.type,
    }),
    onSuccess: () => {
      toast.success("Draft scheduled.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to schedule draft."),
  });

  const run = (action, payload = {}) => actionMutation.mutate({ action, payload: { league_id: league.id, ...payload } });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">Season Operations</h3>
        <p className="text-sm font-bold text-gray-600">
          Configure draft defaults before kickoff, then run week and standings operations from one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="neo-border p-4 bg-[#EFFBFF]">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Mode</p>
          <p className="text-lg font-black">{playSettings.draft_mode === "weekly_redraft" ? "Weekly Redraft" : "Season Snake"}</p>
        </div>
        <div className="neo-border p-4 bg-white">
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
      </div>

      <div className="neo-card bg-white p-6">
        <h4 className="text-xl font-black uppercase mb-4">League Play Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Draft Cadence</Label>
            <Select value={playSettings.draft_mode} onValueChange={(value) => setPlaySettings({ ...playSettings, draft_mode: value, player_retention_mode: value === "weekly_redraft" ? "retained" : playSettings.player_retention_mode })} disabled={leagueStarted}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="season_snake">Season Snake</SelectItem>
                <SelectItem value="weekly_redraft">Weekly Redraft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Retention</Label>
            <Select value={playSettings.player_retention_mode} onValueChange={(value) => setPlaySettings({ ...playSettings, player_retention_mode: value })} disabled={leagueStarted || playSettings.draft_mode === "weekly_redraft"}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retained">Retained</SelectItem>
                <SelectItem value="two_use_release">Two-Use Release</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Schedule</Label>
            <Select value={playSettings.schedule_type} onValueChange={(value) => setPlaySettings({ ...playSettings, schedule_type: value })} disabled={leagueStarted}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="head_to_head">Head to Head</SelectItem>
                <SelectItem value="league_wide">League Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Ranking</Label>
            <Select value={playSettings.ranking_system} onValueChange={(value) => setPlaySettings({ ...playSettings, ranking_system: value })} disabled={leagueStarted}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="offl">OFFL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Advancement</Label>
            <Select value={playSettings.advancement_mode} onValueChange={(value) => setPlaySettings({ ...playSettings, advancement_mode: value })}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automatic">Automatic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Playoff Mode</Label>
            <Select value={playSettings.playoff_mode} onValueChange={(value) => setPlaySettings({ ...playSettings, playoff_mode: value })} disabled={leagueStarted}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="roster_only">Roster Only</SelectItem>
                <SelectItem value="redraft">Redraft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Playoff Start Week</Label>
            <Input type="number" min="2" value={playSettings.playoff_start_week} disabled={leagueStarted} onChange={(event) => setPlaySettings({ ...playSettings, playoff_start_week: Number(event.target.value) || 9 })} className="neo-border font-bold" />
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Playoff Teams</Label>
            <Input type="number" min="2" value={playSettings.playoff_team_count} disabled={leagueStarted} onChange={(event) => setPlaySettings({ ...playSettings, playoff_team_count: Number(event.target.value) || 4 })} className="neo-border font-bold" />
          </div>
        </div>
        <h4 className="text-xl font-black uppercase mb-4">Draft Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Draft Type</Label>
            <Select
              value={draftConfig.type}
              onValueChange={(value) => setDraftConfig({ ...draftConfig, type: value })}
              disabled={leagueStarted}
            >
              <SelectTrigger className="neo-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="snake">Snake</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Rounds</Label>
            <Input type="number" min="1" value={draftConfig.rounds} disabled={leagueStarted} onChange={(event) => setDraftConfig({ ...draftConfig, rounds: Number(event.target.value) || 1 })} className="neo-border font-bold" />
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Timer Seconds</Label>
            <Input type="number" min="10" value={draftConfig.timer_seconds} disabled={leagueStarted} onChange={(event) => setDraftConfig({ ...draftConfig, timer_seconds: Number(event.target.value) || 60 })} className="neo-border font-bold" />
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Source Year</Label>
            <Input type="number" value={sourceSeasonYear} disabled={leagueStarted} onChange={(event) => setSourceSeasonYear(Number(event.target.value) || sourceSeasonYear)} className="neo-border font-bold" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Schedule Pattern</Label>
            <Select value={playSettings.schedule_config.type} onValueChange={(value) => setPlaySettings({ ...playSettings, schedule_config: { ...playSettings.schedule_config, type: value } })} disabled={leagueStarted}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_day">One Day</SelectItem>
                <SelectItem value="interval">Every X Days</SelectItem>
                <SelectItem value="preset">Preset Dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Start Date</Label>
            <Input type="date" value={playSettings.schedule_config.start_date || ""} disabled={leagueStarted} onChange={(event) => setPlaySettings({ ...playSettings, schedule_config: { ...playSettings.schedule_config, start_date: event.target.value } })} className="neo-border font-bold" />
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Games / Period</Label>
            <Input type="number" min="1" value={playSettings.schedule_config.games_per_period || 1} disabled={leagueStarted} onChange={(event) => setPlaySettings({ ...playSettings, schedule_config: { ...playSettings.schedule_config, games_per_period: Number(event.target.value) || 1 } })} className="neo-border font-bold" />
          </div>
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Period Days</Label>
            <Input type="number" min="1" value={playSettings.schedule_config.period_days || 7} disabled={leagueStarted} onChange={(event) => setPlaySettings({ ...playSettings, schedule_config: { ...playSettings.schedule_config, period_days: Number(event.target.value) || 7 } })} className="neo-border font-bold" />
          </div>
        </div>
        <Button onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending || leagueStarted} className="neo-btn bg-[#00D9FF] text-black w-full mt-4">
          <Save className="w-5 h-5 mr-2" />
          {leagueStarted ? "Locked After Start" : "Save Draft Settings"}
        </Button>
      </div>

      <div className="neo-card bg-white p-6">
        <h4 className="text-xl font-black uppercase mb-4">Generated Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {schedules.slice(0, 9).map((item) => (
            <div key={item.id} className="neo-border p-3 bg-gray-50">
              <p className="font-black uppercase">Week {item.week_number}</p>
              <p className="text-xs font-bold text-gray-600">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "Unscheduled"}</p>
              <p className="text-xs font-black text-[#6A4C93]">{item.status}</p>
            </div>
          ))}
          {!schedules.length && <p className="text-sm font-bold text-gray-600">Schedule rows are generated when the season starts.</p>}
        </div>
      </div>

      <div className="neo-card bg-white p-6">
        <h4 className="text-xl font-black uppercase mb-4">Draft Day</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Draft Start</Label>
            <Input type="datetime-local" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} className="neo-border font-bold" />
          </div>
          <Button onClick={() => scheduleDraftMutation.mutate()} disabled={!draftStart || scheduleDraftMutation.isPending || scheduledDraft?.status === "OPEN"} className="neo-btn bg-[#00D9FF] text-black">
            <CalendarClock className="w-5 h-5 mr-2" />
            Schedule Draft
          </Button>
          <Button asChild className="neo-btn bg-[#F7B801] text-black">
            <a href={`/league/draft?id=${league.id}`}>Open Draft Day</a>
          </Button>
        </div>
        <p className="mt-3 text-sm font-bold text-gray-600">
          Current draft: {scheduledDraft?.start ? new Date(scheduledDraft.start).toLocaleString() : "Unscheduled"} {scheduledDraft?.status ? `(${scheduledDraft.status})` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Button onClick={() => run("start_season", { source_season_year: sourceSeasonYear })} disabled={actionMutation.isPending || leagueStarted} className="neo-btn bg-black text-white py-4">
          <Play className="w-5 h-5 mr-2" />
          Start Season
        </Button>
        <Button onClick={() => run("open_week_draft", { week_number: currentWeekNumber, timer_seconds: draftConfig.timer_seconds, type: draftConfig.type })} disabled={actionMutation.isPending} className="neo-btn bg-[#F7B801] text-black py-4">
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
        <Button onClick={() => run("resolve_week", { week_number: currentWeekNumber })} disabled={actionMutation.isPending || !leagueStarted} className="neo-btn bg-white text-black py-4">
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
