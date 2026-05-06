import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizePlayerPosition, playerName, statValue } from "@/lib/playerDisplay";

function rawNumber(rawStats, key) {
  const parsed = Number(rawStats?.[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeActualStats(weeks) {
  return weeks.reduce((summary, week) => {
    const raw = week.raw_stats || {};
    summary.games += 1;
    summary.passYards += rawNumber(raw, "passing_yards");
    summary.rushYards += rawNumber(raw, "rushing_yards");
    summary.recYards += rawNumber(raw, "receiving_yards");
    summary.tds += rawNumber(raw, "passing_tds") + rawNumber(raw, "rushing_tds") + rawNumber(raw, "receiving_tds") + rawNumber(raw, "def_tds");
    summary.fgMade += rawNumber(raw, "fg_made");
    return summary;
  }, { games: 0, passYards: 0, rushYards: 0, recYards: 0, tds: 0, fgMade: 0 });
}

function playerBucket(player) {
  const position = normalizePlayerPosition(player?.position);
  if (position === "K") return "K";
  if (position === "DEF" || ["DL", "DE", "DT", "NT", "LB", "ILB", "MLB", "OLB", "DB", "CB", "S", "SAF", "FS"].includes(position)) return "DEF";
  return "OFF";
}

function seasonStatCards(player, actualStats) {
  const bucket = playerBucket(player);
  if (bucket === "K") {
    return [
      ["Games", actualStats.games],
      ["FG Made", actualStats.fgMade],
      ["XP Made", actualStats.xpMade],
      ["Miss", actualStats.fgMissed + actualStats.xpMissed],
    ];
  }
  if (bucket === "DEF") {
    return [
      ["Games", actualStats.games],
      ["Tackle", actualStats.tackles],
      ["Sack", actualStats.sacks],
      ["Takeaway", actualStats.takeaways],
    ];
  }
  return [
    ["Games", actualStats.games],
    ["TD", actualStats.tds],
    ["Pass", actualStats.passYards],
    ["Rush/Rec", actualStats.rushYards + actualStats.recYards],
  ];
}

function weeklyActualCells(player, rawStats) {
  const bucket = playerBucket(player);
  const raw = rawStats || {};
  if (bucket === "K") {
    return {
      firstLabel: "FG",
      secondLabel: "XP",
      first: `${rawNumber(raw, "fg_made")}/${rawNumber(raw, "fg_att")}`,
      second: `${rawNumber(raw, "pat_made")}/${rawNumber(raw, "pat_att") || rawNumber(raw, "pat_made") + rawNumber(raw, "pat_missed")}`,
    };
  }
  if (bucket === "DEF") {
    return {
      firstLabel: "Tkl",
      secondLabel: "Big",
      first: rawNumber(raw, "def_tackles_solo") + rawNumber(raw, "def_tackle_assists"),
      second: rawNumber(raw, "def_sacks") + rawNumber(raw, "def_interceptions") + rawNumber(raw, "def_fumbles_forced") + rawNumber(raw, "def_tds"),
    };
  }
  return {
    firstLabel: "Yds",
    secondLabel: "TD",
    first: rawNumber(raw, "passing_yards") + rawNumber(raw, "rushing_yards") + rawNumber(raw, "receiving_yards"),
    second: rawNumber(raw, "passing_tds") + rawNumber(raw, "rushing_tds") + rawNumber(raw, "receiving_tds") + rawNumber(raw, "def_tds"),
  };
}

export default function PlayerStatsDialog({ player, seasonYear, open, onOpenChange, hideFantasyPoints = false }) {
  const { data: aggregate } = useQuery({
    queryKey: ["draft-player-aggregate", player?.id, seasonYear],
    queryFn: () => appClient.playerStats.getAggregate({ playerId: player.id, seasonYear }),
    enabled: open && !!player?.id && !hideFantasyPoints,
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ["draft-player-weeks", player?.id, hideFantasyPoints],
    queryFn: async () => {
      if (!hideFantasyPoints) return appClient.playerStats.listWeeklySummaries({ playerId: player.id });
      return appClient.playerStats.listWeeklyActuals({ playerId: player.id });
    },
    enabled: open && !!player?.id,
  });

  const stats = aggregate || player || {};
  const actualStats = weeks.reduce((summary, week) => {
    const raw = week.raw_stats || {};
    summary.games += 1;
    summary.passYards += rawNumber(raw, "passing_yards");
    summary.rushYards += rawNumber(raw, "rushing_yards");
    summary.recYards += rawNumber(raw, "receiving_yards");
    summary.tds += rawNumber(raw, "passing_tds") + rawNumber(raw, "rushing_tds") + rawNumber(raw, "receiving_tds") + rawNumber(raw, "def_tds");
    summary.fgMade += rawNumber(raw, "fg_made");
    summary.fgMissed += rawNumber(raw, "fg_missed");
    summary.xpMade += rawNumber(raw, "pat_made");
    summary.xpMissed += rawNumber(raw, "pat_missed");
    summary.tackles += rawNumber(raw, "def_tackles_solo") + rawNumber(raw, "def_tackle_assists");
    summary.sacks += rawNumber(raw, "def_sacks");
    summary.takeaways += rawNumber(raw, "def_interceptions") + rawNumber(raw, "def_fumbles_forced") + rawNumber(raw, "fumble_recovery_own") + rawNumber(raw, "fumble_recovery_opp");
    return summary;
  }, { ...summarizeActualStats([]), fgMissed: 0, xpMade: 0, xpMissed: 0, tackles: 0, sacks: 0, takeaways: 0 });
  const statCards = seasonStatCards(player, actualStats);
  const weeklyLabels = weeklyActualCells(player, {});

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
            <div className="neo-border bg-[#EFFBFF] p-3">
              <p className="text-xs font-black uppercase text-gray-500">{seasonYear || "Season"} Stats</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase">
                {hideFantasyPoints ? (
                  <>
                    {statCards.map(([label, value]) => (
                      <div key={label} className="neo-border bg-white p-2"><p className="text-gray-500">{label}</p><p className="text-lg">{statValue(value, 0)}</p></div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="neo-border bg-white p-2"><p className="text-gray-500">Avg</p><p className="text-lg">{statValue(stats.avg_points)}</p></div>
                    <div className="neo-border bg-white p-2"><p className="text-gray-500">Total</p><p className="text-lg">{statValue(stats.total_points)}</p></div>
                    <div className="neo-border bg-white p-2"><p className="text-gray-500">High</p><p className="text-lg">{statValue(stats.high_score)}</p></div>
                    <div className="neo-border bg-white p-2"><p className="text-gray-500">Low</p><p className="text-lg">{statValue(stats.low_score)}</p></div>
                  </>
                )}
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
                    {hideFantasyPoints ? (
                      <>
                        <th className="p-2 text-right font-black uppercase">{weeklyLabels.firstLabel}</th>
                        <th className="p-2 text-right font-black uppercase">{weeklyLabels.secondLabel}</th>
                      </>
                    ) : (
                      <th className="p-2 text-right font-black uppercase">Pts</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.id || `${week.season_year}-${week.week}`} className="border-t-2 border-black/10">
                      <td className="p-2 font-bold">Week {week.week}</td>
                      <td className="p-2 font-bold">{week.opponent_team || week.raw_stats?.opponent_team || "--"}</td>
                      {hideFantasyPoints ? (
                        <>
                          {(() => {
                            const cells = weeklyActualCells(player, week.raw_stats);
                            return (
                              <>
                                <td className="p-2 text-right font-black">{typeof cells.first === "string" ? cells.first : statValue(cells.first, 0)}</td>
                                <td className="p-2 text-right font-black">{typeof cells.second === "string" ? cells.second : statValue(cells.second, 0)}</td>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <td className="p-2 text-right font-black">{statValue(week.fantasy_points)}</td>
                      )}
                    </tr>
                  ))}
                  {!weeks.length && (
                    <tr><td colSpan={hideFantasyPoints ? 4 : 3} className="p-4 text-center text-sm font-bold text-gray-500">No weekly stats found.</td></tr>
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
