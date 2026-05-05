import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Image as ImageIcon } from "lucide-react";
import { leagueTeamLimits } from "@/lib/entitlements";

function formatJoinFee(league) {
  if (league.league_tier !== "PAID") return "Free to join";
  const amount = Number(league.join_fee_cents || 0) / 100;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)} to join`;
}

export default function LeagueSettings({ league }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: league.name || "",
    description: league.description || "",
    is_public: league.is_public || false,
    max_members: league.max_members || 8,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Check if league has started
  const { data: seasons = [] } = useQuery({
    queryKey: ['league-seasons', league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id })
  });

  const { data: members = [] } = useQuery({
    queryKey: ['league-members-count', league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id })
  });

  const leagueStarted = seasons.length > 0 && seasons.some(s => s.status !== 'DRAFTING');
  const currentMemberCount = members.filter((member) => member.is_active !== false).length;
  const teamLimits = leagueTeamLimits(league.league_tier || "FREE");

  const updateLeagueMutation = useMutation({
    mutationFn: (data) => appClient.entities.League.update(league.id, data),
    onSuccess: () => {
      toast.success("League settings saved!");
      queryClient.invalidateQueries(['league', league.id]);
    },
    onError: () => {
      toast.error("Failed to save settings.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate max_members
    if (formData.max_members < currentMemberCount) {
      toast.error(`Cannot set max teams below current team count (${currentMemberCount})`);
      return;
    }
    if (formData.max_members % 2 !== 0) {
      toast.error("Max teams must be an even number");
      return;
    }
    if (formData.max_members < teamLimits.min || formData.max_members > teamLimits.max) {
      toast.error(`Max teams must be between ${teamLimits.min} and ${teamLimits.max}`);
      return;
    }
    
    updateLeagueMutation.mutate(formData);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const { file_url } = await appClient.integrations.Core.UploadFile({
        file,
        path: `leagues/${league.id}/header/${crypto.randomUUID()}-${safeName}`,
      });
      await appClient.entities.League.update(league.id, { header_image_url: file_url });
      toast.success("League header image updated!");
      queryClient.invalidateQueries(['league', league.id]);
    } catch (error) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-2xl font-black uppercase mb-4">League Settings</h3>
      <div className="neo-border p-4 bg-[#EFFBFF]">
        <Label className="text-sm font-black uppercase mb-1 block">Join Requirement</Label>
        <p className="text-lg font-black">{formatJoinFee(league)}</p>
        <p className="text-xs font-bold text-gray-600 mt-1">
          Paid league collection will be enforced by Stripe in a later integration.
        </p>
      </div>
      
      {/* Header Image Upload */}
      <div className="neo-border p-6 bg-gray-50">
        <Label className="text-sm font-black uppercase mb-2 block">League Header Image</Label>
        {league.header_image_url && (
          <div className="mb-4 neo-border overflow-hidden">
            <img 
              src={league.header_image_url} 
              alt="League header"
              className="w-full h-48 object-cover"
            />
          </div>
        )}
        <div className="flex gap-3">
          <Input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImage}
            className="neo-border font-bold"
          />
          {uploadingImage && <p className="text-sm font-bold text-gray-500">Uploading...</p>}
        </div>
        <p className="text-xs font-bold text-gray-500 mt-2">
          This image will be displayed on the league page and home page if featured
        </p>
      </div>

      <div>
        <Label className="text-sm font-black uppercase mb-2 block">League Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="neo-border font-bold text-lg"
        />
      </div>
      <div>
        <Label className="text-sm font-black uppercase mb-2 block">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="neo-border font-bold h-24"
        />
      </div>
      <div>
        <Label className="text-sm font-black uppercase mb-2 block">Max Teams</Label>
        <Input
          type="number"
          min={teamLimits.min}
          max={teamLimits.max}
          step="2"
          value={formData.max_members}
          onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) })}
          disabled={leagueStarted}
          className="neo-border font-bold text-lg"
        />
        <p className="text-xs font-bold text-gray-500 mt-1">
          {leagueStarted ? "Cannot change max teams after league has started" : 
           `Must be even, between ${teamLimits.min}-${teamLimits.max}. Current teams: ${currentMemberCount}`}
        </p>
      </div>
      <div className="flex items-center justify-between p-4 neo-border bg-gray-50">
        <Label className="text-sm font-black uppercase block">Public League</Label>
        <Switch
          checked={formData.is_public}
          onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
          className="data-[state=checked]:bg-black"
        />
      </div>
      <Button type="submit" disabled={updateLeagueMutation.isPending} className="neo-btn bg-[#FF6B35] text-white w-full py-4">
        {updateLeagueMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
