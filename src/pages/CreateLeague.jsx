import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Trophy, ArrowLeft, Shuffle, Shield, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_LEAGUE_PLAY_SETTINGS, DEFAULT_ROSTER_RULES, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { LeaguePlayFields, ScheduleConfigFields } from "@/components/league/LeagueConfigFields";
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
    scoring_rules: DEFAULT_SCORING_RULES,
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

  const activeLeagues = allLeagues.filter((league) => !league.archived_at);
  const activeLeagueIds = new Set(activeLeagues.map((league) => league.id));
  const activeMemberships = myMemberships.filter((membership) =>
    membership.is_active !== false && activeLeagueIds.has(membership.league_id)
  );
  const entitlements = getLeagueEntitlements(user, activeMemberships, activeLeagues);
  const userProfile = profiles[0];
  const defaultTeamName = `${userProfile?.profile_name || userProfile?.display_name || user?.full_name || "Manager"}'s Team`;
  const canCreateLeagues = entitlements.canCreateFreeLeague || entitlements.canCreatePaidLeague;
  const selectedTierCanCreate = formData.league_tier === "PAID"
    ? entitlements.canCreatePaidLeague
    : entitlements.canCreateFreeLeague;
  const teamLimits = leagueTeamLimits(formData.league_tier);

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
      return response.data.league;
    },
    onSuccess: (league) => {
      toast.success("League created successfully!");
      navigate(createPageUrl(`LeagueManage?id=${league.id}`));
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create league");
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="neo-card bg-white p-8">
          <p className="text-lg font-black uppercase text-black">Loading account...</p>
        </div>
      </div>
    );
  }

  if (!canCreateLeagues) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button onClick={() => navigate(-1)} className="neo-btn bg-white text-black mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className="neo-card bg-white p-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-[#6A4C93]" />
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Button onClick={() => navigate(-1)} className="neo-btn bg-white text-black mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back
      </Button>

      <div className="neo-card bg-black text-white p-8 mb-8 rotate-[0.5deg]">
        <div className="rotate-[-0.5deg] flex items-center gap-4">
          <Trophy className="w-12 h-12 text-[#F7B801]" />
          <div>
            <h1 className="text-orange-600 mb-2 text-4xl font-black uppercase">Create League</h1>
            <p className="text-lg font-bold text-[#F7B801]">
              Set up a randomized historical NFL season
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="neo-card bg-white p-8 space-y-6">
        <div className="neo-border p-4 bg-[#EFFBFF]">
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
            Paid league creators receive the PREMIUM tag and can create or join up to 4 leagues.
          </p>
        </div>

        {formData.league_tier === "PAID" && (
          <div className="neo-border p-4 bg-[#FFF1E8]">
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
              Paid leagues require ${centsToDollarInput(PAID_JOIN_FEE_MIN_CENTS)}-${centsToDollarInput(paidFeeMaxCents)} to join. Stripe payment collection will be added later.
            </p>
          </div>
        )}

        <div>
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
          <Label className="text-sm font-black uppercase mb-2 block">Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your league..."
            className="neo-border font-bold h-32"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeaguePlayFields
            value={formData}
            onChange={setFormData}
            showDescriptions
            fields={["draft_mode", "player_retention_mode"]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="neo-border p-4 bg-[#EFFBFF]">
            <Label className="text-sm font-black uppercase mb-2 block">Source Season Year</Label>
            <Input
              type="number"
              value={formData.source_season_year}
              onChange={(e) => setFormData({ ...formData, source_season_year: parseInt(e.target.value, 10) })}
              className="neo-border font-bold bg-white"
            />
            <p className="text-xs font-bold text-gray-600 mt-2">
              v1 uses one completed NFL season as the hidden source pool for the league.
            </p>
          </div>

          <LeaguePlayFields
            value={formData}
            onChange={setFormData}
            showDescriptions
            fields={["ranking_system"]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LeaguePlayFields
            value={formData}
            onChange={setFormData}
            fields={["schedule_type", "advancement_mode", "playoff_mode"]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ScheduleConfigFields
            value={formData.schedule_config}
            onChange={(scheduleConfig) => setFormData({ ...formData, schedule_config: scheduleConfig })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Season Length (Weeks)</Label>
            <Input
              type="number"
              value={formData.season_length_weeks}
              disabled
              className="neo-border font-bold bg-gray-100"
            />
            <p className="text-xs font-bold text-gray-500 mt-1">Set to 8 weeks for the first implementation pass.</p>
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
            <p className="text-xs font-bold text-gray-500 mt-1">
              {formData.league_tier} leagues allow {teamLimits.min}-{teamLimits.max} teams.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="neo-border p-4 bg-black text-white">
            <div className="flex items-center gap-2 mb-2">
              <Shuffle className="w-5 h-5 text-[#00D9FF]" />
              <p className="font-black uppercase">Randomization</p>
            </div>
            <p className="text-sm font-bold text-white/80">
              Each fantasy week uses per-player hidden real NFL weeks. Managers never know the source weeks before reveal.
            </p>
          </div>
          <div className="neo-border p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-[#6A4C93]" />
              <p className="font-black uppercase">Roster Rules</p>
            </div>
            <p className="text-sm font-bold text-gray-700">
              Draft 10 total: 2 QB, 2 K, 2 DEF, 2 OFF, 2 FLEX. Start 5 each week: 1 QB, 1 K, 1 DEF, 1 OFF, 1 FLEX.
            </p>
          </div>
          <div className="neo-border p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <CalendarRange className="w-5 h-5 text-[#FF6B35]" />
              <p className="font-black uppercase">Draft Config</p>
            </div>
            <p className="text-sm font-bold text-gray-700">
              Snake draft, {formData.draft_config.rounds} rounds, {formData.draft_config.timer_seconds}s timer.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 neo-border bg-[#F7B801] rounded-none">
          <div>
            <Label className="text-sm font-black uppercase block mb-1">Public League</Label>
            <p className="text-xs font-bold text-black/70">
              Allow anyone to join your league
            </p>
          </div>
          <Switch
            checked={formData.is_public}
            onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
            className="data-[state=checked]:bg-black"
          />
        </div>

        <div className="flex gap-4 pt-4">
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
