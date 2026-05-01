import React, { useEffect, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";

const isCategorizedRules = (rules) =>
  rules &&
  typeof rules === "object" &&
  Object.values(rules).some((value) => value && typeof value === "object" && !Array.isArray(value));

const mergeRules = (defaults, overrides) => {
  const sourceDefaults = isCategorizedRules(defaults) ? defaults : DEFAULT_SCORING_RULES;
  const sourceOverrides = isCategorizedRules(overrides) ? overrides : {};
  return Object.fromEntries(
    Object.entries(sourceDefaults).map(([category, rules]) => [
      category,
      {
        ...rules,
        ...(sourceOverrides[category] || {}),
      },
    ])
  );
};

const ScoringRuleInput = ({ label, value, onChange, disabled }) => (
  <div>
    <Label className="text-xs font-bold text-gray-600 uppercase">{label.replace(/_/g, " ")}</Label>
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      disabled={disabled}
      className="neo-border font-bold mt-1"
    />
  </div>
);

export default function LeagueScoring({ league }) {
  const queryClient = useQueryClient();
  const [scoringRules, setScoringRules] = useState(null);
  const isPaidLeague = league.league_tier === "PAID";

  const { data: defaultRules = DEFAULT_SCORING_RULES, isLoading } = useQuery({
    queryKey: ["league-scoring-defaults"],
    queryFn: async () => {
      const globalSettings = await appClient.entities.Global.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(globalSettings[0]?.value)) return globalSettings[0].value;
      const siteSettings = await appClient.entities.SiteSetting.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(siteSettings[0]?.value)) return siteSettings[0].value;
      return DEFAULT_SCORING_RULES;
    },
  });

  useEffect(() => {
    setScoringRules(mergeRules(defaultRules, league.scoring_rules));
  }, [defaultRules, league.scoring_rules]);

  const handleRuleChange = (category, rule, value) => {
    setScoringRules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rule]: value,
      },
    }));
  };

  const saveOverridesMutation = useMutation({
    mutationFn: (newRules) => appClient.entities.League.update(league.id, { scoring_rules: newRules }),
    onSuccess: () => {
      toast.success("League scoring overrides saved!");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save scoring rules.");
    },
  });

  if (isLoading || !scoringRules) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">League Scoring Overrides</h3>
        <p className="text-sm font-bold text-gray-600">
          Paid leagues can customize scoring from the site defaults. Free leagues use the default scoring rules.
        </p>
      </div>

      {!isPaidLeague && (
        <div className="neo-border bg-[#FFF1E8] p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-[#6A4C93]" />
          <p className="font-black uppercase text-sm">
            Scoring overrides are available for paid leagues only.
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
                  disabled={!isPaidLeague}
                  onChange={(newValue) => handleRuleChange(category, rule, newValue)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => saveOverridesMutation.mutate(scoringRules)}
        disabled={saveOverridesMutation.isPending || !isPaidLeague}
        className="neo-btn bg-[#00D9FF] text-black w-full py-4 mt-8"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveOverridesMutation.isPending ? "Saving..." : "Save Paid League Overrides"}
      </Button>
    </div>
  );
}
