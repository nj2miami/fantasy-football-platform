import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

export async function invokeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body: payload });
  if (error) throw mapSupabaseError(error);
  if (data?.error) throw new Error(data.error);
  return data;
}

export const functions = {
  invoke: invokeFunction,
  processImportJobs: (payload = {}) => invokeFunction("processImportJobs", payload),
  createOfficialLeague: (payload = {}) => invokeFunction("create_official_league", payload),
  prepareDraftPool: (payload = {}) => invokeFunction("prepare_draft_pool", payload),
  fillLeagueWithAI: (payload = {}) => invokeFunction("fill_league_with_ai", payload),
  importHistoricalStats: (payload = {}) => invokeFunction("processImportJobs", { job_type: "HISTORICAL_STATS", ...payload }),
  cleanAll: (payload = {}) => invokeFunction("processImportJobs", { job_type: "CLEAN_ALL", ...payload }),
};
