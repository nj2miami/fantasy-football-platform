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

const DEFAULT_ROSTER_RULES = {
  "QB": 2,
  "K": 2,
  "OFF": 3,
  "DEF": 3,
  "best_ball_enabled": true,
  "starters_qb": 1,
  "starters_k": 1,
  "starters_off": 2,
  "starters_def": 2
};

const DEFAULT_POSITION_CONFIG = [
  { position: "QB", group: "OFFENSE", enabled: true },
  { position: "RB", group: "OFFENSE", enabled: true },
  { position: "WR", group: "OFFENSE", enabled: true },
  { position: "TE", group: "OFFENSE", enabled: true },
  { position: "K", group: "SPECIAL_TEAMS", enabled: true },
  { position: "DL", group: "DEFENSE", enabled: true },
  { position: "LB", group: "DEFENSE", enabled: true },
  { position: "OLB", group: "DEFENSE", enabled: true },
  { position: "ILB", group: "DEFENSE", enabled: true },
  { position: "DB", group: "DEFENSE", enabled: true },
  { position: "S", group: "DEFENSE", enabled: true },
  { position: "FS", group: "DEFENSE", enabled: true },
  { position: "NT", group: "DEFENSE", enabled: true },
  { position: "DE", group: "DEFENSE", enabled: true },
  { position: "DT", group: "DEFENSE", enabled: true },
  { position: "P", group: "SPECIAL_TEAMS", enabled: false },
  { position: "LS", group: "SPECIAL_TEAMS", enabled: false }
];

export default function RosterSettings() {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState(DEFAULT_ROSTER_RULES);
  const [positionConfig, setPositionConfig] = useState(DEFAULT_POSITION_CONFIG);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["roster-settings"],
    queryFn: async () => {
      const settings = await appClient.entities.Global.filter({ key: "ROSTER_RULES" });
      if (settings.length > 0) {
        return settings[0];
      }
      return null;
    }
  });

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
    if (setting?.value) {
      setRules(setting.value);
    }
  }, [setting]);

  useEffect(() => {
    if (positionSetting?.value) {
      setPositionConfig(positionSetting.value);
    }
  }, [positionSetting]);

  const handleRuleChange = (key, value) => {
    setRules(prev => ({ ...prev, [key]: value }));
  };

  const handlePositionChange = (index, field, value) => {
    setPositionConfig(prev => {
      const newConfig = [...prev];
      newConfig[index] = { ...newConfig[index], [field]: value };
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
    mutationFn: async ({ newRules, newPositionConfig }) => {
      console.log('[SAVE] Saving roster rules:', newRules);
      console.log('[SAVE] Saving position config:', newPositionConfig);
      
      // Save roster rules
      if (setting) {
        console.log('[SAVE] Updating existing roster rules:', setting.id);
        await appClient.entities.Global.update(setting.id, { value: newRules });
      } else {
        console.log('[SAVE] Creating new roster rules');
        await appClient.entities.Global.create({
          key: "ROSTER_RULES",
          value: newRules,
          description: "Site-wide roster composition and scoring rules."
        });
      }
      
      // Save position config
      if (positionSetting) {
        console.log('[SAVE] Updating existing position config:', positionSetting.id);
        await appClient.entities.Global.update(positionSetting.id, { value: newPositionConfig });
      } else {
        console.log('[SAVE] Creating new position config');
        await appClient.entities.Global.create({
          key: "POSITION_CONFIG",
          value: newPositionConfig,
          description: "Position configuration including groups and visibility."
        });
      }
      
      console.log('[SAVE] All settings saved successfully');
    },
    onSuccess: () => {
      toast.success("Roster and position settings saved successfully!");
      queryClient.invalidateQueries(["roster-settings"]);
      queryClient.invalidateQueries(["position-config"]);
    },
    onError: (error) => {
      console.error('[SAVE ERROR]:', error);
      toast.error("Failed to save settings: " + error.message);
    }
  });
  
  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-8">
      <div className="neo-card bg-white p-8">
        <h3 className="text-2xl font-black uppercase mb-6">Roster Composition</h3>
        <div className="space-y-6">
          <div>
            <h4 className="font-black text-lg uppercase mb-4">Roster Size by Position</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['QB', 'K', 'OFF', 'DEF'].map(pos => (
                <div key={pos}>
                  <Label className="text-sm font-bold text-gray-500 uppercase">{pos}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    value={rules[pos] || 0}
                    onChange={(e) => handleRuleChange(pos, parseInt(e.target.value))}
                    className="neo-border font-bold mt-1"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="neo-border p-4 bg-gray-50">
            <h4 className="font-black text-lg uppercase mb-2">Best Ball Scoring</h4>
             <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-gray-600">
                  Automatically use the highest-scoring players from each manager's roster.
                </p>
                 <p className="font-bold text-xs text-gray-500 mt-1">
                  (Top {rules.starters_qb} QB, {rules.starters_k} K, {rules.starters_off} OFF, {rules.starters_def} DEF)
                </p>
              </div>
              <Switch
                checked={rules.best_ball_enabled}
                onCheckedChange={(checked) => handleRuleChange('best_ball_enabled', checked)}
                className="data-[state=checked]:bg-black"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="neo-card bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black uppercase">Position Configuration</h3>
          <Button onClick={addPosition} className="neo-btn bg-[#00D9FF] text-black">
            <Plus className="w-5 h-5 mr-2" />
            Add Position
          </Button>
        </div>
        <p className="text-sm font-bold text-gray-600 mb-4">
          Configure which positions are available, their grouping (Offense/Defense/Special Teams), and whether they should be displayed in the player pool.
        </p>
        
        <div className="space-y-3">
          {positionConfig.map((config, index) => (
            <div key={index} className="flex items-center gap-4 p-4 neo-border bg-gray-50">
              <div className="flex-1">
                <Label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Position</Label>
                <Input
                  value={config.position}
                  onChange={(e) => handlePositionChange(index, 'position', e.target.value.toUpperCase())}
                  placeholder="e.g. QB, RB, WR"
                  className="neo-border font-bold"
                  maxLength={5}
                />
              </div>
              
              <div className="flex-1">
                <Label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Group</Label>
                <Select
                  value={config.group}
                  onValueChange={(value) => handlePositionChange(index, 'group', value)}
                >
                  <SelectTrigger className="neo-border font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFENSE">Offense</SelectItem>
                    <SelectItem value="DEFENSE">Defense</SelectItem>
                    <SelectItem value="SPECIAL_TEAMS">Special Teams</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={() => saveSettingsMutation.mutate({ newRules: rules, newPositionConfig: positionConfig })}
        disabled={saveSettingsMutation.isPending}
        className="neo-btn bg-[#FF6B35] text-white w-full py-4"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
      </Button>
    </div>
  );
}
