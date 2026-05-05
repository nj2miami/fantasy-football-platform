import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

async function currentProfile(user) {
  if (!user) return null;

  const { data: profileById, error: idError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (idError) throw mapSupabaseError(idError);
  if (profileById) return profileById;

  if (!user.email) return null;
  const { data: profileByEmail, error: emailError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_email", user.email)
    .maybeSingle();
  if (emailError) throw mapSupabaseError(emailError);
  return profileByEmail || null;
}

function displayNameFor(user) {
  const metadata = user.user_metadata || {};
  return (
    metadata.display_name ||
    metadata.first_name ||
    metadata.full_name ||
    user.email?.split("@")[0] ||
    "Manager"
  );
}

function validProfileName(value) {
  return typeof value === "string" && /^[A-Za-z0-9]{4,20}$/.test(value) ? value : null;
}

async function ensureCurrentProfile(user) {
  const existingProfile = await currentProfile(user);
  if (existingProfile || !user?.email) return existingProfile;

  const metadata = user.user_metadata || {};
  const payload = {
    id: user.id,
    user_email: user.email,
    first_name: metadata.first_name || null,
    last_name: metadata.last_name || null,
    display_name: displayNameFor(user),
    profile_name: validProfileName(metadata.profile_name),
    favorite_team: metadata.favorite_team || null,
    favorite_city: metadata.favorite_city || metadata.favorite_team || null,
    theme_primary: metadata.theme_primary || null,
    theme_secondary: metadata.theme_secondary || null,
  };

  const { data, error } = await supabase.from("profiles").insert(payload).select("*").single();
  if (!error) return data;

  const mappedError = mapSupabaseError(error);
  if (String(mappedError.message || "").toLowerCase().includes("duplicate")) {
    return currentProfile(user);
  }
  throw mappedError;
}

function normalizeAuthCredentials(credentials = {}) {
  return {
    email: String(credentials.email || "").trim(),
    password: credentials.password || "",
  };
}

async function signInWithPassword(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(normalizeAuthCredentials(credentials));
  if (error) throw mapSupabaseError(error);
  return data;
}

async function signUp(credentials = {}) {
  const { email, password } = normalizeAuthCredentials(credentials);
  const metadata = {
    first_name: credentials.first_name || null,
    last_name: credentials.last_name || null,
    display_name: credentials.display_name || credentials.full_name || email.split("@")[0],
    full_name: credentials.full_name || credentials.display_name || email.split("@")[0],
    profile_name: validProfileName(credentials.profile_name),
    favorite_team: credentials.favorite_team || credentials.favorite_city || null,
    favorite_city: credentials.favorite_city || credentials.favorite_team || null,
    theme_primary: credentials.theme_primary || null,
    theme_secondary: credentials.theme_secondary || null,
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) throw mapSupabaseError(error);
  return data;
}

async function resetPassword({ email } = {}) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw mapSupabaseError(error);
  return data;
}

export const auth = {
  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw mapSupabaseError(error);
    if (!data.user) return null;
    const profile = await ensureCurrentProfile(data.user);
    return {
      ...data.user,
      ...(profile || {}),
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.display_name || data.user.user_metadata?.full_name || data.user.email,
      role: profile?.role || data.user.user_metadata?.role || "manager",
    };
  },
  login: signInWithPassword,
  signInWithPassword,
  signup: signUp,
  signUp,
  resetPassword,
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw mapSupabaseError(error);
    return { success: true };
  },
};
