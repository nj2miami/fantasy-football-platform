import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { appClient } from "@/api/appClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { playerHeadshotUrl, playerName, statValue } from "@/lib/playerDisplay";

export default function PlayerStatsDialog({ player, seasonYear, open, onOpenChange }) {
  const { data: aggregate } = useQuery({
    queryKey: ["draft-player-aggregate", player?.id, seasonYear],
    queryFn: () => appClient.playerStats.getAggregate({ playerId: player.id, seasonYear }),
    enabled: open && !!player?.id,
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ["draft-player-weeks", player?.id],
    queryFn: () => appClient.playerStats.listWeeklySummaries({ playerId: player.id }),
    enabled: open && !!player?.id,
  });

  const headshot = playerHeadshotUrl(player);
  const stats = aggregate || player || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase">Player Stats</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-black uppercase leading-tight">{playerName(player)}</p>
              <p className="mt-1 text-sm font-black uppercase text-gray-500">{player?.position || "--"} | {player?.team || "FA"}</p>
            </div>
            <div className="neo-border flex aspect-square w-full items-center justify-center overflow-hidden bg-gray-100">
              {headshot ? <img src={headshot} alt="" className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-gray-400" />}
            </div>
            <div className="neo-border bg-[#EFFBFF] p-3">
              <p className="text-xs font-black uppercase text-gray-500">{seasonYear || "Season"} Stats</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase">
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Avg</p><p className="text-lg">{statValue(stats.avg_points)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Total</p><p className="text-lg">{statValue(stats.total_points)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">High</p><p className="text-lg">{statValue(stats.high_score)}</p></div>
                <div className="neo-border bg-white p-2"><p className="text-gray-500">Low</p><p className="text-lg">{statValue(stats.low_score)}</p></div>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm font-black uppercase text-gray-500">{aggregate?.weeks_played ?? player?.weeks_played ?? weeks.length} Stat Weeks</p>
            <div className="mt-4 overflow-hidden neo-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="p-2 font-black uppercase">Week</th>
                    <th className="p-2 font-black uppercase">Opp</th>
                    <th className="p-2 text-right font-black uppercase">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.id || `${week.season_year}-${week.week}`} className="border-t-2 border-black/10">
                      <td className="p-2 font-bold">Week {week.week}</td>
                      <td className="p-2 font-bold">{week.opponent_team || "--"}</td>
                      <td className="p-2 text-right font-black">{statValue(week.fantasy_points)}</td>
                    </tr>
                  ))}
                  {!weeks.length && (
                    <tr><td colSpan={3} className="p-4 text-center text-sm font-bold text-gray-500">No weekly stats found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
