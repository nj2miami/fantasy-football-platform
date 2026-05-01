import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

const DEFAULT_SCORING_RULES = {
  "OFFENSE": {
    "passing_yard": 0.04,
    "passing_td": 4,
    "passing_int": -2,
    "passing_first_down": 0.5,
    "rushing_yard": 0.1,
    "rushing_td": 6,
    "rushing_first_down": 0.5,
    "fumble": -1,
    "fumble_lost": -2,
    "reception": 1,
    "receiving_yard": 0.1,
    "receiving_td": 6,
    "receiving_first_down": 0.5,
    "two_pt_conversion": 2,
    "bonus_100_rush_rec_yards": 3,
    "bonus_300_pass_yards": 3
  },
  "KICKER": {
    "fg_0_39": 3,
    "fg_40_49": 4,
    "fg_50_plus": 5,
    "fg_miss": -1,
    "xp_made": 1,
    "xp_miss": -1
  },
  "DEFENSE": {
    "solo_tackle": 1.5,
    "assist_tackle": 0.75,
    "tackle_for_loss": 1,
    "sack": 3,
    "qb_hit": 0.5,
    "interception": 4,
    "pass_defended": 1,
    "fumble_forced": 2,
    "fumble_recovered": 2,
    "touchdown": 6,
    "safety": 2
  }
};

const ScoringRuleInput = ({ label, value, onChange }) => (
  <div>
    <Label className="text-xs font-bold text-gray-600 uppercase">{label.replace(/_/g, ' ')}</Label>
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
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING_RULES);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["scoring-settings"],
    queryFn: async () => {
      const settings = await appClient.entities.Global.filter({ key: "SCORING_RULES" });
      if (settings.length > 0) {
        return settings[0];
      }
      return null;
    }
  });

  useEffect(() => {
    if (setting?.value) {
      setScoringRules(setting.value);
    }
  }, [setting]);

  const handleRuleChange = (category, rule, value) => {
    setScoringRules(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [rule]: value
      }
    }));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async (newRules) => {
      if (setting) {
        return appClient.entities.Global.update(setting.id, { value: newRules });
      } else {
        return appClient.entities.Global.create({
          key: "SCORING_RULES",
          value: newRules,
          description: "Scoring rules for all fantasy matchups."
        });
      }
    },
    onSuccess: () => {
      toast.success("Scoring rules saved successfully!");
      queryClient.invalidateQueries(["scoring-settings"]);
    },
    onError: (error) => {
      toast.error("Failed to save rules: " + error.message);
    }
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(scoringRules);
  };

  if (isLoading) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="neo-card bg-white p-8">
      <h3 className="text-2xl font-black uppercase mb-6">Scoring Rules Configuration</h3>
      <p className="text-sm font-bold text-gray-600 mb-6">
        Configure the scoring rules that will apply to all new PlayerWeek records during import.
      </p>

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
                  onChange={(newValue) => handleRuleChange(category, rule, newValue)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={handleSave}
        disabled={saveSettingsMutation.isPending}
        className="neo-btn bg-[#FF6B35] text-white w-full mt-8 py-4"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveSettingsMutation.isPending ? "Saving..." : "Save Scoring Rules"}
      </Button>
    </div>
  );
}
