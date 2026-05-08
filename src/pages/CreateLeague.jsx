import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_LEAGUE_PLAY_SETTINGS, DEFAULT_ROSTER_RULES } from "@/api/appClient";
import { LeaguePlayFields } from "@/components/league/LeagueConfigFields";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLeagueEntitlements, leagueTeamLimits, PAID_LEAGUE_MIN_TEAMS, validateLeagueTeamCount } from "@/lib/entitlements";

const PAID_JOIN_FEE_MIN_CENTS = 500;
const PAID_JOIN_FEE_DEFAULT_MAX_CENTS = 5000;

function centsToDollarInput(cents) {
  const numericCents = Number(cents);
  if (!Number.isFinite(numericCents)) return "";
  return (numericCents / 100).toFixed(2);
}

function dollarsToCents(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return NaN;
  return Math.round(numericValue * 100);
}

const listValue = (value) => (Array.isArray(value) ? value : []);

function errorText(error, fallback) {
  if (typeof error?.message === "string" && error.message !== "[object Object]") return error.message;
  if (error?.functionName || error?.status) {
    return `${error.functionName || "create_league"} failed${error.status ? ` with status ${error.status}` : ""} but returned no error details. Check Supabase Edge Function logs.`;
  }
  if (error?.message && typeof error.message === "object") {
    const nested = error.message.message || error.message.details || error.message.hint || error.message.code;
    if (typeof nested === "string") return nested;
    const serializedMessage = JSON.stringify(error.message);
    if (serializedMessage && serializedMessage !== "{}") return serializedMessage;
  }
  if (error && typeof error === "object") {
    const nested = error.error || error.details || error.hint || error.code;
    if (typeof nested === "string") return nested;
    const serializedError = JSON.stringify(error);
    if (serializedError && serializedError !== "{}") return serializedError;
  }
  return fallback;
}

