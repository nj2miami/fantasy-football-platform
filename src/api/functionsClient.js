import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

async function mapFunctionError(error) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      if (body?.error) return new Error(body.error);
      if (body?.message) return new Error(body.message);
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return new Error(text);
      } catch {
        // Fall through to the Supabase error mapper.
      }
    }
  }
  return mapSupabaseError(error);
}

export async function invokeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body: payload });
  if (error) throw await mapFunctionError(error);
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
