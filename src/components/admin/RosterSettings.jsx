import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";

const DEFAULT_POSITION_CONFIG = [
  { position: "QB", group: "QB", enabled: true },
  { position: "OFF", group: "OFFENSE", enabled: true },
  { position: "RB", group: "OFFENSE", enabled: true },
  { position: "FB", group: "OFFENSE", enabled: true },
  { position: "WR", group: "OFFENSE", enabled: true },
  { position: "TE", group: "OFFENSE", enabled: true },
  { position: "OL", group: "OFFENSE", enabled: false },
  { position: "C", group: "OFFENSE", enabled: false },
  { position: "G", group: "OFFENSE", enabled: false },
  { position: "OT", group: "OFFENSE", enabled: false },
  { position: "K", group: "K", enabled: true },
  { position: "P", group: "OFFENSE", enabled: false },
  { position: "LS", group: "OFFENSE", enabled: false },
  { position: "DEF", group: "DEFENSE", enabled: true },
  { position: "DST", group: "DEFENSE", enabled: true },
  { position: "D/ST", group: "DEFENSE", enabled: true },
  { position: "DL", group: "DEFENSE", enabled: true },
  { position: "DE", group: "DEFENSE", enabled: true },
  { position: "DT", group: "DEFENSE", enabled: true },
  { position: "NT", group: "DEFENSE", enabled: true },
  { position: "LB", group: "DEFENSE", enabled: true },
  { position: "ILB", group: "DEFENSE", enabled: true },
  { position: "MLB", group: "DEFENSE", enabled: true },
  { position: "OLB", group: "DEFENSE", enabled: true },
  { position: "DB", group: "DEFENSE", enabled: true },
  { position: "CB", group: "DEFENSE", enabled: true },
  { position: "S", group: "DEFENSE", enabled: true },
  { position: "SAF", group: "DEFENSE", enabled: true },
  { position: "FS", group: "DEFENSE", enabled: true },
];

export default function RosterSettings() {
  const queryClient = useQueryClient();
  const [positionConfig, setPositionConfig] = useState(DEFAULT_POSITION_CONFIG);

  const { data: positionSetting } = useQuery({
    queryKey: ["position-config"],
    queryFn: async () => {
      const settings = await appClient.entities.Global.filter({ key: "POSITION_CONFIG" });
      if (settings.length > 0) {
        return settings[0];
      }
      return null;
    }
  });

  useEffect(() => {
    if (positionSetting?.value) {
      const savedConfig = Array.isArray(positionSetting.value) ? positionSetting.value : [];
      const savedByPosition = new Map(savedConfig.map((item) => [String(item.position || "").toUpperCase(), item]));
      const defaultPositions = new Set(DEFAULT_POSITION_CONFIG.map((item) => item.position));
      setPositionConfig([
        ...DEFAULT_POSITION_CONFIG.map((item) => ({ ...item, ...(savedByPosition.get(item.position) || {}) })),
        ...savedConfig.filter((item) => !defaultPositions.has(String(item.position || "").toUpperCase())),
      ]);
    }
  }, [positionSetting]);

  const handlePositionChange = (index, field, value) => {
    setPositionConfig(prev => {
      const newConfig = [...prev];
      const next = { ...newConfig[index], [field]: value };
      const position = String(field === "position" ? value : next.position || "").toUpperCase();
      if (position === "QB" || position === "K") {
        next.group = position;
      } else if (next.group === "QB" || next.group === "K" || next.group === "SPECIAL_TEAMS") {
        next.group = "OFFENSE";
      }
      newConfig[index] = next;
      return newConfig;
    });
  };

  const addPosition = () => {
    setPositionConfig(prev => [...prev, { position: "", group: "OFFENSE", enabled: true }]);
  };

  const removePosition = (index) => {
    setPositionConfig(prev => prev.filter((_, i) => i !== index));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async ({ newPositionConfig }) => {
      const normalizedConfig = newPositionConfig.map((item) => {
        const position = String(item.position || "").toUpperCase();
        return {
          ...item,
          position,
          group: position === "QB" || position === "K"
            ? position
            : item.group === "DEFENSE"
              ? "DEFENSE"
              : "OFFENSE",
        };
      });

      if (positionSetting) {
        await appClient.entities.Global.update(positionSetting.id, { value: normalizedConfig });
      } else {
        await appClient.entities.Global.create({
          key: "POSITION_CONFIG",
          value: normalizedConfig,
          description: "Position configuration including offensive or defensive bucket and draft eligibility."
        });
      }
    },
    onSuccess: () => {
      toast.success("Position settings saved successfully!");
      queryClient.invalidateQueries(["position-config"]);
    },
    onError: (error) => {
      console.error('[SAVE ERROR]:', error);
      toast.error("Failed to save settings: " + error.message);
    }
  });
  
  return (
    <div className="space-y-8">
      <div className="neo-card bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black uppercase">Position Configuration</h3>
          <Button onClick={addPosition} className="neo-btn bg-[#00D9FF] text-black">
            <Plus className="w-5 h-5 mr-2" />
            Add Position
          </Button>
        </div>
        <p className="text-sm font-bold text-gray-600 mb-4">
          Configure which raw backend positions are treated as offense or defense. QB and K are automatic categories. Disabled positions are excluded from draft eligibility and scoring.
        </p>
        
        <div className="space-y-3">
          {positionConfig.map((config, index) => (
            <div key={index} className="flex items-center gap-4 p-4 neo-border bg-gray-50">
              {(() => {
                const position = String(config.position || "").toUpperCase();
                const isAutomatic = position === "QB" || position === "K";
                const groupValue = isAutomatic
                  ? position
                  : config.group === "DEFENSE"
                    ? "DEFENSE"
                    : "OFFENSE";
                return (
                  <>
              <div className="flex-1">
                <Label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Position</Label>
                <Input
                  value={position}
                  onChange={(e) => handlePositionChange(index, 'position', e.target.value.toUpperCase())}
                  placeholder="e.g. QB, RB, WR"
                  className="neo-border font-bold"
                  maxLength={5}
                />
              </div>
              
              <div className="flex-1">
                <Label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Group</Label>
                <Select
                  value={groupValue}
                  onValueChange={(value) => handlePositionChange(index, 'group', value)}
                  disabled={isAutomatic}
                >
                  <SelectTrigger className="neo-border font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFENSE">Offense</SelectItem>
                    <SelectItem value="DEFENSE">Defense</SelectItem>
                    {isAutomatic && <SelectItem value={position}>{position}</SelectItem>}
                  </SelectContent>
                </Select>
                {isAutomatic && (
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {position} is assigned automatically.
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-center">
                <Label className="text-xs font-bold text-gray-500 uppercase mb-2">Enabled</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => handlePositionChange(index, 'enabled', checked)}
                  className="data-[state=checked]:bg-black"
                />
              </div>
              
              <Button
                onClick={() => removePosition(index)}
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={() => saveSettingsMutation.mutate({ newPositionConfig: positionConfig })}
        disabled={saveSettingsMutation.isPending}
        className="neo-btn bg-[#FF6B35] text-white w-full py-4"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveSettingsMutation.isPending ? "Saving..." : "Save Position Settings"}
      </Button>
    </div>
  );
}
