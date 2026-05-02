import React, { useEffect, useMemo, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Calculator, CheckCircle, Loader2, Save, XCircle } from "lucide-react";

const cloneRules = (rules) => JSON.parse(JSON.stringify(rules || DEFAULT_SCORING_RULES));

const mergeRules = (rules) => {
  const merged = cloneRules(DEFAULT_SCORING_RULES);
  Object.entries(rules || {}).forEach(([category, categoryRules]) => {
    merged[category] = { ...(merged[category] || {}), ...(categoryRules || {}) };
  });
  return merged;
};

const ScoringRuleInput = ({ label, value, onChange }) => (
  <div>
    <Label className="text-xs font-bold text-gray-600 uppercase">{label.replace(/_/g, " ")}</Label>
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="neo-border font-bold mt-1"
    />
  </div>
);

const activeJobStatuses = new Set(["PENDING", "RUNNING"]);

const StatusIcon = ({ status }) => {
  if (status === "COMPLETED") return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (status === "FAILED") return <XCircle className="h-5 w-5 text-red-600" />;
  return <Loader2 className="h-5 w-5 animate-spin text-[#00D9FF]" />;
};

export default function ScoringSettings() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("default");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING_RULES);
  const [lastSaved, setLastSaved] = useState(null);
  const [recalculationJobId, setRecalculationJobId] = useState(null);
  const [isRecalculationOpen, setIsRecalculationOpen] = useState(false);

  const { data: defaultSetting, isLoading: isLoadingDefault } = useQuery({
    queryKey: ["scoring-settings"],
    queryFn: async () => {
      const settings = await appClient.entities.Global.filter({ key: "SCORING_RULES" });
      return settings[0] || null;
    },
  });

  const { data: importedYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ["scoring-season-years"],
    queryFn: () => appClient.playerPool.listYears(),
  });

  const { data: seasonRules = [], isLoading: isLoadingSeasonRules } = useQuery({
    queryKey: ["season-scoring-rules"],
    queryFn: () => appClient.entities.SeasonScoringRule.list("-season_year"),
  });

  const defaultRules = useMemo(
    () => mergeRules(defaultSetting?.value || DEFAULT_SCORING_RULES),
    [defaultSetting]
  );

  const seasonOptions = useMemo(() => {
    const years = new Set([
      ...importedYears.map((year) => Number(year)),
      ...seasonRules.map((row) => Number(row.season_year)),
    ].filter(Boolean));
    return [...years].sort((a, b) => b - a);
  }, [importedYears, seasonRules]);

  const selectedSeasonRule = useMemo(
    () => seasonRules.find((row) => Number(row.season_year) === Number(selectedSeason)) || null,
    [seasonRules, selectedSeason]
  );

  const { data: recalculationJob, refetch: refetchRecalculationJob } = useQuery({
    queryKey: ["scoring-recalculation-job", recalculationJobId],
    queryFn: () => appClient.entities.ImportJob.get(recalculationJobId),
    enabled: Boolean(recalculationJobId),
    refetchInterval: (query) => {
      const job = query.state.data;
      return activeJobStatuses.has(job?.status) ? 1500 : false;
    },
  });

  useEffect(() => {
    if (!selectedSeason && seasonOptions.length > 0) {
      setSelectedSeason(String(seasonOptions[0]));
    }
  }, [selectedSeason, seasonOptions]);

  useEffect(() => {
    if (mode === "season") {
      setScoringRules(mergeRules(selectedSeasonRule?.rules || defaultRules));
      return;
    }
    setScoringRules(defaultRules);
  }, [defaultRules, mode, selectedSeasonRule]);

  const handleRuleChange = (category, rule, value) => {
    setScoringRules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rule]: value,
      },
    }));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async (newRules) => {
      if (mode === "season") {
        const seasonYear = Number(selectedSeason);
        if (!seasonYear) throw new Error("Choose a season before saving an override.");
        if (selectedSeasonRule) {
          return appClient.entities.SeasonScoringRule.update(selectedSeasonRule.id, { rules: newRules });
        }
        return appClient.entities.SeasonScoringRule.create({
          season_year: seasonYear,
          rules: newRules,
        });
      }

      if (defaultSetting) {
        return appClient.entities.Global.update(defaultSetting.id, { value: newRules });
      }
      return appClient.entities.Global.create({
        key: "SCORING_RULES",
        value: newRules,
        description: "Default scoring rules for new leagues and newly imported seasons.",
      });
    },
    onSuccess: () => {
      const saved = {
        mode,
        season: mode === "season" ? Number(selectedSeason) : null,
      };
      setLastSaved(saved);
      toast.success(mode === "season" ? "Season scoring override saved." : "Default scoring rules saved.");
      queryClient.invalidateQueries({ queryKey: ["scoring-settings"] });
      queryClient.invalidateQueries({ queryKey: ["season-scoring-rules"] });
    },
    onError: (error) => {
      toast.error("Failed to save rules: " + error.message);
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const parameters = lastSaved?.mode === "season" && lastSaved.season
        ? { season_year: lastSaved.season }
        : {};
      const job = await appClient.entities.ImportJob.create({
        job_type: "SCORING_UPDATE",
        parameters,
        status: "PENDING",
        logs: [
          parameters.season_year
            ? `Scoring recalculation requested for ${parameters.season_year}.`
            : "Scoring recalculation requested for all stored season rules.",
        ],
      });
      setRecalculationJobId(job.id);
      setIsRecalculationOpen(true);
      queryClient.setQueryData(["scoring-recalculation-job", job.id], job);
      try {
        await appClient.functions.invoke("processImportJobs", { job_id: job.id });
      } catch (error) {
        const failedJob = await appClient.entities.ImportJob.get(job.id).catch(() => null);
        if (failedJob) {
          queryClient.setQueryData(["scoring-recalculation-job", job.id], failedJob);
        }
        throw error;
      }
      return job;
    },
    onSuccess: (job) => {
      toast.success("Fantasy point recalculation finished.");
      queryClient.invalidateQueries({ queryKey: ["latest-import-job"] });
      queryClient.invalidateQueries({ queryKey: ["scoring-recalculation-job", job.id] });
      queryClient.invalidateQueries({ queryKey: ["player-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["player-pool"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
    },
    onError: async (error) => {
      await refetchRecalculationJob();
      queryClient.invalidateQueries({ queryKey: ["latest-import-job"] });
      toast.error("Recalculation failed. Open the progress modal for details: " + error.message);
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(scoringRules);
  };

  const isLoading = isLoadingDefault || isLoadingYears || isLoadingSeasonRules;
  const modalStatus = recalculationJob?.status || (recalculateMutation.isPending ? "RUNNING" : "PENDING");
  const modalLogs = Array.isArray(recalculationJob?.logs) ? recalculationJob.logs : [];
  const modalProgress = recalculationJob?.progress ?? (activeJobStatuses.has(modalStatus) ? 5 : 0);
  const isModalJobActive = activeJobStatuses.has(modalStatus) || recalculateMutation.isPending;

  if (isLoading) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="neo-card bg-white p-8">
      <h3 className="text-2xl font-black uppercase mb-4">Scoring Rules Configuration</h3>
      <p className="text-sm font-bold text-gray-600 mb-6">
        Default rules seed new leagues and newly imported seasons. Existing imported stats use season scoring rules and must be recalculated after an override changes.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("default");
            setLastSaved(null);
          }}
          className={`neo-btn p-4 text-left ${mode === "default" ? "bg-black text-[#F7B801]" : "bg-white text-black"}`}
        >
          <span className="block text-lg font-black uppercase">Default Rules</span>
          <span className="block text-sm font-bold">Used for future leagues and seasons when no season override exists.</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("season");
            setLastSaved(null);
          }}
          className={`neo-btn p-4 text-left ${mode === "season" ? "bg-black text-[#00D9FF]" : "bg-white text-black"}`}
        >
          <span className="block text-lg font-black uppercase">Season Override</span>
          <span className="block text-sm font-bold">Edit rules for one imported season and recalculate its fantasy points.</span>
        </button>
      </div>

      {mode === "season" && (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr] md:items-end">
          <div>
            <Label className="text-xs font-bold text-gray-600 uppercase">Imported Season</Label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(e.target.value);
                setLastSaved(null);
              }}
              className="neo-border mt-1 h-10 w-full bg-white px-3 font-bold"
            >
              {seasonOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <p className="text-sm font-bold text-gray-600">
            {selectedSeasonRule
              ? "This season already has its own scoring rules."
              : "This season will start from the current default rules until you save an override."}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(scoringRules).map(([category, rules]) => (
          <div key={category}>
            <h4 className="text-xl font-black uppercase text-black pb-2 mb-4 border-b-4 border-black">
              {category}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(rules).map(([rule, value]) => (
                <ScoringRuleInput
                  key={rule}
                  label={rule}
                  value={value}
                  onChange={(newValue) => {
                    setLastSaved(null);
                    handleRuleChange(category, rule, newValue);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={handleSave}
        disabled={saveSettingsMutation.isPending || (mode === "season" && !selectedSeason)}
        className="neo-btn bg-[#FF6B35] text-white w-full mt-8 py-4"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveSettingsMutation.isPending ? "Saving..." : mode === "season" ? "Save Season Override" : "Save Default Rules"}
      </Button>

      {lastSaved && (
        <div className="mt-6 neo-border bg-gray-50 p-5">
          <p className="mb-4 text-sm font-bold text-gray-700">
            {lastSaved.mode === "season"
              ? `Saved rules for ${lastSaved.season}. Run recalculation to overwrite stored fantasy points for that season.`
              : "Saved default rules. Existing season overrides were not changed; recalculate to refresh stored seasons from their saved season rules."}
          </p>
          <Button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="neo-btn bg-[#00D9FF] text-black w-full py-4"
          >
            <Calculator className="w-5 h-5 mr-2" />
            {recalculateMutation.isPending
              ? "Starting Recalculation..."
              : lastSaved.mode === "season"
                ? `Recalculate ${lastSaved.season} Fantasy Points`
                : "Recalculate Stored Season Fantasy Points"}
          </Button>
        </div>
      )}

      <Dialog
        open={isRecalculationOpen}
        onOpenChange={(open) => {
          if (!open && isModalJobActive) return;
          setIsRecalculationOpen(open);
        }}
      >
        <DialogContent className="neo-card max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase">
              <StatusIcon status={modalStatus} />
              Recalculate Fantasy Points
            </DialogTitle>
            <DialogDescription className="font-bold text-gray-600">
              {lastSaved?.mode === "season" && lastSaved.season
                ? `Applying saved scoring rules to ${lastSaved.season}.`
                : "Applying saved season scoring rules to stored player stats."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm font-black uppercase md:grid-cols-4">
              <div className="neo-border bg-gray-50 p-3">
                <p className="text-gray-500">Status</p>
                <p>{modalStatus}</p>
              </div>
              <div className="neo-border bg-gray-50 p-3">
                <p className="text-gray-500">Job</p>
                <p>{recalculationJob?.job_type || "SCORING_UPDATE"}</p>
              </div>
              <div className="neo-border bg-gray-50 p-3">
                <p className="text-gray-500">Progress</p>
                <p>{modalProgress}%</p>
              </div>
              <div className="neo-border bg-gray-50 p-3">
                <p className="text-gray-500">Scope</p>
                <p>{recalculationJob?.parameters?.season_year || lastSaved?.season || "All"}</p>
              </div>
            </div>

            <Progress value={modalProgress} className="h-4 neo-border rounded-none bg-gray-200" />

            {recalculationJob?.summary && (
              <div className="neo-border bg-green-50 p-3 text-sm font-bold text-green-800">
                {recalculationJob.summary}
              </div>
            )}

            {recalculationJob?.error_details && (
              <div className="neo-border bg-red-50 p-3 text-sm font-bold text-red-800">
                {recalculationJob.error_details}
              </div>
            )}

            <div className="h-64 overflow-y-auto neo-border bg-[#111] p-4 font-mono text-sm text-white">
              {modalLogs.length > 0 ? (
                modalLogs.map((log, index) => (
                  <p key={`${index}-${log}`} className="whitespace-pre-wrap">{`> ${log}`}</p>
                ))
              ) : (
                <p className="text-gray-400">Waiting for job logs...</p>
              )}
            </div>

            <Button
              onClick={() => setIsRecalculationOpen(false)}
              disabled={isModalJobActive}
              className="neo-btn w-full bg-black py-4 text-white disabled:opacity-50"
            >
              {isModalJobActive ? "Recalculation Running..." : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
