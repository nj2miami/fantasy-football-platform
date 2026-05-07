import React, { useEffect, useMemo, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calculator, Save } from "lucide-react";
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

export default function ScoringSettings() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("default");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING_RULES);
  const [lastSaved, setLastSaved] = useState(null);

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
        parameters: { ...parameters, job_type: "SCORING_UPDATE" },
        status: "PENDING",
        logs: [
          parameters.season_year
            ? `Scoring recalculation requested for ${parameters.season_year}.`
            : "Scoring recalculation requested for all stored season rules.",
        ],
      });
      showFreshJobInPanel(queryClient, job);
      await appClient.functions.invoke("processImportJobs", { job_id: job.id, job_type: "SCORING_UPDATE" });
      return job;
    },
    onSuccess: () => {
      toast.success("Fantasy point recalculation finished. Check Job Status & Logs for details.");
      refreshJobPanel(queryClient);
      queryClient.invalidateQueries({ queryKey: ["player-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["player-pool"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
    },
    onError: (error) => {
      refreshJobPanel(queryClient);
      toast.error("Recalculation failed. Check Job Status & Logs for details: " + error.message);
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(scoringRules);
  };

  const isLoading = isLoadingDefault || isLoadingYears || isLoadingSeasonRules;

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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {ruleEntries.map(([rule, value]) => (
                  <ScoringRuleInput
                    key={rule}
                    label={rule}
                    value={value}
                    onChange={(newValue) => {
                      setLastSaved(null);
                      handleRuleChange(section.category, rule, newValue);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
    </div>
  );
}
