import React, { useEffect, useMemo, useState } from "react";
import { appClient, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Lock, RefreshCw, Save } from "lucide-react";

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

const errorText = (error, fallback) => {
  if (typeof error?.message === "string" && error.message !== "[object Object]") return error.message;
  if (error?.message && typeof error.message === "object") return error.message.message || JSON.stringify(error.message);
  if (error && typeof error === "object") return error.error || error.details || error.hint || JSON.stringify(error);
  return fallback;
};

const flattenRuleDifferences = (currentRules, preparedRules) => {
  if (!isCategorizedRules(preparedRules)) return [];
  const current = mergeRules(currentRules, {});
  const prepared = mergeRules(DEFAULT_SCORING_RULES, preparedRules);
  const differences = [];
  for (const [category, rules] of Object.entries(current)) {
    for (const key of Object.keys(rules || {})) {
      const currentValue = Number(rules[key]);
      const preparedValue = Number(prepared?.[category]?.[key]);
      if (Number.isFinite(currentValue) && Number.isFinite(preparedValue) && currentValue !== preparedValue) {
        differences.push({ category, key, currentValue, preparedValue });
      }
    }
  }
  return differences;
};

const listValue = (value) => (Array.isArray(value) ? value : []);
const timestampMs = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export default function LeagueScoring({ league, setupLocked = false }) {
  const queryClient = useQueryClient();
  const [scoringRules, setScoringRules] = useState(null);
  const [poolRefreshNotice, setPoolRefreshNotice] = useState(false);
  const [poolSyncConfirmation, setPoolSyncConfirmation] = useState(null);
  const [draftPoolProgress, setDraftPoolProgress] = useState(null);
  const [localScoringSyncedAt, setLocalScoringSyncedAt] = useState(null);
  const isLocked = Boolean(league.scoring_rules_locked_at);
  const overridesEnabled = league.scoring_overrides_enabled === true;

  const { data: defaultRulesContext = { rules: DEFAULT_SCORING_RULES, sourceUpdatedAt: null }, isLoading } = useQuery({
    queryKey: ["league-scoring-defaults", league.source_season_year],
    queryFn: async () => {
      const globalSettings = await appClient.entities.Global.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(globalSettings[0]?.value)) {
        return {
          rules: globalSettings[0].value,
          sourceUpdatedAt: globalSettings[0].updated_date || globalSettings[0].created_date || null,
          source: "global_default",
        };
      }
      const seasonRules = await appClient.entities.SeasonScoringRule.filter({ season_year: Number(league.source_season_year || new Date().getFullYear() - 1) });
      if (isCategorizedRules(seasonRules[0]?.rules)) {
        return {
          rules: seasonRules[0].rules,
          sourceUpdatedAt: seasonRules[0].updated_date || seasonRules[0].created_date || null,
          source: "season_fallback",
        };
      }
      const siteSettings = await appClient.entities.SiteSetting.filter({ key: "SCORING_RULES" });
      if (isCategorizedRules(siteSettings[0]?.value)) {
        return {
          rules: siteSettings[0].value,
          sourceUpdatedAt: siteSettings[0].updated_date || siteSettings[0].created_date || null,
          source: "site_fallback",
        };
      }
      return { rules: DEFAULT_SCORING_RULES, sourceUpdatedAt: null, source: "code_default" };
    },
  });
  const defaultRules = defaultRulesContext.rules || DEFAULT_SCORING_RULES;

  const { data: commissionerProfiles = [] } = useQuery({
    queryKey: ["league-commissioner-profile", league.commissioner_email],
    queryFn: () => league.commissioner_email ? appClient.entities.UserProfile.filter({ user_email: league.commissioner_email }) : [],
    enabled: !!league.commissioner_email,
  });

  const { data: draftPoolPresence = { hasPool: false, job: null } } = useQuery({
    queryKey: ["league-draft-pool-presence", league.id],
    queryFn: async () => {
      const [jobs, tiers] = await Promise.all([
        appClient.entities.LeagueDraftPoolJob.filter({ league_id: league.id }, "-updated_date", 5),
        appClient.entities.LeaguePlayerDraftTier.filter({ league_id: league.id }, "position_rank", 1),
      ]);
      const jobRows = listValue(jobs);
      const completedJob = jobRows.find((job) => String(job.status || "").toUpperCase() === "COMPLETED");
      return { hasPool: Boolean(jobRows.length || listValue(tiers).length), job: completedJob || jobRows[0] || null };
    },
    enabled: !!league.id && !isLocked,
  });

  const commissionerRole = String(commissionerProfiles[0]?.role || "").toLowerCase();
  const overrideEligible = String(league.league_tier || "").toUpperCase() === "PAID" || commissionerRole === "premium" || commissionerRole === "admin";
  const hasDraftPool = Boolean(draftPoolPresence.hasPool);
  const adminUpdatedAt = defaultRulesContext.sourceUpdatedAt || null;
  const draftPoolJob = draftPoolPresence.job || null;
  const draftPoolSourceUpdatedAt = draftPoolJob?.scoring_rules_source_updated_at || null;
  const syncedAt = localScoringSyncedAt || league.scoring_rules_source_updated_at || draftPoolSourceUpdatedAt || null;
  const leagueSyncedAt = localScoringSyncedAt || league.scoring_rules_synced_at || draftPoolJob?.updated_date || null;
  const leagueSourceUpdatedAt = league.scoring_rules_source_updated_at || draftPoolSourceUpdatedAt || null;
  const pendingScoringDifferences = flattenRuleDifferences(scoringRules, draftPoolJob?.scoring_rules_snapshot);
  const adminUpdatedMs = timestampMs(adminUpdatedAt);
  const syncedMs = timestampMs(syncedAt);
  const leagueSourceUpdatedMs = timestampMs(leagueSourceUpdatedAt);
  const leagueSyncedMs = timestampMs(leagueSyncedAt);
  const adminDefaultsOutOfSync = hasDraftPool && !isLocked && !overridesEnabled && pendingScoringDifferences.length > 0 && (
    !syncedAt ||
    (adminUpdatedMs && syncedMs && adminUpdatedMs > syncedMs)
  );
  const storedRules = useMemo(() => mergeRules(DEFAULT_SCORING_RULES, league.scoring_rules), [league.scoring_rules]);
  const activeDefaultRules = useMemo(() => mergeRules(defaultRules, {}), [defaultRules]);
  const shouldDisplayStoredRules = isLocked || overridesEnabled;

  useEffect(() => {
    setScoringRules(shouldDisplayStoredRules ? storedRules : activeDefaultRules);
  }, [activeDefaultRules, shouldDisplayStoredRules, storedRules]);

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
    onSuccess: (result) => {
      setPoolRefreshNotice(Boolean(result?.draft_pool_invalidated));
      if (result?.draft_pool_invalidated) {
        setPoolSyncConfirmation(null);
      }
      toast.success("League scoring overrides saved!");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-pool-presence", league.id] });
    },
    onError: (error) => {
      toast.error(errorText(error, "Failed to save scoring rules."));
    },
  });

  const toggleOverridesMutation = useMutation({
    mutationFn: (enabled) => appClient.functions.invoke("update_league_scoring", {
      league_id: league.id,
      scoring_overrides_enabled: enabled,
      scoring_rules: enabled ? activeDefaultRules : {},
    }),
    onSuccess: (result) => {
      setPoolRefreshNotice(Boolean(result?.draft_pool_invalidated));
      if (result?.draft_pool_invalidated) {
        setPoolSyncConfirmation(null);
      }
      toast.success("Scoring override mode updated.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-pool-presence", league.id] });
    },
    onError: (error) => {
      toast.error(errorText(error, "Failed to update scoring override mode."));
    },
  });

  const declineAdminScoringMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("update_league_scoring", {
      league_id: league.id,
      decline_admin_scoring_change: true,
    }),
    onSuccess: (result) => {
      setPoolRefreshNotice(false);
      setLocalScoringSyncedAt(result?.league?.scoring_rules_synced_at || new Date().toISOString());
      setPoolSyncConfirmation("League declined the admin scoring change and kept its current calculated scoring as league-specific rules.");
      toast.success("Admin scoring change declined.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-pool-presence", league.id] });
      queryClient.invalidateQueries({ queryKey: ["draft-eligible-players", league.id] });
    },
    onError: (error) => {
      toast.error(errorText(error, "Failed to decline admin scoring change."));
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
      toast.error(errorText(error, "Failed to lock scoring rules."));
    },
  });

  const prepareDraftPoolMutation = useMutation({
    mutationFn: () => appClient.draftDay.preparePool({
      leagueId: league.id,
      force: true,
      onProgress: (progress) => setDraftPoolProgress(progress),
    }),
    onSuccess: (result) => {
      const completed = result?.complete || String(result?.status || result?.job?.status || "").toUpperCase() === "COMPLETED";
      if (completed) {
        setPoolRefreshNotice(false);
        setLocalScoringSyncedAt(result?.source_updated_at || defaultRulesContext.sourceUpdatedAt || new Date().toISOString());
        setPoolSyncConfirmation(overridesEnabled
          ? "League draft pool data now matches the current league scoring overrides."
          : "League draft pool data now matches the default admin scoring data.");
      }
      setDraftPoolProgress(result);
      toast.success(completed ? "Draft pool refreshed." : "Draft pool refresh started.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-state", league.id] });
      queryClient.invalidateQueries({ queryKey: ["league-draft-pool-presence", league.id] });
      queryClient.invalidateQueries({ queryKey: ["draft-eligible-players", league.id] });
      queryClient.removeQueries({ queryKey: ["draft-eligible-players", league.id] });
    },
    onError: (error) => {
      toast.error(errorText(error, "Failed to refresh draft pool."));
    },
  });

  if (isLoading || !scoringRules) {
    return <div className="h-96 neo-border bg-gray-100 animate-pulse" />;
  }

  const canEditOverrides = overrideEligible && overridesEnabled && !isLocked && !setupLocked;
  const leagueOverrideOutOfSync = hasDraftPool && !isLocked && overridesEnabled && Boolean(leagueSourceUpdatedAt) && (
    !leagueSyncedAt ||
    (leagueSourceUpdatedMs && leagueSyncedMs && leagueSourceUpdatedMs > leagueSyncedMs)
  );
  const draftPoolRefreshNeeded = poolRefreshNotice || adminDefaultsOutOfSync || leagueOverrideOutOfSync;
  const showPoolSyncConfirmation = Boolean(poolSyncConfirmation) && !draftPoolRefreshNeeded;
  const disabledReason = setupLocked
    ? "League setup is locked after the draft starts."
    : isLocked
    ? `Scoring locked ${league.scoring_rules_locked_at ? new Date(league.scoring_rules_locked_at).toLocaleString() : ""}.`
    : overridesEnabled
      ? "League-specific scoring is active."
      : overrideEligible
        ? "Turn on league overrides to edit scoring."
        : "League scoring overrides require a paid league or Pro commissioner access.";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">League Scoring Overrides</h3>
        <p className="text-sm font-bold text-gray-600">
          Unlocked leagues use admin season defaults unless eligible league overrides are turned on. Draft start locks the active rules.
        </p>
        {adminUpdatedAt && !isLocked && !overridesEnabled && (
          <p className="mt-2 text-xs font-black uppercase text-gray-500">
            Admin defaults updated {new Date(adminUpdatedAt).toLocaleString()}
            {hasDraftPool
              ? syncedAt ? ` | League pool synced ${new Date(syncedAt).toLocaleString()}` : " | League pool has not synced yet"
              : " | No draft pool prepared yet"}
          </p>
        )}
      </div>

      {(draftPoolRefreshNeeded || showPoolSyncConfirmation) && (
        <div className={`neo-border flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between ${draftPoolRefreshNeeded ? "bg-[#FFF1E8]" : "bg-[#E7FFD9]"}`}>
          <div>
            <p className="text-sm font-black uppercase">
              {draftPoolRefreshNeeded ? "Draft pool refresh needed" : "Draft pool scoring synced"}
            </p>
            <p className="mt-1 text-xs font-bold text-gray-700">
              {draftPoolRefreshNeeded
                ? overridesEnabled
                  ? "League scoring overrides changed after the draft pool was prepared. Refresh the draft pool before starting the draft."
                  : "Admin season scoring changed after this league last synced its draft pool. Refresh the draft pool before starting the draft."
                : poolSyncConfirmation}
            </p>
            {(prepareDraftPoolMutation.isPending || draftPoolProgress?.progress) && (
              <p className="mt-2 text-xs font-black uppercase text-gray-500">
                {prepareDraftPoolMutation.isPending ? "Refreshing" : String(draftPoolProgress?.status || "Updated").toUpperCase()}
                {draftPoolProgress?.progress ? ` | ${Number(draftPoolProgress.progress)}%` : ""}
                {draftPoolProgress?.total_players ? ` | ${draftPoolProgress.processed_players || 0}/${draftPoolProgress.total_players} players checked` : ""}
              </p>
            )}
          </div>
          {draftPoolRefreshNeeded && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {overrideEligible && adminDefaultsOutOfSync && pendingScoringDifferences.length > 0 && (
                <Button
                  onClick={() => declineAdminScoringMutation.mutate()}
                  disabled={declineAdminScoringMutation.isPending || prepareDraftPoolMutation.isPending || setupLocked}
                  className="neo-btn bg-white text-black"
                >
                  {declineAdminScoringMutation.isPending ? "Declining..." : "Decline Admin Change"}
                </Button>
              )}
              <Button
                onClick={() => prepareDraftPoolMutation.mutate()}
                disabled={prepareDraftPoolMutation.isPending || declineAdminScoringMutation.isPending || setupLocked}
                className="neo-btn bg-[#00D9FF] text-black"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${prepareDraftPoolMutation.isPending ? "animate-spin" : ""}`} />
                {prepareDraftPoolMutation.isPending ? "Refreshing Pool" : "Refresh Draft Pool"}
              </Button>
            </div>
          )}
        </div>
      )}

      {draftPoolRefreshNeeded && pendingScoringDifferences.length > 0 && (
        <div className="neo-border bg-white p-4">
          <p className="text-sm font-black uppercase">Pending Scoring Changes</p>
          <p className="mt-1 text-xs font-bold text-gray-600">
            These values changed since this draft pool was last calculated.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b-4 border-black text-left text-xs font-black uppercase">
                  <th className="py-2 pr-3">Rule</th>
                  <th className="py-2 pr-3">Current</th>
                  <th className="py-2 pr-3">Pool Used</th>
                </tr>
              </thead>
              <tbody>
                {pendingScoringDifferences.map((difference) => (
                  <tr key={`${difference.category}.${difference.key}`} className="border-b-2 border-gray-200 font-bold">
                    <td className="py-2 pr-3 uppercase">{difference.category} / {difference.key.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3">{difference.currentValue}</td>
                    <td className="py-2 pr-3">{difference.preparedValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {!overridesEnabled && !isLocked && (
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
