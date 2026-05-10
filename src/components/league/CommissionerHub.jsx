import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CalendarDays, Eye, FastForward, Lock, Play, RefreshCw, ShieldCheck, Trophy, Unlock, Users } from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";

function StepBadge({ status }) {
  const styles = {
    done: "bg-[#D7F8E8] text-black",
    active: "bg-[#F7B801] text-black",
    waiting: "bg-[#EFFBFF] text-black",
    blocked: "bg-red-100 text-red-800",
    idle: "bg-gray-200 text-black",
  };
  const labels = {
    done: "Done",
    active: "Next",
    waiting: "Waiting",
    blocked: "Blocked",
    idle: "Pending",
  };
  return <span className={`neo-border px-2 py-1 text-[11px] font-black uppercase ${styles[status] || styles.idle}`}>{labels[status] || status}</span>;
}

function StatBlock({ label, value, detail, tone = "bg-white" }) {
  return (
    <div className={`neo-border ${tone} p-4`}>
      <p className="text-xs font-black uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-black">{value}</p>
      {detail && <p className="mt-1 text-xs font-bold uppercase text-gray-500">{detail}</p>}
    </div>
  );
}

function WorkflowStep({ number, title, detail, status, children }) {
  return (
    <div className={`neo-border grid gap-4 p-4 lg:grid-cols-[56px_minmax(0,1fr)_minmax(260px,auto)] lg:items-center ${status === "active" ? "bg-[#FFF7D6]" : "bg-white"}`}>
      <div className="neo-border flex h-11 w-11 items-center justify-center bg-black text-lg font-black text-white">{number}</div>
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black uppercase text-black">{title}</h3>
          <StepBadge status={status} />
        </div>
        <p className="text-sm font-bold text-gray-600">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">{children}</div>
    </div>
  );
}

