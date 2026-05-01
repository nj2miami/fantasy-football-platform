import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Trophy, Users, Calendar, Lock, Unlock, Star, Bot, Shield, Clock, Shuffle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';

function formatJoinFee(league) {
  if (league.league_tier !== 'PAID') return null;
  const amount = Number(league.join_fee_cents || 0) / 100;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)} to join`;
}

export default function LeagueCard({ league, index = 0, user, myLeagueIds = [], joinLeagueMutation, canJoinLeague = true }) {
  const navigate = useNavigate();
  const rotation = index % 3 === 0 ? 'rotate-[0.5deg]' : index % 3 === 1 ? 'rotate-[-0.5deg]' : 'rotate-[0.2deg]';

  // Get league members to count spots
  const { data: members = [] } = useQuery({
    queryKey: ['league-members-count', league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id })
  });

  // Get commissioner profile
  const { data: commissionerProfile } = useQuery({
    queryKey: ['commissioner-profile', league.commissioner_email],
    queryFn: async () => {
      const profiles = await appClient.entities.UserProfile.filter({ user_email: league.commissioner_email });
      return profiles[0] || null;
    }
  });

  // Get season to check status
  const { data: seasons = [] } = useQuery({
    queryKey: ['league-season', league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id })
  });

  // Check if it's an official league
  const { data: officialLeague } = useQuery({
    queryKey: ['official-league', league.id],
    queryFn: async () => {
      const officials = await appClient.entities.OfficialLeague.filter({ league_id: league.id });
      return officials[0] || null;
    }
  });

  const activeMembers = members.filter((member) => member.is_active !== false);
  const commissionerName = commissionerProfile?.display_name || commissionerProfile?.profile_name || "Commissioner";
  const commissionerProfileUrl = commissionerProfile?.profile_name
    ? createPageUrl(`Profile?name=${encodeURIComponent(commissionerProfile.profile_name)}`)
    : null;
  const openSpots = league.max_members - activeMembers.length;
  const isFull = openSpots <= 0;
  const isCommissioner = user?.email === league.commissioner_email || user?.id === league.commissioner_id;
  const isJoined = myLeagueIds.includes(league.id) || isCommissioner;
  
  // Determine league type
  const isAILeague = activeMembers.every(m => m.is_ai || m.user_email === league.commissioner_email);
  const leagueType = officialLeague ? 'OFL' : isAILeague ? 'AI' : 'MEMBER';
  
  // Determine status
  let status = 'recruiting';
  let statusText = `Recruiting (${openSpots} spots)`;
  let statusColor = 'bg-green-500';
  
  if (isFull && (!seasons.length || seasons[0]?.status === 'DRAFTING')) {
    status = 'coming_soon';
    statusText = 'Coming Soon';
    statusColor = 'bg-yellow-500';
  } else if (seasons.length > 0 && seasons[0].status !== 'DRAFTING') {
    status = 'underway';
    statusText = `Week ${seasons[0].current_week || 1} Underway`;
    statusColor = 'bg-blue-500';
  }

  const leagueTypeColors = {
    'OFL': 'bg-[#FF6B35] text-white',
    'AI': 'bg-[#6A4C93] text-white',
    'MEMBER': 'bg-[#00D9FF] text-black'
  };
  const joinFeeLabel = formatJoinFee(league);

  const handleCardClick = () => {
    navigate(createPageUrl(`League?id=${league.id}`));
  };

  return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCardClick();
          }
        }}
        className={`neo-card bg-white overflow-hidden hover:translate-x-1 hover:translate-y-1 transition-transform cursor-pointer ${rotation}`}
      >
        {/* Header Image */}
        {league.header_image_url && (
          <div className="w-full aspect-[2/1] overflow-hidden neo-border border-t-0 border-l-0 border-r-0 bg-white">
            <img 
              src={league.header_image_url} 
              alt={league.name}
              className="w-full h-full object-contain"
            />
          </div>
        )}
        
        <div className="p-6">
          {/* League Name & Featured Star */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-black uppercase text-black flex-1">
              {league.name}
            </h3>
            {(league.is_sponsored || officialLeague) && (
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-400 flex-shrink-0 ml-2" />
            )}
          </div>

          {/* Description */}
          {league.description && (
            <p className="text-sm font-bold text-gray-600 mb-4 line-clamp-2">
              {league.description}
            </p>
          )}

          {/* League Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* League Type */}
            <span className={`px-3 py-1 neo-border text-xs font-black uppercase ${leagueTypeColors[leagueType]}`}>
              {leagueType === 'OFL' ? (
                <><Shield className="w-3 h-3 inline mr-1" />Official</>
              ) : leagueType === 'AI' ? (
                <><Bot className="w-3 h-3 inline mr-1" />AI League</>
              ) : (
                <><Users className="w-3 h-3 inline mr-1" />Member</>
              )}
            </span>

            {/* Public/Private */}
            <span className={`px-3 py-1 neo-border text-xs font-black uppercase ${league.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {league.is_public ? (
                <><Unlock className="w-3 h-3 inline mr-1" />Public</>
              ) : (
                <><Lock className="w-3 h-3 inline mr-1" />Private</>
              )}
            </span>

            <span className="px-3 py-1 neo-border text-xs font-black uppercase bg-black text-white">
              <Shuffle className="w-3 h-3 inline mr-1" />
              {league.mode === 'weekly_redraft' ? 'Weekly Redraft' : 'Traditional'}
            </span>

            <span className={`px-3 py-1 neo-border text-xs font-black uppercase ${league.league_tier === 'PAID' ? 'bg-[#F7B801] text-black' : 'bg-white text-black'}`}>
              {league.league_tier === 'PAID' ? 'Paid' : 'Free'}
            </span>

            {joinFeeLabel && (
              <span className="px-3 py-1 neo-border text-xs font-black uppercase bg-[#FFF1E8] text-black">
                {joinFeeLabel}
              </span>
            )}

            {/* Status */}
            <span className={`px-3 py-1 neo-border text-xs font-black uppercase text-white ${statusColor}`}>
              {status === 'recruiting' && <Clock className="w-3 h-3 inline mr-1" />}
              {statusText}
            </span>
          </div>

          {/* League Info Grid */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-600">Commissioner:</span>
              {commissionerProfileUrl ? (
                <Link
                  to={commissionerProfileUrl}
                  className="text-black hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {commissionerProfile?.avatar_url && (
                    <img
                      src={commissionerProfile.avatar_url}
                      alt={commissionerName}
                      className="w-4 h-4 rounded-full inline mr-1"
                    />
                  )}
                  {commissionerName}
                </Link>
              ) : (
                <span className="text-black">
                {commissionerProfile?.avatar_url && (
                  <img
                    src={commissionerProfile.avatar_url}
                    alt={commissionerName}
                    className="w-4 h-4 rounded-full inline mr-1"
                  />
                )}
                {commissionerName}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-600">Teams:</span>
              <span className="text-black">{activeMembers.length} / {league.max_members}</span>
            </div>

            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-600">Season:</span>
              <span className="text-black">{league.season_length_weeks} weeks</span>
            </div>

            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-600">Source Year:</span>
              <span className="text-black">{league.source_season_year || 'TBD'}</span>
            </div>

            {league.created_date && (
              <div className="flex items-center justify-between font-bold">
                <span className="text-gray-600">Opens:</span>
                <span className="text-black">
                  {new Date(league.created_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar for Recruiting */}
          {status === 'recruiting' && (
            <div className="mt-4">
              <div className="h-2 neo-border bg-gray-200 overflow-hidden">
                <div 
                  className="h-full bg-[#00D9FF] transition-all duration-500"
                  style={{ width: `${(activeMembers.length / league.max_members) * 100}%` }}
                />
              </div>
              <p className="text-xs font-bold text-gray-500 mt-1 text-right">
                {activeMembers.length} / {league.max_members} teams joined
              </p>
            </div>
          )}

          <div className="mt-5">
            {isCommissioner ? (
              <Link
                to={createPageUrl(`LeagueManage?id=${league.id}`)}
                onClick={(event) => event.stopPropagation()}
              >
                <Button className="neo-btn bg-[#6A4C93] text-white hover:bg-[#6A4C93] w-full">
                  Manage League
                </Button>
              </Link>
            ) : isJoined ? (
              <Button className="neo-btn bg-[#00D9FF] text-black hover:bg-[#00D9FF] w-full">
                View League
              </Button>
            ) : league.is_public && !isFull && joinLeagueMutation && canJoinLeague ? (
              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  joinLeagueMutation.mutate(league.id);
                }}
                disabled={joinLeagueMutation.isPending}
                className="neo-btn bg-[#F7B801] text-black hover:bg-[#F7B801] w-full"
              >
                Join League
              </Button>
            ) : (
              <Button disabled className="neo-btn bg-gray-200 text-gray-500 w-full cursor-not-allowed">
                {isFull ? 'League Full' : !league.is_public ? 'Private League' : 'League Limit Reached'}
              </Button>
            )}
          </div>
        </div>
      </div>
  );
}
