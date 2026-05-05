
import React from "react";
import { appClient, DEFAULT_DRAFT_CONFIG, DEFAULT_ROSTER_RULES, DEFAULT_SCORING_RULES } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Trophy, Users, Zap, Bot, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LeagueCard from "../components/league/LeagueCard";
import { getLeagueEntitlements } from "@/lib/entitlements";

const EMPTY_PROFILE_SRC = "/assets/Empty_Profile.jpg";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["auth-route-user"],
    queryFn: () => appClient.auth.me(),
  });

  const createAILeagueJob = useMutation({
    mutationFn: async () => {
      if (!entitlements.canCreateFreeLeague) {
        throw new Error("Your free league slot is already in use. Create a paid league to unlock premium capacity.");
      }

      const response = await appClient.functions.invoke("create_league", {
        name: `${welcomeName || "Manager"} vs AI League`,
        description: "A quick-start league filled with AI managers.",
        commissioner_email: user.email,
        team_name: `${welcomeName || "Manager"}'s Team`,
        league_tier: "FREE",
        is_public: false,
        is_sponsored: false,
        mode: "traditional",
        season_length_weeks: 8,
        max_members: 8,
        join_fee_cents: 0,
        join_fee_currency: "usd",
        source_season_year: new Date().getFullYear() - 1,
        scoring_rules: DEFAULT_SCORING_RULES,
        roster_rules: DEFAULT_ROSTER_RULES,
        draft_config: DEFAULT_DRAFT_CONFIG,
      });
      const league = response.data.league;
      await appClient.functions.invoke("fill_league_with_ai", { league_id: league.id });
      return league;
    },
    onSuccess: (league) => {
      toast.success("AI league created.");
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["all-leagues"] });
      navigate(createPageUrl(`LeagueManage?id=${league.id}`));
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create AI league.");
    }
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-memberships', user?.email],
    queryFn: () => user ? appClient.entities.LeagueMember.filter({ user_email: user.email }) : [],
    enabled: !!user
  });

  // Removed the separate commissonedLeagues query as commissioner status is now handled within myLeagues

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['all-leagues'],
    queryFn: () => appClient.entities.League.list(),
    enabled: !!user,
  });

  const myLeagueIds = myMemberships.map((m) => m.league_id);
  const activeLeagues = allLeagues.filter((league) => !league.archived_at);
  const myLeagues = activeLeagues.filter((l) => myLeagueIds.includes(l.id));

  const { data: profiles = [], isLoading: isLoadingProfile } = useQuery({
    queryKey: ["dashboard-profile", user?.email],
    queryFn: () => user ? appClient.entities.UserProfile.filter({ user_email: user.email }) : [],
    enabled: !!user,
  });
  const userProfile = profiles[0];
  const welcomeName =
    userProfile?.display_name?.trim() ||
    userProfile?.profile_name?.trim() ||
    userProfile?.first_name?.trim() ||
    user?.first_name?.trim() ||
    user?.full_name?.trim() ||
    "Manager";
  const profileName = userProfile?.profile_name?.trim() || welcomeName;
  const entitlements = getLeagueEntitlements(user, myMemberships, activeLeagues);
  const canCreateLeagues = entitlements.canCreateFreeLeague || entitlements.canCreatePaidLeague;
  const userButtonStyle = userProfile ? {
    backgroundColor: userProfile.theme_primary || "#00D9FF",
    color: userProfile.theme_secondary || "#000000",
    "--neo-shadow-color": userProfile.theme_secondary || "#000000",
  } : {
    backgroundColor: "#00D9FF",
    color: "#000000",
    "--neo-shadow-color": "#000000",
  };

  // Group leagues by role and add commissioner status
  const leaguesWithRoles = myLeagues.map(league => {
    const membership = myMemberships.find(m => m.league_id === league.id);
    const isCommissioner = league.commissioner_email === user?.email;
    
    return {
      ...league,
      isCommissioner,
      role: membership?.role_in_league
    };
  });

  if (isLoadingUser || isLoadingProfile) {
    return (
      <div className="text-slate-900 mx-auto px-4 max-w-7xl sm:px-6 lg:px-8">
        <div className="neo-card bg-white p-8 font-black uppercase text-center">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="text-slate-900 mx-auto px-4 max-w-7xl sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="neo-card bg-gradient-to-br from-[#FF6B35] to-[#F7B801] p-8 md:p-12 mb-8 rotate-[-0.5deg]">
        <div className="rotate-[0.5deg] grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-8 items-center">
          <div className="w-full max-w-[300px] justify-self-center lg:justify-self-start">
            <img
              src={userProfile?.avatar_url || EMPTY_PROFILE_SRC}
              alt={profileName}
              className="w-full aspect-square object-cover neo-border bg-white"
            />
          </div>

          <div className="text-left">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div>
                <h1 className="text-4xl md:text-6xl font-black text-black uppercase leading-tight">
                  Welcome Back!
                </h1>
                <p className="text-3xl md:text-5xl font-black text-orange-700 uppercase leading-tight mt-2">
                  {profileName}
                </p>
              </div>
              {(entitlements.tag === "PREMIUM" || entitlements.tag === "ADMIN") && (
                <span className="neo-border bg-black text-[#F7B801] px-3 py-1 text-xs font-black uppercase">
                  {entitlements.tag}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={createPageUrl("Profile")}
                className="neo-btn px-4 py-2.5 flex items-center justify-center gap-2"
                style={userButtonStyle}
              >
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt="Profile"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="font-bold text-sm">Profile</span>
              </Link>
              <Link to={createPageUrl("Leagues")}>
              <Button className="neo-btn bg-black text-[#F7B801] hover:bg-black px-6 py-5 text-base">
                <Trophy className="w-6 h-6 mr-2" />
                Browse Leagues
              </Button>
            </Link>
              <Link to={createPageUrl("Players")}>
                <Button className="neo-btn bg-white text-black hover:bg-white px-6 py-5 text-base">
                  <Users className="w-6 h-6 mr-2" />
                  Browse Players
                </Button>
              </Link>
              {user?.role === "admin" && (
                <Link to={createPageUrl("Admin")}>
                  <Button className="neo-btn bg-[#6A4C93] text-white hover:bg-[#6A4C93] px-6 py-5 text-base">
                    <ShieldCheck className="w-6 h-6 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
            {canCreateLeagues ? (
              <>
                <Link to={createPageUrl("CreateLeague")}>
                  <Button className="neo-btn bg-white text-black hover:bg-white px-6 py-5 text-base">
                    <Plus className="w-6 h-6 mr-2" />
                    Create League
                  </Button>
                </Link>
                {user?.role === "admin" && (
                  <Button
                    onClick={() => createAILeagueJob.mutate()}
                    disabled={createAILeagueJob.isPending || !user}
                    className="neo-btn bg-[#00D9FF] text-black hover:bg-[#00D9FF] px-6 py-5 text-base">
                    <Bot className="w-6 h-6 mr-2" />
                    {createAILeagueJob.isPending ? "Creating..." : "Create AI League"}
                  </Button>
                )}
              </>
            ) : (
              <Button disabled className="neo-btn bg-gray-200 text-gray-500 px-6 py-5 text-base cursor-not-allowed">
                <Plus className="w-6 h-6 mr-2" />
                Create League
              </Button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* My Leagues */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black uppercase text-black">My Leagues</h2>
        </div>

        {leaguesWithRoles.length === 0 ? (
          <div className="neo-card bg-white p-12 text-center">
            <Zap className="w-16 h-16 mx-auto mb-4 text-[#F7B801]" />
            <h3 className="text-2xl font-black uppercase mb-2">No Leagues Yet</h3>
            <p className="text-gray-600 font-bold mb-6">
              Join or create a league to start your fantasy journey
            </p>
            <Link to={createPageUrl("Leagues")}>
              <Button className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] px-8">
                Browse Leagues
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaguesWithRoles.map((league, idx) => (
              <div key={league.id} className="relative">
                <LeagueCard league={league} index={idx} />
                {/* Badge overlay */}
                <div className="absolute top-4 right-4 flex gap-2">
                  {league.isCommissioner && (
                    <div className="neo-border bg-[#6A4C93] text-white px-3 py-1 text-xs font-black uppercase">
                      Commissioner
                    </div>
                  )}
                  {!league.isCommissioner && (
                    <div className="neo-border bg-[#00D9FF] text-black px-3 py-1 text-xs font-black uppercase">
                      Member
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The separate Commissioner Section has been removed as commissioner status is now displayed directly on league cards */}
    </div>
  );
}
