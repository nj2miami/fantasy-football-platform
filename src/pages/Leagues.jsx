
import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus } from "lucide-react"; // Only Plus remains here
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import LeagueCard from "../components/league/LeagueCard"; // New component import
import { getLeagueEntitlements } from "@/lib/entitlements";

export default function Leagues() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      setIsLoading(true);
      try {
        const currentUser = await appClient.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const { data: leagues = [], isLoading: isLoadingLeagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => appClient.entities.League.list('-created_date')
  });

  const { data: myMemberships = [], isLoading: isLoadingMemberships } = useQuery({
    queryKey: ['my-memberships', user?.email], // Keep original query key for my-memberships
    queryFn: () => user ? appClient.entities.LeagueMember.filter({ user_email: user.email }) : [],
    enabled: !!user // Only run this query if user is available
  });

  const { data: allUserProfiles = [], isLoading: isLoadingUserProfiles } = useQuery({
    queryKey: ['all-user-profiles'],
    queryFn: () => appClient.entities.UserProfile.list(),
    // Enabled when user is loaded to ensure profiles are available for commissioner display
    enabled: !!user 
  });

  const joinLeagueMutation = useMutation({
    mutationFn: async (leagueId) => {
      if (!entitlements.canJoinLeague) {
        throw new Error("Your league limit is full. Premium managers can join up to 4 leagues.");
      }
      const profile = allUserProfiles.find((item) => item.user_email === user.email);
      return appClient.functions.invoke("join_league", {
        league_id: leagueId,
        team_name: `${profile?.profile_name || profile?.display_name || user.full_name || "Manager"}'s Team`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['league-members-count'] });
      toast.success("Successfully joined league!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to join league");
    }
  });

  const joinInviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteCode.trim()) throw new Error("Enter an invite code.");
      const profile = allUserProfiles.find((item) => item.user_email === user.email);
      return appClient.functions.invoke("join_league_by_invite", {
        code: inviteCode,
        team_name: `${profile?.profile_name || profile?.display_name || user.full_name || "Manager"}'s Team`,
      });
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['my-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      setInviteCode("");
      toast.success(`Joined ${data?.league?.name || "league"}!`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to join with invite code");
    }
  });

  // Calculate derived states based on fetched data
  const myLeagueIds = myMemberships.map((m) => m.league_id);
  const activeLeagues = leagues.filter((l) => !l.archived_at);
  const publicLeagues = activeLeagues.filter((l) => l.is_public);
  const entitlements = getLeagueEntitlements(user, myMemberships, leagues);

  // Wait for initial data to load before rendering the main content
  if (isLoading || isLoadingLeagues) { // Removed isLoadingMemberships and isLoadingUserProfiles from blocking
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading Leagues...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="neo-card bg-gradient-to-r from-[#FF6B35] to-[#F7B801] p-8 mb-8 rotate-[-0.5deg]">
        <div className="rotate-[0.5deg] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-orange-600 mb-3 text-4xl font-black uppercase md:text-5xl">ALL LEAGUES</h1>
            <p className="text-slate-950 text-lg font-bold">Join a league and start drafting legendary players</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="Invite code"
                className="neo-border bg-white font-black uppercase"
              />
              <Button
                onClick={() => joinInviteMutation.mutate()}
                disabled={joinInviteMutation.isPending || !user}
                className="neo-btn bg-white text-black hover:bg-white"
              >
                Join
              </Button>
            </div>
            <Link to={createPageUrl("CreateLeague")}>
              <Button className="neo-btn bg-black text-[#F7B801] hover:bg-black px-6 py-6 text-base w-full">
                <Plus className="w-5 h-5 mr-2" />
                Create League
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats - Preserved based on "Add Count Tracking" and "preserve all other features" */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="neo-card bg-[#00D9FF] p-6 rotate-[0.5deg]">
          <p className="text-orange-600 mb-1 text-sm font-black uppercase">TOTAL LEAGUES</p>
          <p className="text-4xl font-black">{activeLeagues.length}</p>
        </div>
        <div className="neo-card bg-[#6A4C93] text-white p-6 rotate-[-0.3deg]">
          <p className="text-orange-600 mb-1 text-sm font-black uppercase">PUBLIC</p>
          <p className="text-slate-950 text-4xl font-black">{publicLeagues.length}</p>
        </div>
        <div className="neo-card bg-[#F7B801] p-6 rotate-[0.3deg]">
          <p className="text-orange-600 mb-1 text-sm font-black uppercase">JOINED</p>
          <p className="text-4xl font-black">{myMemberships.length}</p>
        </div>
      </div>

      {/* Leagues Grid */}
      {activeLeagues.length === 0 ? (
        <div className="neo-card bg-white p-12 text-center">
          {/* Trophy icon removed as per outline's code_outline */}
          <h3 className="text-2xl font-black uppercase mb-2">No Leagues Yet</h3>
          <p className="text-gray-600 font-bold mb-6">
            Be the first to create a league
          </p>
          <Link to={createPageUrl("CreateLeague")}>
            <Button className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] px-8">
              <Plus className="w-5 h-5 mr-2" />
              Create League
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeLeagues.map((league, idx) => (
            <LeagueCard
              key={league.id}
              league={league}
              index={idx}
              user={user}
              myLeagueIds={myLeagueIds}
              joinLeagueMutation={joinLeagueMutation}
              canJoinLeague={entitlements.canJoinLeague}
              allUserProfiles={allUserProfiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// New file: src/components/league/LeagueCard.jsx
// This file should be created at the specified path.

/*
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, UserPlus } from 'lucide-react';

export default function LeagueCard({ league, index, user, myLeagueIds, joinLeagueMutation, allUserProfiles }) {
  const isJoined = myLeagueIds.includes(league.id);
  const isCommissioner = league.commissioner_email === user?.email;
  const rotation = index % 3 === 0 ? 'rotate-[0.5deg]' : index % 3 === 1 ? 'rotate-[-0.5deg]' : 'rotate-[0.2deg]';

  // Get commissioner profile
  const commissionerProfile = allUserProfiles.find(p => p.user_email === league.commissioner_email);
  const commissionerName = commissionerProfile?.display_name || league.commissioner_email.split('@')[0];

  return (
    <div
      className={`neo-card bg-white p-6 hover:translate-x-1 hover:translate-y-1 transition-transform ${rotation}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-orange-600 mb-2 text-xl font-black uppercase">
            {league.name}
          </h3>
          {league.description && (
            <p className="text-sm font-bold text-gray-600 mb-3">
              {league.description}
            </p>
          )}
        </div>
        {league.is_public ? (
          <Unlock className="w-6 h-6 text-[#00D9FF] flex-shrink-0" />
        ) : (
          <Lock className="w-6 h-6 text-gray-400 flex-shrink-0" />
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="text-gray-600">Commissioner:</span>
          <span className="text-black">{commissionerName}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="text-gray-600">Max Teams:</span>
          <span className="text-black">{league.max_members}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="text-gray-600">Season Length:</span>
          <span className="text-black">{league.season_length_weeks} weeks</span>
        </div>
      </div>

      <div className="flex gap-2">
        {isCommissioner ? (
          <Link to={createPageUrl(`LeagueManage?id=${league.id}`)} className="flex-1">
            <Button className="neo-btn bg-[#6A4C93] text-white hover:bg-[#6A4C93] w-full">
              Manage
            </Button>
          </Link>
        ) : isJoined ? (
          <Link to={createPageUrl(`League?id=${league.id}`)} className="flex-1">
            <Button className="neo-btn bg-[#00D9FF] text-black hover:bg-[#00D9FF] w-full">
              View League
            </Button>
          </Link>
        ) : league.is_public ? (
          <Button
            onClick={() => joinLeagueMutation.mutate(league.id)}
            disabled={joinLeagueMutation.isPending}
            className="neo-btn bg-[#F7B801] text-black hover:bg-[#F7B801] w-full"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Join League
          </Button>
        ) : (
          <Button disabled className="neo-btn bg-gray-200 text-gray-500 w-full cursor-not-allowed">
            <Lock className="w-4 h-4 mr-2" />
            Private
          </Button>
        )}
      </div>
    </div>
  );
}
*/
