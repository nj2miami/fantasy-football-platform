
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { appClient } from "@/api/appClient";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Save, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { NFL_CITIES, TEAM_COLORS } from "@/lib/nflTeams";

export default function Profile() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const publicProfileName = new URLSearchParams(location.search).get("name");
  const [user, setUser] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await appClient.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: ownProfile } = useQuery({
    queryKey: ['profile', user?.email],
    queryFn: async () => {
      const profiles = await appClient.entities.UserProfile.filter({ user_email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user && !publicProfileName,
  });

  const { data: publicProfile, isLoading: isLoadingPublicProfile } = useQuery({
    queryKey: ['public-profile', publicProfileName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("profile_name", publicProfileName)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    enabled: !!publicProfileName,
  });

  const profile = publicProfileName ? publicProfile : ownProfile;
  const isPublicView = !!publicProfileName;

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    profile_name: "",
    favorite_city: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        display_name: profile.display_name || "",
        profile_name: profile.profile_name || "",
        favorite_city: profile.favorite_city || profile.favorite_team || "",
      });
    } else if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        display_name: user.full_name || "Manager",
        profile_name: user.profile_name || "",
        favorite_city: "",
      });
    }
  }, [profile, user]);

  const saveProfileMutation = useMutation({
    mutationFn: async (data) => {
      const profileName = data.profile_name.trim();
      if (!/^[A-Za-z0-9]{4,20}$/.test(profileName)) {
        throw new Error("Profile name must be 4-20 letters or numbers with no spaces or special characters.");
      }
      const colors = data.favorite_city ? TEAM_COLORS[data.favorite_city] : null;
      const payload = {
        display_name: data.display_name,
        profile_name: profileName,
        favorite_city: data.favorite_city,
        favorite_team: data.favorite_city || null,
        theme_primary: colors?.primary,
        theme_secondary: colors?.secondary,
      };
      
      if (profile) {
        return { profile: await appClient.entities.UserProfile.update(profile.id, payload) };
      }
      return {
        profile: await appClient.entities.UserProfile.create({
          id: user.id,
          user_email: user.email,
          ...payload,
        }),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      queryClient.invalidateQueries({ queryKey: ["auth-route-user"] });
      toast.success("Profile updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    }
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      if (!user?.id) throw new Error("You must be signed in to upload a profile picture.");

      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const { file_url } = await appClient.integrations.Core.UploadFile({
        file,
        path: `profiles/${user.id}/avatar/${crypto.randomUUID()}-${safeName}`,
      });
      
      if (ownProfile) {
        await appClient.entities.UserProfile.update(ownProfile.id, { avatar_url: file_url });
      } else if (user) {
        if (!/^[A-Za-z0-9]{4,20}$/.test(formData.profile_name.trim())) {
          throw new Error("Save a valid profile name before uploading a profile picture.");
        }
        await appClient.entities.UserProfile.create({
          id: user.id,
          user_email: user.email,
          profile_name: formData.profile_name.trim(),
          display_name: formData.display_name || "Manager",
          avatar_url: file_url
        });
      }
      
      toast.success("Profile picture updated!");
      queryClient.invalidateQueries(['profile']);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveProfileMutation.mutate(formData);
  };

  if (isPublicView && isLoadingPublicProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
        <p className="mt-4 font-black uppercase">Loading Profile...</p>
      </div>
    );
  }

  if (isPublicView && !publicProfile) {
    return <div className="text-center font-bold text-2xl text-red-500">Profile not found.</div>;
  }

  if (isPublicView) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="neo-card bg-white p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {publicProfile.avatar_url ? (
              <img
                src={publicProfile.avatar_url}
                alt={publicProfile.display_name || publicProfile.profile_name}
                className="w-28 h-28 rounded-full object-cover neo-border"
              />
            ) : (
              <div className="w-28 h-28 rounded-full neo-border bg-[#F7B801] flex items-center justify-center">
                <User className="w-12 h-12 text-black" />
              </div>
            )}
            <div>
              <p className="text-sm font-black uppercase text-gray-500">@{publicProfile.profile_name}</p>
              <h1 className="text-4xl font-black uppercase text-black mb-2">
                {publicProfile.display_name || publicProfile.profile_name}
              </h1>
              {publicProfile.favorite_city || publicProfile.favorite_team ? (
                <p className="text-lg font-bold text-gray-700">
                  Favorite Team: {publicProfile.favorite_city || publicProfile.favorite_team}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="neo-card text-white p-8 mb-8 rotate-[-0.5deg]" style={{ backgroundColor: "#000000" }}>
        <div className="rotate-[0.5deg] flex items-center gap-4">
          <User className="w-12 h-12 text-[#F7B801]" />
          <div>
            <h1 className="text-4xl font-black uppercase mb-2 text-[#F7B801]">
              Your Profile
            </h1>
            <p className="text-lg font-bold text-[#F7B801]">
              Customize your fantasy experience
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="neo-card bg-white p-8">
          <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
            <User className="w-6 h-6" />
            Basic Info
          </h2>

          <div className="space-y-6">
            {/* Profile Picture Upload */}
            <div className="neo-border p-6 bg-gray-50">
              <Label className="text-sm font-black uppercase mb-2 block">
                Profile Picture
              </Label>
              {profile?.avatar_url && (
                <div className="mb-4">
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover neo-border"
                  />
                </div>
              )}
              <div className="flex gap-3 items-center">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="neo-border font-bold"
                />
                {uploadingAvatar && <p className="text-sm font-bold text-gray-500">Uploading...</p>}
              </div>
              <p className="text-xs font-bold text-gray-500 mt-2">
                Used as your default team avatar and when shown as commissioner
              </p>
            </div>

            <div>
              <Label className="text-sm font-black uppercase mb-2 block">
                Email
              </Label>
              <Input
                value={user?.email || ""}
                disabled
                className="neo-border font-bold bg-gray-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-black uppercase mb-2 block">
                  Profile Name
                </Label>
                <Input
                  value={formData.profile_name}
                  onChange={(e) => setFormData({ ...formData, profile_name: e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) })}
                  placeholder="CoachPrime"
                  minLength={4}
                  maxLength={20}
                  pattern="[A-Za-z0-9]{4,20}"
                  required
                  className="neo-border font-bold"
                />
                <p className="text-xs font-bold text-gray-500 mt-2">
                  4-20 letters or numbers. No spaces or special characters.
                </p>
              </div>
              <div>
                <Label className="text-sm font-black uppercase mb-2 block">
                  Display Name
                </Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Enter your display name..."
                  className="neo-border font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card bg-[#F7B801] p-8">
          <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Team Preference
          </h2>

          <div>
            <Label className="text-sm font-black uppercase mb-2 block">
              Favorite NFL Team
            </Label>
            <Select
              value={formData.favorite_city}
              onValueChange={(value) => setFormData({ ...formData, favorite_city: value })}
            >
              <SelectTrigger className="neo-border font-bold bg-white">
                <SelectValue placeholder="Select your favorite team..." />
              </SelectTrigger>
              <SelectContent>
                {NFL_CITIES.map(city => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm font-bold mt-2 text-black/70">
              Your team's colors will be used to personalize your experience
            </p>
          </div>

          {formData.favorite_city && TEAM_COLORS[formData.favorite_city] && (
            <div className="mt-6 neo-border p-4 bg-white">
              <p className="text-sm font-black uppercase mb-3">Theme Preview</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div 
                    className="h-20 neo-border"
                    style={{ backgroundColor: TEAM_COLORS[formData.favorite_city].primary }}
                  />
                  <p className="text-xs font-bold mt-2 text-center">Primary</p>
                </div>
                <div className="flex-1">
                  <div 
                    className="h-20 neo-border"
                    style={{ backgroundColor: TEAM_COLORS[formData.favorite_city].secondary }}
                  />
                  <p className="text-xs font-bold mt-2 text-center">Secondary</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={saveProfileMutation.isPending}
          className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] w-full py-6 text-lg"
        >
          <Save className="w-5 h-5 mr-2" />
          {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </div>
  );
}
