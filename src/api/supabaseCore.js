export function now() {
  return new Date().toISOString();
}

export function mapSupabaseError(error) {
  if (!error) return new Error("Supabase request failed");
  return error instanceof Error ? error : new Error(error.message || String(error));
}

export function applySort(query, sort) {
  if (!sort) return query;
  for (const rawField of String(sort).split(",")) {
    const field = rawField.trim();
    if (!field) continue;
    const descending = field.startsWith("-");
    query = query.order(descending ? field.slice(1) : field, { ascending: !descending });
  }
  return query;
}

export function applyPagination(query, limit, skip = 0) {
  if (!limit) return query;
  const start = Number(skip) || 0;
  return query.range(start, start + Number(limit) - 1);
}

export function normalizePosition(position) {
  const value = String(position || "").toUpperCase();
  if (value === "D/ST" || value === "DST") return "DEF";
  return value || null;
}
