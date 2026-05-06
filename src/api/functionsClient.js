import { supabase } from "@/lib/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function parseFunctionResponse(response) {
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function functionErrorMessage(body, status) {
  if (body && typeof body === "object") {
    return body.error || body.message || `Edge Function failed with status ${status}`;
  }
  return body || `Edge Function failed with status ${status}`;
}

export async function invokeFunction(name, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseFunctionResponse(response);
  if (!response.ok) throw new Error(functionErrorMessage(data, response.status));
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
