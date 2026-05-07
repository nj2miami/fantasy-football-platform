import React, { useEffect, useMemo, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calculator, CloudDownload, Database, Save, Upload } from "lucide-react";
import { refreshJobPanel, showFreshJobInPanel } from "./jobStatus";

const cloneRules = (rules) => JSON.parse(JSON.stringify(rules || DEFAULT_SCORING_RULES));

const mergeRules = (rules) => {
  const merged = cloneRules(DEFAULT_SCORING_RULES);
  Object.entries(rules || {}).forEach(([category, categoryRules]) => {
    merged[category] = { ...(merged[category] || {}), ...(categoryRules || {}) };
  });
  return merged;
};

const SCORING_SECTIONS = [
  {
    title: "Offense - QB",
    category: "OFFENSE",
    rules: [
      "completion",
      "incompletion",
      "passing_yard",
      "passing_td",
      "passing_int",
      "passing_first_down",
      "qb_rushing_yard",
      "qb_rushing_td",
      "qb_rushing_first_down",
      "two_pt_conversion",
      "bonus_300_pass_yards",
    ],
  },
  {
    title: "Offense - Skill",
    category: "OFFENSE",
    rules: [
      "rushing_yard",
      "rushing_td",
      "rushing_first_down",
      "reception",
      "receiving_yard",
      "receiving_td",
      "receiving_first_down",
      "fumble",
      "fumble_lost",
      "bonus_100_rush_rec_yards",
    ],
  },
  { title: "Kicker", category: "KICKER" },
  { title: "Defense", category: "DEFENSE" },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ScoringRuleInput({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs font-bold text-gray-600 uppercase">{label.replace(/_/g, " ")}</Label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
        className="neo-border font-bold mt-1"
      />
    </div>
  );
}

function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase text-gray-500">{eyebrow}</p>
      <h3 className="text-2xl font-black uppercase">{title}</h3>
      {children && <p className="mt-2 text-sm font-bold text-gray-600">{children}</p>}
    </div>
  );
}