function FormSection({ title, description, children }) {
  return (
    <section className="border-t-4 border-black pt-6">
      <div className="mb-5">
        <h2 className="text-2xl font-black uppercase text-black">{title}</h2>
        {description && <p className="mt-1 text-sm font-bold text-gray-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function CreateLeague() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    league_tier: "FREE",
    is_public: true,
    mode: "traditional",
    ...DEFAULT_LEAGUE_PLAY_SETTINGS,
    season_length_weeks: 8,
    max_members: 8,
    join_fee_cents: 0,
    join_fee_currency: "usd",
    source_season_year: new Date().getFullYear() - 1,
    roster_rules: DEFAULT_ROSTER_RULES,
    scoring_rules: {},
    scoring_overrides_enabled: false,
    lock_scoring_rules: false,
    draft_config: DEFAULT_DRAFT_CONFIG,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await appClient.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  const { data: myMemberships = [], isLoading: isLoadingMemberships } = useQuery({
    queryKey: ["create-league-memberships", user?.email],
    queryFn: () => user ? appClient.entities.LeagueMember.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });

  const { data: allLeagues = [], isLoading: isLoadingLeagues } = useQuery({
    queryKey: ["create-league-all-leagues"],
    queryFn: () => appClient.entities.League.list(),
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["create-league-profile", user?.email],
    queryFn: () => user ? appClient.entities.UserProfile.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });

  const { data: paidFeeMaxCents = PAID_JOIN_FEE_DEFAULT_MAX_CENTS, isLoading: isLoadingFeeSettings } = useQuery({
    queryKey: ["paid-league-join-fee-max"],
    queryFn: async () => {
      const settings = await appClient.entities.SiteSetting.filter({ key: "PAID_LEAGUE_JOIN_FEE_MAX_CENTS" });
      const rawValue = settings[0]?.value;
      const parsed = typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string"
          ? Number(rawValue)
          : Number(rawValue?.amount_cents || rawValue?.value || PAID_JOIN_FEE_DEFAULT_MAX_CENTS);
      return Number.isFinite(parsed) && parsed >= PAID_JOIN_FEE_MIN_CENTS ? parsed : PAID_JOIN_FEE_DEFAULT_MAX_CENTS;
    },
    enabled: !!user,
  });

  const { data: latestSourceSeasonYear } = useQuery({
    queryKey: ["latest-source-season-year"],
    queryFn: () => appClient.playerStats.latestSourceSeasonYear(),
    enabled: !!user,
  });

  const { data: availableSourceSeasonYears = [] } = useQuery({
    queryKey: ["available-source-season-years"],
    queryFn: () => appClient.playerStats.availableSourceSeasonYears(),
    enabled: !!user,
  });

  useEffect(() => {
    const calendarFallbackYear = new Date().getFullYear() - 1;
    const preferredYear = availableSourceSeasonYears[0] || latestSourceSeasonYear;
    if (!preferredYear || formData.source_season_year !== calendarFallbackYear) return;
    setFormData((current) => ({
      ...current,
      source_season_year: preferredYear,
    }));
  }, [availableSourceSeasonYears, formData.source_season_year, latestSourceSeasonYear]);

  const activeLeagues = listValue(allLeagues).filter((league) => !league.archived_at);
  const activeLeagueIds = new Set(activeLeagues.map((league) => league.id));
  const activeMemberships = listValue(myMemberships).filter((membership) =>
    membership.is_active !== false && activeLeagueIds.has(membership.league_id)
  );
  const entitlements = getLeagueEntitlements(user, activeMemberships, activeLeagues);
  const userProfile = listValue(profiles)[0];
  const defaultTeamName = `${userProfile?.profile_name || userProfile?.display_name || user?.full_name || "Manager"}'s Team`;
  const canCreateLeagues = entitlements.canCreateFreeLeague || entitlements.canCreatePaidLeague;
  const selectedTierCanCreate = formData.league_tier === "PAID"
    ? entitlements.canCreatePaidLeague
    : entitlements.canCreateFreeLeague;
  const teamLimits = leagueTeamLimits(formData.league_tier);
  const updateScheduleConfig = (patch) => setFormData((current) => ({
    ...current,
    schedule_config: {
      ...current.schedule_config,
      ...patch,
    },
  }));

  useEffect(() => {
    if (!entitlements.canCreateFreeLeague && entitlements.canCreatePaidLeague && formData.league_tier !== "PAID") {
      setFormData((current) => ({
        ...current,
        league_tier: "PAID",
        max_members: Math.max(PAID_LEAGUE_MIN_TEAMS, current.max_members),
        join_fee_cents: current.join_fee_cents || PAID_JOIN_FEE_MIN_CENTS,
        join_fee_currency: "usd",
      }));
    }
  }, [entitlements.canCreateFreeLeague, entitlements.canCreatePaidLeague, formData.league_tier]);

  const validateJoinFee = (data) => {
    if (data.league_tier !== "PAID") return null;
    if (!Number.isInteger(data.join_fee_cents)) return "Enter a valid amount to join.";
    if (data.join_fee_cents < PAID_JOIN_FEE_MIN_CENTS) return "Paid league join amount must be at least $5.00.";
    if (data.join_fee_cents > paidFeeMaxCents) return `Paid league join amount cannot exceed $${centsToDollarInput(paidFeeMaxCents)}.`;
    return null;
  };

  const createLeagueMutation = useMutation({
    mutationFn: async (data) => {
      if (!selectedTierCanCreate) {
        throw new Error(data.league_tier === "PAID"
          ? "You have reached your premium league limit."
          : "Your free league slot is already in use. Create a paid league to unlock premium capacity.");
      }

      const teamCountError = validateLeagueTeamCount(data.league_tier, data.max_members);
      if (teamCountError) {
        throw new Error(teamCountError);
      }
      const joinFeeError = validateJoinFee(data);
      if (joinFeeError) {
        throw new Error(joinFeeError);
      }

      const response = await appClient.functions.invoke("create_league", {
        ...data,
        mode: data.draft_mode === "weekly_redraft" ? "weekly_redraft" : "traditional",
        join_fee_cents: data.league_tier === "PAID" ? data.join_fee_cents : 0,
        join_fee_currency: "usd",
        commissioner_email: user.email,
        team_name: defaultTeamName,
      });
      return response.league;
    },
    onSuccess: (league) => {
      toast.success("League created successfully!");
      navigate(createPageUrl(`LeagueManage?id=${league.id}`));
    },
    onError: (error) => {
      toast.error(errorText(error, "create_league failed without details. Check Supabase Edge Function logs."));
      console.error(error);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("League name is required");
      return;
    }
    const teamCountError = validateLeagueTeamCount(formData.league_tier, formData.max_members);
    if (teamCountError) {
      toast.error(teamCountError);
      return;
    }
    const joinFeeError = validateJoinFee(formData);
    if (joinFeeError) {
      toast.error(joinFeeError);
      return;
    }
    createLeagueMutation.mutate(formData);
  };

  if (isLoadingUser || isLoadingMemberships || isLoadingLeagues || isLoadingFeeSettings) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <p className="border-t-4 border-black pt-6 text-lg font-black uppercase text-black">Loading account...</p>
      </div>
    );
  }

  if (!canCreateLeagues) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Button onClick={() => navigate(-1)} className="neo-btn bg-white text-black mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className="border-t-4 border-black pt-8 text-center">
          <h1 className="text-4xl font-black uppercase mb-3 text-black">League Limit Reached</h1>
          <p className="text-lg font-bold text-gray-700 mb-6">
            Your current league limit is full. Premium managers can create or join up to 4 leagues.
          </p>
          <Button
            onClick={() => navigate(createPageUrl("Leagues"))}
            className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] px-8"
          >
            Browse Leagues
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <Button onClick={() => navigate(-1)} className="neo-btn bg-white text-black mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </Button>

      <header className="mb-8 border-b-4 border-black pb-5">
        <p className="text-sm font-black uppercase text-orange-600">League Setup</p>
        <h1 className="mt-1 text-4xl font-black uppercase text-black">Create League</h1>
        <p className="mt-2 max-w-3xl text-base font-bold text-gray-700">
          Set the required league details first, then tune draft, scoring, and schedule rules.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        <FormSection title="League Basics" description="These are the visible setup choices managers need to understand before joining.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-sm font-black uppercase mb-2 block">League Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter league name..."
                className="neo-border font-bold text-lg"
                required
              />
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">League Type</Label>
              <Select
                value={formData.league_tier}
                onValueChange={(value) => {
                  const limits = leagueTeamLimits(value);
                  setFormData({
                    ...formData,
                    league_tier: value,
                    max_members: Math.min(Math.max(formData.max_members, limits.min), limits.max),
                    join_fee_cents: value === "PAID" ? (formData.join_fee_cents || PAID_JOIN_FEE_MIN_CENTS) : 0,
                    join_fee_currency: "usd",
                  });
                }}
              >
                <SelectTrigger className="neo-border font-bold bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE" disabled={!entitlements.canCreateFreeLeague}>
                    Free League - 4 to 8 teams
                  </SelectItem>
                  <SelectItem value="PAID" disabled={!entitlements.canCreatePaidLeague}>
                    Paid League - 4 to 16 teams
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs font-bold text-gray-600 mt-2">
                Premium managers can create or join up to 4 leagues.
              </p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Start Date</Label>
              <Input
                type="date"
                value={formData.schedule_config.start_date || ""}
                onChange={(e) => updateScheduleConfig({ start_date: e.target.value })}
                className="neo-border font-bold bg-white"
              />
              <p className="text-xs font-bold text-gray-600 mt-2">First scheduled game date.</p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Weeks</Label>
              <Input
                type="number"
                value={formData.season_length_weeks}
                disabled
                className="neo-border font-bold bg-gray-100"
              />
              <p className="text-xs font-bold text-gray-600 mt-2">Set to 8 weeks for the first implementation pass.</p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Max Members</Label>
              <Input
                type="number"
                min={teamLimits.min}
                max={teamLimits.max}
                step="2"
                value={formData.max_members}
                onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value, 10) })}
                className="neo-border font-bold"
              />
              <p className="text-xs font-bold text-gray-600 mt-2">
                {formData.league_tier} leagues allow {teamLimits.min}-{teamLimits.max} teams.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-l-4 border-black pl-4">
              <div>
                <Label className="text-sm font-black uppercase block mb-1">Public League</Label>
                <p className="text-xs font-bold text-black/70">Allow anyone to join.</p>
              </div>
              <Switch
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                className="data-[state=checked]:bg-black"
              />
            </div>
          </div>

          {formData.league_tier === "PAID" && (
            <div className="mt-5 max-w-sm">
              <Label className="text-sm font-black uppercase mb-2 block">Amount to Join *</Label>
              <div className="flex items-center gap-3">
                <span className="font-black text-2xl">$</span>
                <Input
                  type="number"
                  min={centsToDollarInput(PAID_JOIN_FEE_MIN_CENTS)}
                  max={centsToDollarInput(paidFeeMaxCents)}
                  step="0.01"
                  value={centsToDollarInput(formData.join_fee_cents || PAID_JOIN_FEE_MIN_CENTS)}
                  onChange={(e) => setFormData({
                    ...formData,
                    join_fee_cents: dollarsToCents(e.target.value),
                    join_fee_currency: "usd",
                  })}
                  className="neo-border font-bold text-lg bg-white"
                  required
                />
              </div>
              <p className="text-xs font-bold text-gray-600 mt-2">
                Paid leagues require ${centsToDollarInput(PAID_JOIN_FEE_MIN_CENTS)}-${centsToDollarInput(paidFeeMaxCents)} to join.
              </p>
            </div>
          )}

          <div className="mt-5">
            <Label className="text-sm font-black uppercase mb-2 block">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your league..."
              className="neo-border font-bold h-24"
            />
          </div>
        </FormSection>

        <FormSection title="Draft And Rosters" description="Choose how often managers draft and whether season rosters keep players or release them after limited starts.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <LeaguePlayFields
              value={formData}
              onChange={setFormData}
              showDescriptions
              plain
              fields={["draft_mode", "player_retention_mode"]}
            />
          </div>
        </FormSection>

        <FormSection title="Season Source And Scoring" description="Pick the hidden statistical season and the standings format for scoring results.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Source Season Year</Label>
              {availableSourceSeasonYears.length ? (
                <Select
                  value={String(formData.source_season_year)}
                  onValueChange={(value) => setFormData({ ...formData, source_season_year: Number(value) })}
                >
                  <SelectTrigger className="neo-border font-bold bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSourceSeasonYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  value={formData.source_season_year}
                  onChange={(e) => setFormData({ ...formData, source_season_year: parseInt(e.target.value, 10) })}
                  className="neo-border font-bold bg-white"
                />
              )}
              <p className="text-xs font-bold text-gray-600 mt-2">
                Completed NFL season used as the hidden source pool.
              </p>
            </div>

            <LeaguePlayFields
              value={formData}
              onChange={setFormData}
              showDescriptions
              plain
              fields={["ranking_system"]}
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-l-4 border-black pl-4">
            <div>
              <Label className="text-sm font-black uppercase block mb-1">Lock Scoring Rules Now</Label>
              <p className="text-xs font-bold text-black/70">
                Freeze the current admin season defaults immediately instead of waiting for draft start.
              </p>
            </div>
            <Switch
              checked={formData.lock_scoring_rules}
              onCheckedChange={(checked) => setFormData({ ...formData, lock_scoring_rules: checked })}
              className="data-[state=checked]:bg-black"
            />
          </div>
        </FormSection>

        <FormSection title="Schedule And Playoffs" description="Set matchup structure, week advancement, playoff roster behavior, and schedule generation.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <LeaguePlayFields
              value={formData}
              onChange={setFormData}
              showDescriptions
              plain
              fields={["schedule_type", "advancement_mode", "playoff_mode"]}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Schedule Pattern</Label>
              <Select
                value={formData.schedule_config.type}
                onValueChange={(type) => updateScheduleConfig({ type })}
              >
                <SelectTrigger className="neo-border font-bold bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_day">One Day</SelectItem>
                  <SelectItem value="interval">Every X Days</SelectItem>
                  <SelectItem value="preset">Preset Dates</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs font-bold text-gray-600 mt-2">How generated schedule dates are spaced.</p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Games / Period</Label>
              <Input
                type="number"
                min="1"
                value={formData.schedule_config.games_per_period || 1}
                onChange={(e) => updateScheduleConfig({ games_per_period: Number(e.target.value) || 1 })}
                className="neo-border font-bold bg-white"
              />
              <p className="text-xs font-bold text-gray-600 mt-2">Matchups generated inside each schedule period.</p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Period Days</Label>
              <Input
                type="number"
                min="1"
                value={formData.schedule_config.period_days || 7}
                onChange={(e) => updateScheduleConfig({ period_days: Number(e.target.value) || 7 })}
                className="neo-border font-bold bg-white"
              />
              <p className="text-xs font-bold text-gray-600 mt-2">Days between schedule periods for interval schedules.</p>
            </div>
          </div>
        </FormSection>

        <FormSection title="League Defaults" description="These defaults can be tuned later from commissioner tools as the league workflow expands.">
          <dl className="grid grid-cols-1 gap-4 text-sm font-bold text-gray-700 md:grid-cols-3">
            <div>
              <dt className="font-black uppercase text-black">Draft</dt>
              <dd>Snake draft, {formData.draft_config.rounds} rounds, {formData.draft_config.timer_seconds}s timer.</dd>
            </div>
            <div>
              <dt className="font-black uppercase text-black">Rosters</dt>
              <dd>Draft 10 total and start 5 each week: QB, K, DEF, OFF, FLEX.</dd>
            </div>
            <div>
              <dt className="font-black uppercase text-black">Results</dt>
              <dd>Each fantasy week reveals hidden real NFL weeks assigned per NFL team.</dd>
            </div>
          </dl>
        </FormSection>

        <div className="flex flex-col gap-4 border-t-4 border-black pt-6 sm:flex-row">
          <Button type="button" onClick={() => navigate(-1)} className="neo-btn bg-gray-200 text-black hover:bg-gray-200 flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={createLeagueMutation.isPending || !selectedTierCanCreate} className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] flex-1">
            {createLeagueMutation.isPending ? "Creating..." : "Create League"}
          </Button>
        </div>
      </form>
    </div>
  );
}