export default function CommissionerHub({ league }) {
  const queryClient = useQueryClient();
  const { data: seasons = [] } = useQuery({
    queryKey: ["commissioner-hub-seasons", league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id }),
  });
  const { data: weeks = [] } = useQuery({
    queryKey: ["commissioner-hub-weeks", league.id],
    queryFn: () => appClient.entities.Week.filter({ league_id: league.id }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["commissioner-hub-members", league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
  });
  const { data: drafts = [] } = useQuery({
    queryKey: ["commissioner-hub-drafts", league.id],
    queryFn: () => appClient.entities.Draft.filter({ league_id: league.id }, "-created_date"),
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["commissioner-hub-schedule", league.id],
    queryFn: () => appClient.entities.GameSchedule.filter({ league_id: league.id }, "week_number"),
  });
  const { data: matchups = [] } = useQuery({
    queryKey: ["commissioner-hub-matchups", league.id],
    queryFn: () => appClient.entities.Matchup.filter({ league_id: league.id }, "week_number"),
  });
  const { data: weekResults = [] } = useQuery({
    queryKey: ["commissioner-hub-results", league.id],
    queryFn: () => appClient.entities.LeagueWeekResult.filter({ league_id: league.id }),
  });

  const activeSeason = seasons[0] || null;
  const currentWeekNumber = Number(activeSeason?.current_week || 1);
  const { data: currentWeekLineups = [] } = useQuery({
    queryKey: ["commissioner-hub-lineups", league.id, currentWeekNumber],
    queryFn: () => appClient.entities.Lineup.filter({ league_id: league.id, week_number: currentWeekNumber }),
    enabled: Boolean(league.id && currentWeekNumber),
  });

  const latestDraft = drafts[0] || null;
  const draftStatus = String(latestDraft?.status || "").toUpperCase();
  const draftComplete = draftStatus === "COMPLETED";
  const leagueStarted = seasons.length > 0;
  const activeMembers = members.filter((member) => member.is_active !== false);
  const aiMembers = activeMembers.filter((member) => member.is_ai);
  const humanMembers = activeMembers.filter((member) => !member.is_ai);
  const submittedLineups = currentWeekLineups.filter((lineup) => lineup.finalized_at);
  const lineupByMember = useMemo(() => new Set(submittedLineups.map((lineup) => lineup.league_member_id)), [submittedLineups]);
  const missingHumans = humanMembers.filter((member) => !lineupByMember.has(member.id));
  const missingAi = aiMembers.filter((member) => !lineupByMember.has(member.id));
  const lineupReady = activeMembers.length > 0 && submittedLineups.length >= activeMembers.length;
  const currentWeek = weeks.find((week) => Number(week.week_number) === currentWeekNumber) || null;
  const weekStatus = String(currentWeek?.status || "LINEUPS_OPEN").toUpperCase();
  const currentWeekResults = weekResults.filter((result) => Number(result.week_number) === currentWeekNumber);
  const weekResolved = currentWeekResults.length > 0 || weekStatus === "RESOLVED";
  const resultsRevealed = String(currentWeek?.reveal_state || "").toLowerCase() === "revealed";
  const scheduleGenerated = schedules.length > 0 && matchups.length > 0;
  const scheduleLocked = league.schedule_config?.schedule_locked === true;
  const isPaused = league.league_status === "PAUSED";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-seasons", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-weeks", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-schedule", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-matchups", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-results", league.id] });
    queryClient.invalidateQueries({ queryKey: ["commissioner-hub-lineups", league.id, currentWeekNumber] });
    queryClient.invalidateQueries({ queryKey: ["league-lineups", league.id, currentWeekNumber] });
    queryClient.invalidateQueries({ queryKey: ["league-standings", league.id, league.ranking_system] });
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }) => appClient.functions.invoke(action, { league_id: league.id, ...payload }),
    onSuccess: (_, variables) => {
      const labels = {
        generate_schedule: "Schedule generated.",
        start_season: "Season started.",
        generate_ai_lineups: "AI lineups rebuilt.",
        pause_league: "League paused.",
        resume_league: "League resumed.",
        resolve_week: "Week resolved.",
        reveal_week_results: "Results revealed.",
        advance_week: "Advanced to next week.",
        recalculate_standings: "Standings recalculated.",
        update_week_status: "Week status updated.",
      };
      toast.success(labels[variables.action] || "Action complete.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "League operation failed."),
  });

  const toggleScheduleLockMutation = useMutation({
    mutationFn: () => appClient.entities.League.update(league.id, {
      schedule_config: { ...(league.schedule_config || {}), schedule_locked: !scheduleLocked },
    }),
    onSuccess: () => {
      toast.success(scheduleLocked ? "Schedule unlocked." : "Schedule locked.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update schedule lock."),
  });

  const run = (action, payload = {}) => actionMutation.mutate({ action, payload });
  const nextStep = !draftComplete
    ? "Complete the draft before season play."
    : !scheduleGenerated
      ? "Generate the season schedule."
      : !scheduleLocked
        ? "Review and lock the schedule."
        : !leagueStarted
          ? "Start the season."
          : !lineupReady
            ? "Collect lineups and rebuild AI lineups."
            : weekStatus !== "LOCKED" && !weekResolved
              ? "Lock the week, then resolve results."
              : !weekResolved
                ? "Resolve the week."
                : !resultsRevealed
                  ? "Reveal results."
                  : "Advance to the next week when ready.";

  const actionBusy = actionMutation.isPending || toggleScheduleLockMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="neo-border bg-[#EFFBFF] p-5">
          <p className="text-xs font-black uppercase text-gray-500">Commissioner Hub</p>
          <h2 className="mt-1 text-3xl font-black uppercase text-black">{nextStep}</h2>
          <p className="mt-2 text-sm font-bold text-gray-700">Use this page as the weekly control room. The detailed tabs are still available for setup, configuration, and deeper edits.</p>
        </div>
        <div className="neo-border bg-black p-5 text-white">
          <p className="text-xs font-black uppercase text-gray-300">Current State</p>
          <p className="mt-1 text-2xl font-black uppercase">{leagueStarted ? `Week ${currentWeekNumber}` : "Preseason"}</p>
          <p className="mt-1 text-sm font-bold uppercase text-gray-300">{isPaused ? "League Paused" : weekResolved ? "Week Resolved" : weekStatus.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatBlock label="Draft" value={draftComplete ? "Complete" : latestDraft?.status || "Needed"} detail={latestDraft?.start ? new Date(latestDraft.start).toLocaleString() : "Draft Day controls"} tone={draftComplete ? "bg-[#D7F8E8]" : "bg-white"} />
        <StatBlock label="Schedule" value={scheduleGenerated ? `${matchups.length} games` : "Missing"} detail={scheduleLocked ? "Locked" : "Unlocked"} tone={scheduleGenerated ? "bg-[#FFF7D6]" : "bg-white"} />
        <StatBlock label="Lineups" value={`${submittedLineups.length}/${activeMembers.length || 0}`} detail={lineupReady ? "All submitted" : `${missingHumans.length} human / ${missingAi.length} AI waiting`} tone={lineupReady ? "bg-[#D7F8E8]" : "bg-white"} />
        <StatBlock label="Results" value={weekResolved ? "Resolved" : "Open"} detail={resultsRevealed ? "Revealed" : "Hidden"} tone={weekResolved ? "bg-[#EFFBFF]" : "bg-white"} />
      </div>

      <div className="space-y-3">
        <WorkflowStep number="1" title="Draft Complete" status={draftComplete ? "done" : "active"} detail={draftComplete ? "Draft recap is available and rosters are ready." : "Finish Draft Day before generating live season operations."}>
          <Button asChild className="neo-btn bg-white text-black">
            <Link to={draftComplete ? `/league/draft-recap?id=${league.id}` : `/league/draft?id=${league.id}`}>
              <Trophy className="mr-2 h-5 w-5" />
              {draftComplete ? "Draft Recap" : "Draft Day"}
            </Link>
          </Button>
        </WorkflowStep>

        <WorkflowStep number="2" title="Schedule Season" status={!draftComplete ? "blocked" : scheduleGenerated ? "done" : "active"} detail={scheduleGenerated ? `${schedules.length} weeks and ${matchups.length} matchups are generated.` : "Generate the schedule once teams are final."}>
          <Button onClick={() => run("generate_schedule", { force: true })} disabled={actionBusy || scheduleLocked || !draftComplete} className="neo-btn bg-[#F7B801] text-black">
            <CalendarDays className="mr-2 h-5 w-5" />
            Generate
          </Button>
          <Button onClick={() => toggleScheduleLockMutation.mutate()} disabled={actionBusy || !scheduleGenerated} className="neo-btn bg-white text-black">
            {scheduleLocked ? <Unlock className="mr-2 h-5 w-5" /> : <Lock className="mr-2 h-5 w-5" />}
            {scheduleLocked ? "Unlock" : "Lock"}
          </Button>
        </WorkflowStep>

        <WorkflowStep number="3" title="Start Season" status={!scheduleGenerated || !scheduleLocked ? "blocked" : leagueStarted ? "done" : "active"} detail={leagueStarted ? `Season is live on Week ${currentWeekNumber}.` : "Create Week 1 and open lineup submissions."}>
          <Button onClick={() => run("start_season", { source_season_year: league.source_season_year })} disabled={actionBusy || leagueStarted || !scheduleGenerated || !scheduleLocked} className="neo-btn bg-black text-white">
            <Play className="mr-2 h-5 w-5" />
            Start
          </Button>
        </WorkflowStep>

        <WorkflowStep number="4" title="Collect Lineups" status={!leagueStarted ? "blocked" : lineupReady ? "done" : "active"} detail={lineupReady ? "Every active team has a finalized lineup." : `${missingHumans.length} human teams and ${missingAi.length} AI teams still need finalized lineups.`}>
          <Button onClick={() => run("generate_ai_lineups", { week_number: currentWeekNumber, force: true })} disabled={actionBusy || !leagueStarted || weekResolved} className="neo-btn bg-[#D7F8E8] text-black">
            <Bot className="mr-2 h-5 w-5" />
            Rebuild AI
          </Button>
          <Button asChild className="neo-btn bg-white text-black">
            <Link to={`/league/week/${currentWeekNumber}?id=${league.id}`}>
              <Users className="mr-2 h-5 w-5" />
              Week View
            </Link>
          </Button>
        </WorkflowStep>

        <WorkflowStep number="5" title="Lock And Resolve" status={!lineupReady ? "blocked" : weekResolved ? "done" : weekStatus === "LOCKED" ? "active" : "waiting"} detail={weekResolved ? "Scores have been calculated for this week." : weekStatus === "LOCKED" ? "Lineups are locked. Resolve the week next." : "Lock the week after lineups are ready, then resolve scoring."}>
          <Button onClick={() => run("update_week_status", { week_number: currentWeekNumber, status: weekStatus === "LOCKED" ? "LINEUPS_OPEN" : "LOCKED" })} disabled={actionBusy || !leagueStarted || weekResolved || !lineupReady} className="neo-btn bg-white text-black">
            {weekStatus === "LOCKED" ? <Unlock className="mr-2 h-5 w-5" /> : <Lock className="mr-2 h-5 w-5" />}
            {weekStatus === "LOCKED" ? "Unlock Week" : "Lock Week"}
          </Button>
          <Button onClick={() => run("resolve_week", { week_number: currentWeekNumber })} disabled={actionBusy || !leagueStarted || !lineupReady || weekResolved} className="neo-btn bg-[#FF6B35] text-white">
            <ShieldCheck className="mr-2 h-5 w-5" />
            Resolve
          </Button>
        </WorkflowStep>

        <WorkflowStep number="6" title="Reveal And Advance" status={!weekResolved ? "blocked" : resultsRevealed ? "active" : "waiting"} detail={resultsRevealed ? "Results are public. Advance when commissioner review is done." : "Reveal results after checking scoring and standings."}>
          <Button onClick={() => run("reveal_week_results", { week_number: currentWeekNumber })} disabled={actionBusy || !weekResolved || resultsRevealed} className="neo-btn bg-white text-black">
            <Eye className="mr-2 h-5 w-5" />
            Reveal
          </Button>
          <Button onClick={() => run("advance_week")} disabled={actionBusy || !weekResolved || !resultsRevealed} className="neo-btn bg-black text-white">
            <FastForward className="mr-2 h-5 w-5" />
            Advance
          </Button>
        </WorkflowStep>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(isPaused ? "resume_league" : "pause_league")} disabled={actionBusy || !leagueStarted} className="neo-btn bg-[#6A4C93] text-white">
          {isPaused ? "Resume League" : "Pause League"}
        </Button>
        <Button onClick={() => run("recalculate_standings")} disabled={actionBusy || !leagueStarted} className="neo-btn bg-white text-black">
          <RefreshCw className="mr-2 h-5 w-5" />
          Recalculate Standings
        </Button>
        <Button asChild className="neo-btn bg-white text-black">
          <Link to={`/LeagueManage?id=${league.id}&tab=schedule`}>Schedule Details</Link>
        </Button>
        <Button asChild className="neo-btn bg-white text-black">
          <Link to={`/LeagueManage?id=${league.id}&tab=draft`}>Draft Settings</Link>
        </Button>
      </div>
    </div>
  );
}
