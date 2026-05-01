import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Shield, Trophy, Users, ArrowRight, LogIn } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import LeagueCard from '../components/league/LeagueCard';
import HeroMotionGraphic from '../components/home/HeroMotionGraphic';

const OFFL_LOGO_SRC = "/assets/OFFL-Logo.png";

function FeaturedLeagueCard({ league, user }) {
    const { data: members = [] } = useQuery({
        queryKey: ['featured-league-members', league.id],
        queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
    });

    const { data: commissionerProfile } = useQuery({
        queryKey: ['featured-league-commissioner', league.commissioner_email],
        queryFn: async () => {
            const profiles = await appClient.entities.UserProfile.filter({ user_email: league.commissioner_email });
            return profiles[0] || null;
        },
    });

    const activeMembers = members.filter((member) => member.is_active !== false);
    const commissionerName = commissionerProfile?.display_name || commissionerProfile?.profile_name || "Commissioner";
    const commissionerUrl = commissionerProfile?.profile_name
        ? createPageUrl(`Profile?name=${encodeURIComponent(commissionerProfile.profile_name)}`)
        : null;
    const beginsDate = league.created_date
        ? new Date(league.created_date).toLocaleDateString()
        : "TBD";
    const actionUrl = user ? createPageUrl(`League?id=${league.id}`) : createPageUrl("Login");

    return (
        <div className="neo-card bg-white overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(260px,0.95fr)_minmax(0,1.05fr)]">
            {league.header_image_url && (
                <div className="w-full h-full min-h-56 lg:min-h-full neo-border border-t-0 border-l-0 border-r-0 lg:border-r-4 lg:border-b-0 bg-white overflow-hidden">
                    <img
                        src={league.header_image_url}
                        alt={league.name}
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            <div className="p-6 flex flex-col">
                <h2 className="text-2xl font-black uppercase text-black mb-2">
                    {league.name}
                </h2>
                {league.description && (
                    <p className="text-sm font-bold text-gray-600 mb-4">
                        {league.description}
                    </p>
                )}

                <div className="text-sm font-bold text-gray-700 mb-4">
                    Commissioned:{" "}
                    {commissionerUrl ? (
                        <Link to={commissionerUrl} className="text-black hover:underline">
                            {commissionerName}
                        </Link>
                    ) : (
                        <span className="text-black">{commissionerName}</span>
                    )}
                </div>

                <div className="border-t-4 border-black my-4" />

                <div className="flex flex-wrap items-center gap-2 text-sm font-black uppercase mb-5">
                    <span>Teams: {activeMembers.length}/{league.max_members}</span>
                    <span className="neo-border bg-[#F7B801] px-2 py-1 text-xs">
                        {league.source_season_year || "TBD"}
                    </span>
                    <span>{league.season_length_weeks} weeks</span>
                    <span>Begins: {beginsDate}</span>
                </div>

                <Link to={actionUrl} className="mt-auto">
                    <Button className="neo-btn bg-black text-[#F7B801] hover:bg-black w-full py-5">
                        {user ? "View League" : "Sign Up"}
                    </Button>
                </Link>
            </div>
        </div>
    );
}

const FeaturedLeague = ({ user }) => {
    const { data: leagues, isLoading } = useQuery({
        queryKey: ['sponsored-leagues'],
        queryFn: () => appClient.entities.League.filter({ is_sponsored: true }),
    });

    if (isLoading) {
      return <div className="neo-border bg-white/70 h-full min-h-64 animate-pulse" />;
    }

    const league = leagues?.[0];
    if (!league) {
      return (
        <div className="neo-border bg-white p-6 h-full flex flex-col justify-center">
          <Trophy className="w-12 h-12 text-[#F7B801] mb-4" />
          <h2 className="text-2xl font-black uppercase mb-3">Featured League</h2>
          <p className="font-bold text-gray-600">
            Featured leagues will appear here once a sponsored league is created.
          </p>
        </div>
      );
    }

    return (
      <FeaturedLeagueCard league={league} user={user} />
    );
}

const SponsoredLeagues = () => {
    const { data: leagues, isLoading } = useQuery({
        queryKey: ['sponsored-leagues-list'],
        queryFn: () => appClient.entities.League.filter({ is_sponsored: true }),
    });

    if (isLoading || !leagues || leagues.length <= 1) return null;
    const remainingLeagues = leagues.slice(1);
    return (
        <div className="my-12">
            <h2 className="text-3xl font-black uppercase text-center mb-6">More Featured Leagues</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {remainingLeagues.map((league, idx) => (
                    <LeagueCard key={league.id} league={league} index={idx} />
                ))}
            </div>
        </div>
    )
}

export default function HomePage() {
  const { data: user } = useQuery({
    queryKey: ["home-auth-user"],
    queryFn: () => appClient.auth.me(),
  });
  const ctaUrl = user ? createPageUrl("Dashboard") : createPageUrl("Login");
  const ctaLabel = user ? "Enter Dashboard" : "Login / Create Account";
  const CtaIcon = user ? ArrowRight : LogIn;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="neo-card relative overflow-hidden bg-gradient-to-br from-[#FF6B35] to-[#F7B801] p-8 md:p-12 mb-8 rotate-[-0.5deg]">
        <HeroMotionGraphic className="absolute inset-0 h-full opacity-55" />
        <div className="absolute inset-0 bg-[#F7B801]/72" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B35]/55 via-transparent to-[#F7B801]/65" />
        <div className="relative z-10 rotate-[0.5deg] space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] gap-6 lg:gap-10 items-center min-w-0">
            <img
              src={OFFL_LOGO_SRC}
              alt="Offseason Fantasy Football League"
              className="w-56 md:w-full max-w-[340px] h-auto object-contain justify-self-center md:justify-self-start"
            />
            <div className="text-center md:text-left min-w-0">
              <div className="mb-6">
                <h1 className="text-4xl md:text-6xl font-black text-black uppercase mb-4 leading-tight">
                  Offseason Fantasy Football League
                </h1>
                <p className="text-xl font-bold text-black">
                  Historical stats. Modern mayhem.
                </p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <Link to={ctaUrl} className="w-full sm:w-auto">
                  <Button className="neo-btn bg-black text-[#F7B801] hover:bg-black w-full sm:w-auto justify-center px-5 sm:px-8 py-6 text-base sm:text-lg">
                    <CtaIcon className="w-5 h-5 mr-2" />
                    <span className="whitespace-nowrap">{ctaLabel}</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <FeaturedLeague user={user} />
          </div>
        </div>
      </div>

      <SponsoredLeagues />

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div className="neo-card bg-white p-8 rotate-[0.8deg]">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-[#F7B801]" />
          <h3 className="text-2xl font-black uppercase mb-2">Build a Dynasty</h3>
          <p className="font-bold text-gray-600">
            Draft historical legends from different eras and build a team for the ages.
          </p>
        </div>
        <div className="neo-card bg-white p-8 rotate-[-0.5deg]">
          <Shield className="w-12 h-12 mx-auto mb-4 text-[#6A4C93]" />
          <h3 className="text-2xl font-black uppercase mb-2">Unique Format</h3>
          <p className="font-bold text-gray-600">
            Experience a fast-paced, elimination-style season that keeps every week exciting.
          </p>
        </div>
        <div className="neo-card bg-white p-8 rotate-[0.3deg]">
          <Users className="w-12 h-12 mx-auto mb-4 text-[#00D9FF]" />
          <h3 className="text-2xl font-black uppercase mb-2">Join a League</h3>
          <p className="font-bold text-gray-600">
            Create a private league with friends or join a public league to test your skills.
          </p>
        </div>
      </div>
    </div>
  );
}
