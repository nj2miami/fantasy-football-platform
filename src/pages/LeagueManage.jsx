
import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Settings, Users, PenSquare, BarChart, Eye, Grid, Bot, ShieldAlert, Trash2 } from "lucide-react";
import LeagueSettings from "../components/league/LeagueSettings";
import LeagueScoring from "../components/league/LeagueScoring";
import LeagueMembers from "../components/league/LeagueMembers";
import LeagueDraftSettings from "../components/league/LeagueDraftSettings";
import LeagueRosterSettings from "../components/league/LeagueRosterSettings";
import LeagueAITeams from "../components/league/LeagueAITeams";

export default function LeagueManage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(location.search);
  const leagueId = searchParams.get("id");
  const asAdmin = searchParams.get("asAdmin") === 'true';

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("settings");
  const [isLoading, setIsLoading] = useState(true); // Added isLoading state

  useEffect(() => {
    const loadUser = async () => {
      setIsLoading(true); // Set loading to true at the start
      try {
        const currentUser = await appClient.auth.me();
        setUser(currentUser);
        if (asAdmin && currentUser.role !== 'admin') {
            toast.error("You do not have permission to view this page.");
            navigate(createPageUrl("Dashboard"));
            return;
        }
      } catch {
        navigate(createPageUrl("Dashboard"));
      } finally {
        setIsLoading(false); // Set loading to false when done, regardless of success/failure
      }
    };
    loadUser();
  }, [navigate, asAdmin]);

  const { data: league, isLoading: isLoadingLeague, error: leagueError } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const leagues = await appClient.entities.League.filter({ id: leagueId });
      return leagues[0];
    },
    enabled: !!leagueId && !isLoading, // Enabled only when leagueId exists and initial user loading is complete
  });

  const { data: members = [] } = useQuery({
    queryKey: ["league-manage-members", leagueId],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: leagueId }),
    enabled: !!leagueId && !!user,
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ["league-manage-seasons", leagueId],
    queryFn: () => appClient.entities.Season.filter({ league_id: leagueId }),
    enabled: !!leagueId && !!user,
  });

  const { data: commissionerProfile } = useQuery({
    queryKey: ["league-manage-commissioner-profile", league?.commissioner_email],
    queryFn: async () => {
      if (!league?.commissioner_email) return null;
      const profiles = await appClient.entities.UserProfile.filter({ user_email: league.commissioner_email });
      return profiles[0] || null;
    },
    enabled: !!league?.commissioner_email,
  });

  const isCommissionerMember = members.some((member) =>
    member.is_active !== false &&
    member.role_in_league === "COMMISSIONER" &&
    (member.user_email === user?.email || member.profile_id === user?.id)
  );
  const isAdmin = user?.role === "admin";
  const canManageLeague = Boolean(
    asAdmin ||
    isAdmin ||
    (user && league && (user.email === league.commissioner_email || league.commissioner_id === user.id || isCommissionerMember))
  );
  const activePaidJoinedMembers = members.filter((member) =>
    member.is_active !== false &&
    !member.is_ai &&
    member.role_in_league !== "COMMISSIONER" &&
    member.user_email !== league?.commissioner_email
  );
  const leagueHasBegun = seasons.length > 0;
  const paidMembersJoined = league?.league_tier === "PAID" && activePaidJoinedMembers.length > 0;
  const commissionerDeleteDisabled = !isAdmin && (leagueHasBegun || paidMembersJoined);
  const deleteDisabledReason = leagueHasBegun
    ? "League has begun"
    : paidMembersJoined
      ? "Paid members joined"
      : "";

  useEffect(() => {
    if (!asAdmin && user && league && user.email !== league.commissioner_email && league.commissioner_id !== user.id && !isCommissionerMember) {
      toast.error("You are not the commissioner of this league.");
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, league, members, navigate, asAdmin, isCommissionerMember]);

  const archiveMutation = useMutation({
    mutationFn: () => appClient.functions.invoke("archive_league", { league_id: league.id, archive_reason: "Deleted by commissioner" }),
    onSuccess: () => {
      toast.success("League deleted.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      navigate(createPageUrl("Dashboard"));
    },
    onError: (error) => toast.error(error.message || "Failed to archive league."),
  });

  // Wait for all initial data to load
  if (isLoading || isLoadingLeague) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading League...</p>
      </div>
    );
  }

  if (leagueError || !league) return <div className="text-center font-bold text-2xl text-red-500">Error: League not found.</div>;

  const commissionerPrimary = commissionerProfile?.theme_primary || "#000000";
  const commissionerSecondary = commissionerProfile?.theme_secondary || "#FFFFFF";
  const commissionerControlStyle = {
    backgroundColor: commissionerPrimary,
    color: commissionerSecondary,
    "--neo-shadow-color": commissionerSecondary,
  };

  const tabs = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'scoring', label: 'Scoring', icon: BarChart },
    { id: 'roster', label: 'Roster', icon: Grid },
    { id: 'draft', label: 'Draft', icon: PenSquare },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'ai_teams', label: 'AI Teams', icon: Bot },
  ];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {asAdmin && (
          <div className="neo-card bg-red-500 text-white p-4 mb-6 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6"/>
              <p className="font-black uppercase">You are viewing as a Site Administrator.</p>
          </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="neo-btn bg-black text-white">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Button>
        <Link to={createPageUrl(`League?id=${league.id}`)}>
            <Button className="neo-btn bg-white text-black">
                <Eye className="w-5 h-5 mr-2" />
                View as Member
            </Button>
        </Link>
        {canManageLeague && (
          <Button
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending || !!league.archived_at || commissionerDeleteDisabled}
            title={deleteDisabledReason}
            className={`neo-btn ${commissionerDeleteDisabled || league.archived_at ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-red-500 text-white"}`}
          >
            <Trash2 className="w-5 h-5 mr-2" />
            {league.archived_at ? "Deleted" : deleteDisabledReason || "Delete"}
          </Button>
        )}
      </div>

      <div className="neo-card p-8 mb-8 rotate-[-0.5deg]" style={commissionerControlStyle}>
        <div className="rotate-[0.5deg] flex items-center gap-4">
          <Trophy className="w-12 h-12" style={{ color: commissionerSecondary }} />
          <div>
            <h1 className="text-4xl font-black uppercase mb-2">
              Manage League: {league.name}
            </h1>
            <p className="text-lg font-bold opacity-80">
              Commissioner Controls
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`neo-btn px-6 py-3 flex items-center gap-2 ${activeTab === tab.id ? 'bg-black text-[#F7B801]' : 'bg-white text-black'}`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="neo-card bg-white p-8">
        {activeTab === 'settings' && <LeagueSettings league={league} />}
        {activeTab === 'scoring' && <LeagueScoring league={league} />}
        {activeTab === 'roster' && <LeagueRosterSettings league={league} />}
        {activeTab === 'members' && <LeagueMembers league={league} />}
        {activeTab === 'draft' && <LeagueDraftSettings league={league} />}
        {activeTab === 'ai_teams' && <LeagueAITeams league={league} />}
      </div>
    </div>
  );
}