export default function SeasonDataPipeline() {
  const queryClient = useQueryClient();
  const fallbackYear = new Date().getFullYear() - 1;
  const [seasonYear, setSeasonYear] = useState(fallbackYear);
  const [startYear, setStartYear] = useState(fallbackYear);
  const [endYear, setEndYear] = useState(fallbackYear);
  const [uploadFile, setUploadFile] = useState(null);
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING_RULES);
  const [selectedRulesSeason, setSelectedRulesSeason] = useState("");
  const [lastSavedSeason, setLastSavedSeason] = useState(null);

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
      Number(seasonYear),
      ...importedYears.map((year) => Number(year)),
      ...seasonRules.map((row) => Number(row.season_year)),
    ].filter(Boolean));
    return [...years].sort((a, b) => b - a);
  }, [importedYears, seasonRules, seasonYear]);

  const selectedSeasonRule = useMemo(
    () => seasonRules.find((row) => Number(row.season_year) === Number(selectedRulesSeason)) || null,
    [seasonRules, selectedRulesSeason]
  );

  useEffect(() => {
    if (!selectedRulesSeason && seasonOptions.length > 0) {
      setSelectedRulesSeason(String(seasonOptions[0]));
    }
  }, [selectedRulesSeason, seasonOptions]);

  useEffect(() => {
    setScoringRules(mergeRules(selectedSeasonRule?.rules || defaultRules));
  }, [defaultRules, selectedSeasonRule]);

  const createImportJobMutation = useMutation({
    mutationFn: async ({ parameters, logs }) => {
      const job = await appClient.entities.ImportJob.create({
        job_type: "HISTORICAL_STATS",
        parameters,
        status: "PENDING",
        logs,
      });
      showFreshJobInPanel(queryClient, job);
      await appClient.functions.invoke("processImportJobs", { job_id: job.id, job_type: job.job_type });
      return job;
    },
    onSuccess: () => {
      toast.success("Season data import started.");
      refreshJobPanel(queryClient);
      queryClient.invalidateQueries({ queryKey: ["scoring-season-years"] });
    },
    onError: (error) => {
      refreshJobPanel(queryClient);
      toast.error("Import failed to start: " + (error.message || "Unknown error"));
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      queryClient.setQueryData(["latest-import-job"], {
        status: "PENDING",
        progress: 0,
        logs: ["Uploading CSV and creating season import job."],
      });

      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const { file_url } = await appClient.integrations.Core.UploadFile({
        file,
        path: `imports/season-source/${crypto.randomUUID()}-${safeName}`,
      });

      const job = await appClient.entities.ImportJob.create({
        job_type: "HISTORICAL_STATS",
        parameters: {
          file_url,
          manual_upload: true,
          start_year: Number(seasonYear),
          end_year: Number(seasonYear),
          source_season_year: Number(seasonYear),
        },
        status: "PENDING",
        logs: [`CSV uploaded for ${seasonYear}.`, "Building seasonal player and weekly stat data."],
      });
      showFreshJobInPanel(queryClient, job);
      await appClient.functions.invoke("processImportJobs", { job_id: job.id, job_type: job.job_type });
      return job;
    },
    onSuccess: () => {
      toast.success("CSV uploaded and season import started.");
      setUploadFile(null);
      refreshJobPanel(queryClient);
      queryClient.invalidateQueries({ queryKey: ["scoring-season-years"] });
    },
    onError: (error) => {
      refreshJobPanel(queryClient);
      toast.error("CSV upload failed: " + (error.message || "Unknown error"));
    },
  });

  const saveSeasonRulesMutation = useMutation({
    mutationFn: async (newRules) => {
      const ruleSeason = Number(selectedRulesSeason || seasonYear);
      if (!ruleSeason) throw new Error("Choose a season before saving scoring rules.");
      if (selectedSeasonRule) {
        return appClient.entities.SeasonScoringRule.update(selectedSeasonRule.id, { rules: newRules });
      }
      return appClient.entities.SeasonScoringRule.create({
        season_year: ruleSeason,
        rules: newRules,
      });
    },
    onSuccess: () => {
      const savedSeason = Number(selectedRulesSeason || seasonYear);
      setLastSavedSeason(savedSeason);
      toast.success(`Admin scoring rules saved for ${savedSeason}.`);
      queryClient.invalidateQueries({ queryKey: ["season-scoring-rules"] });
    },
    onError: (error) => {
      toast.error("Failed to save scoring rules: " + error.message);
    },
  });

  const publishSeasonMutation = useMutation({
    mutationFn: async (targetSeason) => {
      const job = await appClient.entities.ImportJob.create({
        job_type: "SCORING_UPDATE",
        parameters: { season_year: Number(targetSeason), publish_season_data: true },
        status: "PENDING",
        logs: [`Publishing seasonal fantasy data for ${targetSeason}.`],
      });
      showFreshJobInPanel(queryClient, job);
      let result = { complete: false };
      while (!result.complete) {
        result = await appClient.functions.invoke("processImportJobs", { job_id: job.id, job_type: "SCORING_UPDATE" });
        refreshJobPanel(queryClient);
        if (!result.complete) await wait(500);
      }
      return job;
    },
    onSuccess: () => {
      toast.success("Seasonal fantasy data published.");
      refreshJobPanel(queryClient);
      queryClient.invalidateQueries({ queryKey: ["player-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["player-pool"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scoring-season-years"] });
    },
    onError: (error) => {
      refreshJobPanel(queryClient);
      toast.error("Publish failed: " + error.message);
    },
  });

  const handleRuleChange = (category, rule, value) => {
    setLastSavedSeason(null);
    setScoringRules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rule]: value,
      },
    }));
  };

  const startApiImport = () => {
    if (Number(startYear) > Number(endYear)) {
      toast.error("Start year cannot be after end year.");
      return;
    }
    createImportJobMutation.mutate({
      parameters: { start_year: Number(startYear), end_year: Number(endYear) },
      logs: [`Importing nflverse weekly stats for ${startYear}-${endYear}.`],
    });
  };

  const startCsvImport = () => {
    if (!uploadFile) {
      toast.error("Choose a CSV file first.");
      return;
    }
    uploadFileMutation.mutate(uploadFile);
  };

  const selectedPublishSeason = Number(lastSavedSeason || selectedRulesSeason || seasonYear);
  const isLoading = isLoadingDefault || isLoadingYears || isLoadingSeasonRules;

  if (isLoading) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div className="neo-card bg-white p-8">
        <SectionHeader eyebrow="Step 1" title="Ingest Raw League Stats">
          Bring in one completed NFL season from a CSV upload or directly from nflverse. The import stores source stats with each player-week row before scoring is published.
        </SectionHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="neo-border bg-[#EFFBFF] p-5">
            <div className="mb-4 flex items-center gap-3">
              <CloudDownload className="h-6 w-6 text-[#00A6D6]" />
              <h4 className="text-lg font-black uppercase">nflverse Import</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">Start Year</Label>
                <Input
                  type="number"
                  value={startYear}
                  onChange={(event) => setStartYear(parseInt(event.target.value, 10) || fallbackYear)}
                  className="neo-border font-bold"
                />
              </div>
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">End Year</Label>
                <Input
                  type="number"
                  value={endYear}
                  onChange={(event) => setEndYear(parseInt(event.target.value, 10) || fallbackYear)}
                  className="neo-border font-bold"
                />
              </div>
            </div>
            <Button
              onClick={startApiImport}
              disabled={createImportJobMutation.isPending}
              className="neo-btn mt-5 w-full bg-[#00D9FF] py-4 text-black"
            >
              <Database className="mr-2 h-5 w-5" />
              {createImportJobMutation.isPending ? "Importing..." : "Import from nflverse"}
            </Button>
          </div>

          <div className="neo-border bg-[#FFF1E8] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Upload className="h-6 w-6 text-[#FF6B35]" />
              <h4 className="text-lg font-black uppercase">CSV Upload</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">Season</Label>
                <Input
                  type="number"
                  value={seasonYear}
                  onChange={(event) => setSeasonYear(parseInt(event.target.value, 10) || fallbackYear)}
                  className="neo-border font-bold"
                />
              </div>
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">CSV / TSV File</Label>
                <Input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  className="neo-border font-bold"
                />
              </div>
            </div>
            {uploadFile && (
              <p className="mt-3 text-sm font-bold text-gray-600">Selected: {uploadFile.name}</p>
            )}
            <Button
              onClick={startCsvImport}
              disabled={!uploadFile || uploadFileMutation.isPending}
              className="neo-btn mt-5 w-full bg-[#FF6B35] py-4 text-white"
            >
              <Upload className="mr-2 h-5 w-5" />
              {uploadFileMutation.isPending ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>
      </div>

      <div className="neo-card bg-white p-8">
        <SectionHeader eyebrow="Step 2" title="Set Admin Season Scoring">
          These rules produce the shared seasonal fantasy data. League overrides remain limited to paid leagues or Pro commissioners.
        </SectionHeader>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr] md:items-end">
          <div>
            <Label className="text-xs font-bold text-gray-600 uppercase">Season Rules</Label>
            <select
              value={selectedRulesSeason}
              onChange={(event) => {
                setSelectedRulesSeason(event.target.value);
                setLastSavedSeason(null);
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
              ? "Saved season rules are loaded."
              : "This season starts from current admin defaults until saved."}
          </p>
        </div>

        <div className="space-y-8">
          {SCORING_SECTIONS.map((section) => {
            const rules = scoringRules[section.category] || {};
            const ruleEntries = section.rules
              ? section.rules.filter((rule) => Object.prototype.hasOwnProperty.call(rules, rule)).map((rule) => [rule, rules[rule]])
              : Object.entries(rules);
            if (!ruleEntries.length) return null;
            return (
              <div key={section.title}>
                <h4 className="text-xl font-black uppercase text-black pb-2 mb-4 border-b-4 border-black">
                  {section.title}
                </h4>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {ruleEntries.map(([rule, value]) => (
                    <ScoringRuleInput
                      key={rule}
                      label={rule}
                      value={value}
                      onChange={(newValue) => handleRuleChange(section.category, rule, newValue)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          onClick={() => saveSeasonRulesMutation.mutate(scoringRules)}
          disabled={saveSeasonRulesMutation.isPending || !selectedRulesSeason}
          className="neo-btn mt-8 w-full bg-[#FF6B35] py-4 text-white"
        >
          <Save className="mr-2 h-5 w-5" />
          {saveSeasonRulesMutation.isPending ? "Saving..." : "Save Admin Season Rules"}
        </Button>
      </div>

      <div className="neo-card bg-black p-8 text-white">
        <SectionHeader eyebrow="Step 3" title="Publish Seasonal Data">
          Recalculate fantasy points and player aggregates for the selected season so leagues use one shared admin dataset by default.
        </SectionHeader>
        <div className="neo-border bg-[#111] p-5">
          <p className="text-sm font-black uppercase text-[#F7B801]">Publish Target</p>
          <p className="mt-1 text-3xl font-black">{selectedPublishSeason}</p>
          <p className="mt-2 text-sm font-bold text-gray-300">
            Paid leagues and Pro commissioners can opt into league-specific scoring from their league scoring screen.
          </p>
        </div>
        <Button
          onClick={() => publishSeasonMutation.mutate(selectedPublishSeason)}
          disabled={publishSeasonMutation.isPending || !selectedPublishSeason}
          className="neo-btn mt-5 w-full bg-[#9EF01A] py-4 text-black"
        >
          <Calculator className="mr-2 h-5 w-5" />
          {publishSeasonMutation.isPending ? "Publishing..." : "Publish Seasonal Fantasy Data"}
        </Button>
      </div>
    </div>
  );
}
