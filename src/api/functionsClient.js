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

function functionErrorMessage(body, status, name = "Edge Function") {
  if (body && typeof body === "object") {
    const message = body.error || body.message || body.details || body.hint || body.code;
    if (typeof message === "string") return message;
    if (message && typeof message === "object") {
      const nested = message.message || message.details || message.hint || message.code;
      if (typeof nested === "string") return nested;
      const serializedMessage = JSON.stringify(message);
      if (serializedMessage && serializedMessage !== "{}") return serializedMessage;
    }
    const serializedBody = JSON.stringify(body);
    if (serializedBody && serializedBody !== "{}") return serializedBody;
    return `${name} failed with status ${status} but returned no error details. Check the Supabase Edge Function logs.`;
  }
  return body || `${name} failed with status ${status} but returned no error details. Check the Supabase Edge Function logs.`;
}

function makeFunctionError(name, body, status) {
  const error = new Error(functionErrorMessage(body, status, name));
  error.functionName = name;
  error.status = status;
  error.body = body;
  return error;
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
  if (!response.ok) throw makeFunctionError(name, data, response.status);
  if (data?.error) throw makeFunctionError(name, data, response.status);
  return data;
}

export const functions = {
  invoke: invokeFunction,
  processImportJobs: (payload = {}) => invokeFunction("processImportJobs", payload),
  createOfficialLeague: (payload = {}) => invokeFunction("create_official_league", payload),
  prepareDraftPool: (payload = {}) => invokeFunction("prepare_draft_pool", payload),
  updateDraftCheckIn: (payload = {}) => invokeFunction("update_draft_check_in", payload),
  resetDraft: (payload = {}) => invokeFunction("reset_draft", payload),
  generateDraftRecap: (payload = {}) => invokeFunction("generate_draft_recap", payload),
  generateMidseasonRecap: (payload = {}) => invokeFunction("generate_midseason_recap", payload),
  fillLeagueWithAI: (payload = {}) => invokeFunction("fill_league_with_ai", payload),
  importHistoricalStats: (payload = {}) => invokeFunction("processImportJobs", { job_type: "HISTORICAL_STATS", ...payload }),
};
