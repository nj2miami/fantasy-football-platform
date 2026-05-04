import { statValue } from "@/lib/playerDisplay";

export default function PlayerMiniStats({ player, weeksPlayed }) {
  const durability = player?.durability === null || player?.durability === undefined
    ? "--"
    : `${Number(player.durability) > 0 ? "+" : ""}${player.durability}`;

  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase sm:gap-2">
      <div><p className="text-gray-500">Tier</p><p>{player?.tier_value || 1}</p></div>
      <div><p className="text-gray-500">Dur</p><p>{durability}</p></div>
      <div><p className="text-gray-500">Avg</p><p>{statValue(player?.avg_points)}</p></div>
      <div><p className="text-gray-500">Tot</p><p>{statValue(player?.total_points)}</p></div>
      <div><p className="text-gray-500">High</p><p>{statValue(player?.high_score)}</p></div>
      <div><p className="text-gray-500">Low</p><p>{statValue(player?.low_score)}</p></div>
      <div><p className="text-gray-500">Wks</p><p>{weeksPlayed ?? "--"}</p></div>
    </div>
  );
}
