import React, { useEffect, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export default function LeagueScoring({ league, setupLocked = false }) {
  const queryClient = useQueryClient();
  const [scoringRules, setScoringRules] = useState(null);
  const isLocked = Boolean(league.scoring_rules_locked_at);
  const overridesEnabled = league.scoring_overrides_enabled === true;

  const { data: defaultRulesContext = { rules: DEFAULT_SCORING_RULES, sourceUpdatedAt: null }, isLoading } = useQuery({
    queryKey: ["league-scoring-defaults", league.source_season_year],
    queryFn: async () => {
      const seasonRules = await appClient.entities.SeasonScoringRule.filter({ season_year: Number(league.source_season_year || new Date().getFullYear() - 1) });
      if (isCategorizedRules(seasonRules[0]?.rules)) {
        return {
          rules: seasonRules[0].rules,
          sourceUpdatedAt: seasonRules[0].updated_date || seasonRules[0].created_date || null,
        };
      }
      const globalSettings = await appClient.entities.Global.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(globalSettings[0]?.value)) {
        return {
          rules: globalSettings[0].value,
          sourceUpdatedAt: globalSettings[0].updated_date || globalSettings[0].created_date || null,
        };
      }
      const siteSettings = await appClient.entities.SiteSetting.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(siteSettings[0]?.value)) {
        return {
          rules: siteSettings[0].value,
          sourceUpdatedAt: siteSettings[0].updated_date || siteSettings[0].created_date || null,
        };
      }
      return { rules: DEFAULT_SCORING_RULES, sourceUpdatedAt: null };
    },
  });
  const defaultRules = defaultRulesContext.rules || DEFAULT_SCORING_RULES;

  const { data: commissionerProfiles = [] } = useQuery({
    queryKey: ["league-commissioner-profile", league.commissioner_email],
    queryFn: () => league.commissioner_email ? appClient.entities.UserProfile.filter({ user_email: league.commissioner_email }) : [],
    enabled: !!league.commissioner_email,
  });
  const commissionerRole = String(commissionerProfiles[0]?.role || "").toLowerCase();
  const overrideEligible = String(league.league_tier || "").toUpperCase() === "PAID" || commissionerRole === "premium" || commissionerRole === "admin";

  useEffect(() => {
    const useLeagueRules = isLocked || (overridesEnabled && overrideEligible);
    setScoringRules(useLeagueRules ? mergeRules(defaultRules, league.scoring_rules) : mergeRules(defaultRules, {}));
  }, [defaultRules, isLocked, league.scoring_rules, overrideEligible, overridesEnabled]);

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
    mutationFn: (newRules) => appClient.functions.invoke("update_league_scoring", {
      league_id: league.id,
      scoring_overrides_enabled: overridesEnabled,
      scoring_rules: newRules,
    }),
    onSuccess: () => {
      toast.success("League scoring overrides saved!");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save scoring rules.");
    },
  });

  const toggleOverridesMutation = useMutation({
    mutationFn: (enabled) => appClient.functions.invoke("update_league_scoring", {
      league_id: league.id,
      scoring_overrides_enabled: enabled,
      scoring_rules: enabled ? scoringRules : {},
    }),
    onSuccess: () => {
      toast.success("Scoring override mode updated.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update scoring override mode.");
    },
  });

  const lockScoringMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("lock_scoring_rules", { league_id: league.id }),
    onSuccess: () => {
      toast.success("Scoring rules locked.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to lock scoring rules.");
    },
  });

  if (isLoading || !scoringRules) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  const canEditOverrides = overrideEligible && overridesEnabled && !isLocked && !setupLocked;
  const adminUpdatedAt = defaultRulesContext.sourceUpdatedAt || null;
  const syncedAt = league.scoring_rules_source_updated_at || null;
  const adminDefaultsOutOfSync = !isLocked && !overridesEnabled && adminUpdatedAt && syncedAt && new Date(adminUpdatedAt).getTime() > new Date(syncedAt).getTime();
  const disabledReason = setupLocked
    ? "League setup is locked after the draft starts."
    : isLocked
    ? `Scoring locked ${league.scoring_rules_locked_at ? new Date(league.scoring_rules_locked_at).toLocaleString() : ""}.`
    : overrideEligible
      ? "Turn on league overrides to edit scoring."
      : "Scoring overrides require a paid league or premium commissioner.";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">League Scoring Overrides</h3>
        <p className="text-sm font-bold text-gray-600">
          Unlocked leagues use admin season defaults unless eligible league overrides are turned on. Draft start locks the active rules.
        </p>
        {adminUpdatedAt && !isLocked && !overridesEnabled && (
          <p className="mt-2 text-xs font-black uppercase text-gray-500">
            Admin season defaults updated {new Date(adminUpdatedAt).toLocaleString()}
            {syncedAt ? ` | League pool synced ${new Date(syncedAt).toLocaleString()}` : " | League pool has not synced yet"}
          </p>
        )}
      </div>

      {adminDefaultsOutOfSync && (
        <div className="neo-border bg-[#FFF1E8] p-4">
          <p className="text-sm font-black uppercase">Draft pool refresh needed</p>
          <p className="mt-1 text-xs font-bold text-gray-700">
            Admin season scoring changed after this league last synced its draft pool. Re-run Prepare Draft Pool before starting the draft.
          </p>
        </div>
      )}

      <div className="neo-border flex flex-col gap-4 bg-[#EFFBFF] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase">League Overrides</p>
          <p className="text-xs font-bold text-gray-600">{disabledReason}</p>
        </div>
        <Switch
          checked={overridesEnabled}
          disabled={!overrideEligible || isLocked || setupLocked || toggleOverridesMutation.isPending}
          onCheckedChange={(checked) => toggleOverridesMutation.mutate(checked)}
          className="data-[state=checked]:bg-black"
        />
      </div>

      {!overrideEligible && !isLocked && (
        <div className="neo-border bg-[#FFF1E8] p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-[#6A4C93]" />
          <p className="font-black uppercase text-sm">
            This league is using the admin season defaults.
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
                    disabled={!canEditOverrides}
                    onChange={(newValue) => handleRuleChange(section.category, rule, newValue)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => saveOverridesMutation.mutate(scoringRules)}
        disabled={saveOverridesMutation.isPending || !canEditOverrides}
        className="neo-btn bg-[#00D9FF] text-black w-full py-4 mt-8"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveOverridesMutation.isPending ? "Saving..." : "Save League Overrides"}
      </Button>
      <Button
        onClick={() => lockScoringMutation.mutate()}
        disabled={lockScoringMutation.isPending || isLocked || setupLocked}
        className="neo-btn w-full bg-black py-4 text-[#F7B801]"
      >
        <Lock className="w-5 h-5 mr-2" />
        {lockScoringMutation.isPending ? "Locking..." : isLocked ? "Scoring Rules Locked" : "Lock Scoring Rules"}
      </Button>
    </div>
  );
}
