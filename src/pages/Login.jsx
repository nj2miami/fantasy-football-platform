import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LogIn, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NFL_CITIES, TEAM_COLORS } from "@/lib/nflTeams";

function loginErrorMessage(error) {
  const rawMessage = error?.message || "";
  const message = rawMessage.toLowerCase();
  if (message.includes("confirm") || message.includes("verified")) {
    return "Check your email to verify your account before logging in.";
  }
  if (message.includes("invalid login credentials")) {
    return "We could not find an account with that email and password. Try again, reset your password, or create a new account.";
  }
  return rawMessage || "Login failed. Try again in a moment.";
}

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    display_name: "",
    profile_name: "",
    first_name: "",
    last_name: "",
    favorite_city: "",
  });
  const [formMessage, setFormMessage] = useState(null);

  const authMutation = useMutation({
    mutationFn: async () => {
      setFormMessage(null);
      if (mode === "signup") {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const profileName = formData.profile_name.trim();
        if (!/^[A-Za-z0-9]{4,20}$/.test(profileName)) {
          throw new Error("Profile name must be 4-20 letters or numbers with no spaces or special characters.");
        }
        const fullName = `${formData.first_name} ${formData.last_name}`.trim();
        const displayName = formData.display_name.trim() || formData.first_name.trim() || fullName || formData.email.split("@")[0];
        const colors = formData.favorite_city ? TEAM_COLORS[formData.favorite_city] : null;
        return appClient.auth.signup({
          ...formData,
          profile_name: profileName,
          display_name: displayName,
          full_name: fullName || formData.email.split("@")[0],
          favorite_team: formData.favorite_city,
          theme_primary: colors?.primary,
          theme_secondary: colors?.secondary,
        });
      }
      return appClient.auth.login(formData);
    },
    onSuccess: async (result) => {
      if (mode === "signup" && !result?.session) {
        setFormMessage({
          type: "success",
          text: "Account created. Check your email to verify your account before logging in.",
        });
        toast.success("Check your email to verify your account.");
        return;
      }
      toast.success(mode === "signup" ? "Account created." : "Welcome back.");
      const currentUser = await appClient.auth.me();
      queryClient.setQueryData(["auth-route-user"], currentUser);
      queryClient.invalidateQueries({ queryKey: ["auth-route-user"] });
      navigate(mode === "signup" ? createPageUrl("Profile") : createPageUrl("Dashboard"));
    },
    onError: (error) => {
      const message = isSignup
        ? error.message || "We could not create that account. Check your details and try again."
        : loginErrorMessage(error);
      setFormMessage({ type: "error", text: message });
      toast.error(message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!formData.email.trim()) {
        throw new Error("Enter your email address first, then request a password reset.");
      }
      return appClient.auth.resetPassword({ email: formData.email.trim() });
    },
    onSuccess: () => {
      setFormMessage({
        type: "success",
        text: "If an account exists for that email, a password reset link has been sent.",
      });
    },
    onError: (error) => {
      setFormMessage({
        type: "error",
        text: error.message || "We could not send a password reset email. Try again in a moment.",
      });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    authMutation.mutate();
  };

  const isSignup = mode === "signup";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="neo-card bg-white p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="neo-border bg-[#F7B801] p-3">
            {isSignup ? <UserPlus className="w-7 h-7" /> : <LogIn className="w-7 h-7" />}
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase text-black">
              {isSignup ? "Create Account" : "Login"}
            </h1>
            <p className="font-bold text-gray-600">
              {isSignup ? "Start building your league." : "Get back to your dashboard."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignup && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-black uppercase mb-2 block">First Name</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(event) => setFormData({ ...formData, first_name: event.target.value })}
                    className="neo-border font-bold"
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm font-black uppercase mb-2 block">Last Name</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(event) => setFormData({ ...formData, last_name: event.target.value })}
                    className="neo-border font-bold"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-black uppercase mb-2 block">Profile Name</Label>
                <Input
                  value={formData.profile_name}
                  onChange={(event) => setFormData({ ...formData, profile_name: event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) })}
                  className="neo-border font-bold"
                  placeholder="CoachPrime"
                  minLength={4}
                  maxLength={20}
                  pattern="[A-Za-z0-9]{4,20}"
                  required
                />
                <p className="text-xs font-bold text-gray-500 mt-2">
                  4-20 letters or numbers. This is your public profile URL name.
                </p>
              </div>

              <div>
                <Label className="text-sm font-black uppercase mb-2 block">Display Name</Label>
                <Input
                  value={formData.display_name}
                  onChange={(event) => setFormData({ ...formData, display_name: event.target.value })}
                  className="neo-border font-bold"
                  placeholder={formData.first_name || "Shown around the app"}
                />
                <p className="text-xs font-bold text-gray-500 mt-2">
                  Defaults to your first name if left blank.
                </p>
              </div>

              <div>
                <Label className="text-sm font-black uppercase mb-2 block">Favorite Team</Label>
                <Select
                  value={formData.favorite_city}
                  onValueChange={(value) => setFormData({ ...formData, favorite_city: value })}
                >
                  <SelectTrigger className="neo-border font-bold bg-white">
                    <SelectValue placeholder="Select your favorite team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {NFL_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.favorite_city && TEAM_COLORS[formData.favorite_city] && (
                  <div className="flex gap-3 mt-3">
                    <div
                      className="h-8 flex-1 neo-border"
                      style={{ backgroundColor: TEAM_COLORS[formData.favorite_city].primary }}
                    />
                    <div
                      className="h-8 flex-1 neo-border"
                      style={{ backgroundColor: TEAM_COLORS[formData.favorite_city].secondary }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              className="neo-border font-bold"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <Label className="text-sm font-black uppercase mb-2 block">Password</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              className="neo-border font-bold"
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          {isSignup && (
            <div>
              <Label className="text-sm font-black uppercase mb-2 block">Confirm Password</Label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                className="neo-border font-bold"
                placeholder="Re-enter your password"
                minLength={6}
                required
              />
            </div>
          )}

          {formMessage && (
            <div
              className={`neo-border p-4 flex items-start gap-3 ${
                formMessage.type === "success" ? "bg-[#E8FFE8]" : "bg-[#FFF1E8]"
              }`}
              role="alert"
            >
              {formMessage.type === "success" ? (
                <Mail className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#FF6B35]" />
              )}
              <p className="font-bold text-sm text-black">{formMessage.text}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={authMutation.isPending}
            className="neo-btn bg-[#FF6B35] text-white hover:bg-[#FF6B35] w-full py-6 text-lg"
          >
            {authMutation.isPending ? "Working..." : isSignup ? "Create Account" : "Login"}
          </Button>

          {!isSignup && (
            <Button
              type="button"
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending}
              className="neo-btn bg-white text-black hover:bg-white w-full py-4"
            >
              {resetPasswordMutation.isPending ? "Sending..." : "Forgot Password"}
            </Button>
          )}
        </form>

        <div className="neo-border bg-[#EFFBFF] p-4 mt-6 flex items-center justify-between gap-4">
          <p className="font-bold text-sm">
            {isSignup ? "Already have an account?" : "Need an account?"}
          </p>
          <Button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setFormMessage(null);
            }}
            className="neo-btn bg-white text-black hover:bg-white"
          >
            {isSignup ? "Login" : "Create Account"}
          </Button>
        </div>

        <Link to={createPageUrl("Home")} className="block text-center font-black uppercase text-sm mt-6">
          Back Home
        </Link>
      </div>
    </div>
  );
}
