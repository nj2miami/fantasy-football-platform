export function playerName(player) {
  return player?.player_display_name || player?.full_name || "Player";
}

export function statValue(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

export function normalizePlayerPosition(position) {
  const value = String(position || "").toUpperCase();
  if (value === "D/ST" || value === "DST") return "DEF";
  return value || "UNK";
}

export function durabilityText(player) {
  if (player?.durability === null || player?.durability === undefined) return "DUR --";
  return `${player.durability_label || "Durability"} ${player.durability}%`;
}

export function playerHeadshotUrl(player) {
  return player?.headshot_public_url || player?.headshot_url || null;
}
