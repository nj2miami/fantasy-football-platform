import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

async function currentProfile(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`id.eq.${user.id},user_email.eq.${user.email || ""}`)
    .maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data || null;
}

export const auth = {
  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw mapSupabaseError(error);
    if (!data.user) return null;
    const profile = await currentProfile(data.user);
    return {
      ...data.user,
      ...(profile || {}),
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.display_name || data.user.user_metadata?.full_name || data.user.email,
      role: profile?.role || data.user.user_metadata?.role || "manager",
    };
  },
  async signInWithPassword(credentials) {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw mapSupabaseError(error);
    return data;
  },
  async signUp(credentials) {
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) throw mapSupabaseError(error);
    return data;
  },
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw mapSupabaseError(error);
    return { success: true };
  },
};
