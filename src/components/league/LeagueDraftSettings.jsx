import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_LEAGUE_PLAY_SETTINGS, DEFAULT_TEAM_TIER_CAP } from "@/api/appClient";
import { DraftConfigFields, LeaguePlayFields } from "@/components/league/LeagueConfigFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LeagueDraftSettings({ league, setupLocked = false }) {
  const queryClient = useQueryClient();
  const [draftConfig, setDraftConfig] = useState({ ...DEFAULT_DRAFT_CONFIG, ...(league.draft_config || {}) });
  const [playSettings, setPlaySettings] = useState({
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    ...league,
  });
  const [sourceSeasonYear, setSourceSeasonYear] = useState(league.source_season_year || new Date().getFullYear() - 1);
  const [teamTierCap, setTeamTierCap] = useState(Number(league.team_tier_cap ?? DEFAULT_TEAM_TIER_CAP));
  const [draftStart, setDraftStart] = useState("");

  const { data: drafts = [] } = useQuery({
    queryKey: ["league-drafts", league.id],
    queryFn: () => appClient.entities.Draft.filter({ league_id: league.id }, "-created_date"),
  });
  const { data: availableSourceSeasonYears = [] } = useQuery({
    queryKey: ["available-source-season-years"],
    queryFn: () => appClient.playerStats.availableSourceSeasonYears(),
  });

  const scheduledDraft = drafts.find((draft) => ["SCHEDULED", "OPEN"].includes(String(draft.status || "").toUpperCase())) || drafts[0];
  const scheduledDraftStatus = String(scheduledDraft?.status || "").toUpperCase();
  const draftIsCompleted = scheduledDraftStatus === "COMPLETED";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-drafts", league.id] });
  };

  React.useEffect(() => {
    if (!scheduledDraft?.start) return;
    const date = new Date(scheduledDraft.start);
    setDraftStart(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }, [scheduledDraft?.start]);

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      if (setupLocked) throw new Error("League setup is locked after the draft starts.");
      return appClient.entities.League.update(league.id, {
        draft_config: draftConfig,
        source_season_year: sourceSeasonYear,
        mode: playSettings.draft_mode === "weekly_redraft" ? "weekly_redraft" : "traditional",
        draft_mode: playSettings.draft_mode,
        player_retention_mode: playSettings.draft_mode === "weekly_redraft" ? "retained" : playSettings.player_retention_mode,
        player_retention_limit: playSettings.draft_mode === "weekly_redraft" ? null : Number(playSettings.player_retention_limit || 2),
        team_tier_cap: Number(teamTierCap) || 0,
      });
    },
    onSuccess: () => {
      toast.success("Draft settings saved.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to save draft settings."),
  });

  const scheduleDraftMutation = useMutation({
    mutationFn: () => {
      if (setupLocked) throw new Error("League setup is locked after the draft starts.");
      return appClient.functions.invoke("schedule_draft", {
        league_id: league.id,
        start: new Date(draftStart).toISOString(),
        type: draftConfig.type,
      });
    },
    onSuccess: () => {
      toast.success("Draft scheduled.");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to schedule draft."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">Draft Configuration</h3>
        <p className="text-sm font-bold text-gray-600">
          Configure the draft pool, tier cap, draft cadence, and Draft Day launch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="neo-border p-4 bg-[#EFFBFF]">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Mode</p>
          <p className="text-lg font-black">{playSettings.draft_mode === "weekly_redraft" ? "Weekly Redraft" : "Season Snake"}</p>
        </div>
        <div className="neo-border p-4 bg-white">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Tier Cap</p>
          <p className="text-lg font-black">{teamTierCap}</p>
        </div>
        <div className="neo-border p-4 bg-white">
          <p className="text-xs font-black uppercase text-gray-500 mb-1">Current Draft</p>
          <p className="text-lg font-black">{scheduledDraft?.status || "Unscheduled"}</p>
        </div>
      </div>

      <div className="neo-card bg-white p-6">
        <h4 className="text-xl font-black uppercase mb-4">Draft Setup</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LeaguePlayFields
            value={playSettings}
            onChange={setPlaySettings}
            disabled={setupLocked}
            compactLabels
            showDescriptions
            fields={["draft_mode", "player_retention_mode"]}
          />
          <DraftConfigFields
            draftConfig={draftConfig}
            onDraftConfigChange={setDraftConfig}
            sourceSeasonYear={sourceSeasonYear}
            onSourceSeasonYearChange={setSourceSeasonYear}
            sourceSeasonYears={availableSourceSeasonYears}
            teamTierCap={teamTierCap}
            onTeamTierCapChange={setTeamTierCap}
            disabled={setupLocked}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-end mt-6">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Draft Start</Label>
            <Input
              type="datetime-local"
              value={draftStart}
              onChange={(event) => setDraftStart(event.target.value)}
              disabled={scheduledDraft?.status === "OPEN" || setupLocked}
              className="neo-border font-bold"
            />
            <p className="text-xs font-bold text-gray-600 mt-2">
              Sets the scheduled start time for the draft room.
            </p>
          </div>
          <Button onClick={() => scheduleDraftMutation.mutate()} disabled={!draftStart || scheduleDraftMutation.isPending || scheduledDraft?.status === "OPEN" || setupLocked} className="neo-btn bg-[#00D9FF] text-black">
            <CalendarClock className="w-5 h-5 mr-2" />
            Schedule Draft
          </Button>
          <Button asChild className="neo-btn bg-[#F7B801] text-black">
            <a href={draftIsCompleted ? `/league/draft-recap?id=${league.id}` : `/league/draft?id=${league.id}`}>
              {draftIsCompleted ? "Open Draft Recap" : "Open Draft Day"}
            </a>
          </Button>
        </div>
        <p className="mt-3 text-sm font-bold text-gray-600">
          Current draft: {scheduledDraft?.start ? new Date(scheduledDraft.start).toLocaleString() : "Unscheduled"} {scheduledDraft?.status ? `(${scheduledDraft.status})` : ""}
        </p>

        <Button onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending || setupLocked} className="neo-btn bg-[#00D9FF] text-black w-full mt-6">
          <Save className="w-5 h-5 mr-2" />
          {setupLocked ? "Locked After Draft Start" : "Save Draft Settings"}
        </Button>
      </div>
    </div>
  );
}
