
import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Edit, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Team() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(location.search);
  const membershipId = searchParams.get("id");

  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await appClient.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: membership, isLoading } = useQuery({
    queryKey: ['team-membership', membershipId],
    queryFn: async () => {
      const memberships = await appClient.entities.LeagueMember.filter({ id: membershipId });
      return memberships[0];
    },
    enabled: !!membershipId
  });

  const { data: league } = useQuery({
    queryKey: ['league', membership?.league_id],
    queryFn: async () => {
      const leagues = await appClient.entities.League.filter({ id: membership.league_id });
      return leagues[0];
    },
    enabled: !!membership
  });

  const { data: managerProfile } = useQuery({
    queryKey: ['manager-profile', membership?.user_email],
    queryFn: async () => {
      const profiles = await appClient.entities.UserProfile.filter({ user_email: membership.user_email });
      return profiles[0] || null;
    },
    enabled: !!membership
  });

  useEffect(() => {
    if (membership) {
      setTeamName(membership.team_name);
    }
  }, [membership]);

  const updateTeamMutation = useMutation({
    mutationFn: (data) => appClient.entities.LeagueMember.update(membershipId, data),
    onSuccess: () => {
      toast.success("Team updated!");
      queryClient.invalidateQueries(['team-membership', membershipId]);
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to update team");
    }
  });

  const handleSave = () => {
    updateTeamMutation.mutate({ team_name: teamName });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading Team...</p>
      </div>
    );
  }

  if (!membership || !league) {
    return <div className="text-center font-bold text-2xl text-red-500">Team not found.</div>;
  }

  const isOwner = user?.email === membership.user_email;
  const isCommissioner = user?.email === league.commissioner_email;
  const managerDisplayName = managerProfile?.display_name || managerProfile?.profile_name || "Manager";
  const managerAvatarUrl = managerProfile?.avatar_url;
  const managerProfileUrl = managerProfile?.profile_name
    ? createPageUrl(`Profile?name=${encodeURIComponent(managerProfile.profile_name)}`)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <Link to={createPageUrl(`League?id=${league.id}`)}>
          <Button className="neo-btn bg-black text-white">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to League
          </Button>
        </Link>
        <div className="flex gap-3">
          {isCommissioner && (
            <Link to={createPageUrl(`LeagueManage?id=${league.id}`)}>
              <Button className="neo-btn bg-[#6A4C93] text-white">
                <Edit className="w-5 h-5 mr-2" />
                Commissioner View
              </Button>
            </Link>
          )}
          {isOwner && !isEditing && (
            <Button onClick={() => setIsEditing(true)} className="neo-btn bg-[#00D9FF] text-black">
              <Edit className="w-5 h-5 mr-2" />
              Edit Team
            </Button>
          )}
        </div>
      </div>

      {/* Team Header */}
      <div className="neo-card bg-gradient-to-br from-[#FF6B35] to-[#F7B801] p-8 mb-8">
        <div className="flex items-start gap-6">
          {/* Team Logo */}
          <div className="flex flex-col gap-4">
            {managerAvatarUrl ? (
              <img 
                src={managerAvatarUrl}
                alt={managerDisplayName}
                className="w-32 h-32 rounded-full object-cover neo-border bg-white"
              />
            ) : (
              <div className="w-32 h-32 rounded-full neo-border bg-white flex items-center justify-center">
                <div className="text-4xl font-black text-gray-400">
                  {membership.team_name.substring(0, 2).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Team Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="neo-border font-black text-2xl bg-white"
                  placeholder="Team Name"
                />
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={updateTeamMutation.isPending} className="neo-btn bg-black text-white">
                    <Save className="w-5 h-5 mr-2" />
                    Save
                  </Button>
                  <Button onClick={() => {
                    setIsEditing(false);
                    setTeamName(membership.team_name);
                  }} className="neo-btn bg-white text-black">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-orange-600 mb-2 text-4xl font-black uppercase">
                  {membership.team_name}
                </h1>
                <p className="text-xl font-bold text-slate-900">
                  {league.name}
                </p>
                <p className="text-lg font-bold text-slate-700 mt-2">
                  Manager:{" "}
                  {managerProfileUrl ? (
                    <Link to={managerProfileUrl} className="hover:underline">
                      {managerDisplayName}
                    </Link>
                  ) : (
                    managerDisplayName
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Team Stats */}
      <div className="neo-card bg-white p-8">
        <h2 className="text-orange-600 mb-4 text-2xl font-black uppercase">TEAM STATS</h2>
        <p className="text-gray-600 font-bold">Stats coming soon...</p>
      </div>
    </div>
  );
}
