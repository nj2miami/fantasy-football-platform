import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Trophy } from "lucide-react";
import { appClient } from "@/api/appClient";
import PlayerStatsDialog from "@/components/player/PlayerStatsDialog";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { normalizePlayerPosition, playerName } from "@/lib/playerDisplay";

function memberName(member) {
  return member?.team_name || member?.display_name || member?.profile?.display_name || member?.profile?.profile_name || "Team";
}

function TierBadge({ tier }) {
  const tierValue = Number(tier || 1);
  const classes = {
    5: "bg-[#F7B801] text-black",
    4: "bg-[#00D9FF] text-black",
    3: "bg-[#D7F8E8] text-black",
    2: "bg-white text-black",
    1: "bg-gray-200 text-black",
  };
  return (
    <span className={`neo-border inline-flex items-center px-2 py-1 text-xs font-black uppercase ${classes[tierValue] || classes[1]}`}>
      T{tierValue}
    </span>
  );
}

export default function LeagueDraftRecap() {
  const location = useLocation();
  const leagueId = new URLSearchParams(location.search).get("id");
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["draft-recap-user"],
    queryFn: () => appClient.auth.me(),
  });

  const { data: state, isLoading } = useQuery({
    queryKey: ["league-draft-recap-state", leagueId],
    queryFn: () => appClient.draftDay.getState(leagueId),
    enabled: Boolean(leagueId && user),
  });

  const currentMember = state?.members?.find((member) => member.user_email === user?.email || member.profile_id === user?.id);
  const seasonYear = Number(state?.league?.source_season_year || new Date().getFullYear() - 1);
  const picks = React.useMemo(() => [...(state?.picks || [])].sort((a, b) => Number(a.overall_pick || 0) - Number(b.overall_pick || 0)), [state?.picks]);
  const status = String(state?.draft?.status || "").toUpperCase();

  if (isUserLoading || isLoading) {
    return <div className="mx-auto max-w-5xl px-4"><div className="neo-card bg-white p-8 text-center font-black uppercase">Loading Draft Recap...</div></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="neo-card bg-white p-8 text-center">
          <h1 className="text-3xl font-black uppercase text-orange-600">Login Required</h1>
          <p className="mt-2 font-bold text-gray-600">You need to be logged in to view this draft recap.</p>
          <Link to={createPageUrl("Login")}>
            <Button className="neo-btn mt-5 bg-black text-white">Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!state?.league || !currentMember) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <div className="neo-card bg-white p-8 text-center">
          <h1 className="text-3xl font-black uppercase text-orange-600">League Access Only</h1>
          <p className="mt-2 font-bold text-gray-600">Only active members of this league can view the draft recap.</p>
          <Link to={createPageUrl("Leagues")}>
            <Button className="neo-btn mt-5 bg-black text-white">Back to Leagues</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={createPageUrl(`League?id=${leagueId}`)}>
          <Button className="neo-btn bg-black text-white"><ArrowLeft className="mr-2 h-5 w-5" />Back to League</Button>
        </Link>
        {status !== "COMPLETED" && (
          <Link to={`/league/draft?id=${leagueId}`}>
            <Button className="neo-btn bg-[#F7B801] text-black">Open Draft Day</Button>
          </Link>
        )}
      </div>

      <section className="neo-card mb-6 bg-black p-6 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[#F7B801]">Draft Recap</p>
            <h1 className="text-3xl font-black uppercase text-white">{state.league.name}</h1>
            <p className="mt-2 font-bold text-gray-300">Every pick from the completed draft, in order.</p>
          </div>
          <div className="neo-border bg-white px-4 py-3 text-black">
            <p className="text-xs font-black uppercase text-gray-500">Total Picks</p>
            <p className="text-3xl font-black">{picks.length}</p>
          </div>
        </div>
      </section>

      <section className="neo-card bg-white p-4">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black uppercase text-orange-600">
          <ClipboardList className="h-5 w-5" />Pick Order
        </h2>
        {picks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b-4 border-black text-xs font-black uppercase text-gray-500">
                  <th className="px-3 py-3">Pick</th>
                  <th className="px-3 py-3">Round</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Position</th>
                  <th className="px-3 py-3">Tier</th>
                  <th className="px-3 py-3">Drafted By</th>
                </tr>
              </thead>
              <tbody>
                {picks.map((pick) => {
                  const player = pick.player;
                  const member = pick.member || state.members?.find((item) => item.id === pick.league_member_id);
                  return (
                    <tr key={pick.id || `${pick.draft_id}-${pick.overall_pick}`} className="border-b-2 border-black/10 last:border-b-0">
                      <td className="px-3 py-4 text-sm font-black">#{pick.overall_pick}</td>
                      <td className="px-3 py-4 text-sm font-black">R{pick.round}</td>
                      <td className="px-3 py-4">
                        {player ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPlayer(player)}
                            className="text-left font-black uppercase text-[#00A6D6] underline decoration-2 underline-offset-2"
                          >
                            {playerName(player)}
                          </button>
                        ) : (
                          <span className="font-bold text-gray-500">Unknown Player</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm font-black uppercase">{normalizePlayerPosition(player?.position_bucket || player?.position)}</td>
                      <td className="px-3 py-4"><TierBadge tier={player?.tier_value} /></td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-[#F7B801]" />
                          <span className="font-black uppercase">{memberName(member)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="neo-border bg-gray-50 p-6 text-center font-bold text-gray-600">
            No draft picks have been recorded yet.
          </div>
        )}
      </section>

      <PlayerStatsDialog
        player={selectedPlayer}
        seasonYear={seasonYear}
        open={!!selectedPlayer}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayer(null);
        }}
      />
    </div>
  );
}
