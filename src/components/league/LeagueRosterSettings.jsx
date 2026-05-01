import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { appClient, DEFAULT_ROSTER_RULES } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STARTER_SLOTS = ["QB", "OFF", "FLEX", "K", "DEF"];

export default function LeagueRosterSettings({ league }) {
  const queryClient = useQueryClient();
  const initialRules = league.roster_rules || DEFAULT_ROSTER_RULES;
  const [rules, setRules] = useState({
    starters: { ...DEFAULT_ROSTER_RULES.starters, ...(initialRules.starters || {}) },
    bench: initialRules.bench ?? DEFAULT_ROSTER_RULES.bench,
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ["league-seasons", league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id }),
  });
  const leagueStarted = seasons.length > 0;

  const saveMutation = useMutation({
    mutationFn: () => appClient.entities.League.update(league.id, { roster_rules: rules }),
    onSuccess: () => {
      toast.success("Roster rules saved.");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    },
    onError: (error) => toast.error(error.message || "Failed to save roster rules."),
  });

  const updateStarter = (slot, value) => {
    setRules((current) => ({
      ...current,
      starters: {
        ...current.starters,
        [slot]: Math.max(0, Number(value) || 0),
      },
    }));
  };

  const handleSave = () => {
    const totalStarters = Object.values(rules.starters).reduce((sum, value) => sum + Number(value || 0), 0);
    if (totalStarters < 1) {
      toast.error("At least one starter is required.");
      return;
    }
    if (rules.bench < 0) {
      toast.error("Bench size cannot be negative.");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-black uppercase mb-2">Roster Settings</h3>
        <p className="text-sm font-bold text-gray-600">
          Set this league's starter slots and bench size. Roster shape locks after a season is created.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STARTER_SLOTS.map((slot) => (
          <div key={slot}>
            <Label className="text-sm font-black uppercase mb-2 block">{slot} Starters</Label>
            <Input
              type="number"
              min="0"
              value={rules.starters[slot] ?? 0}
              disabled={leagueStarted}
              onChange={(event) => updateStarter(slot, event.target.value)}
              className="neo-border font-bold"
            />
          </div>
        ))}
      </div>

      <div>
        <Label className="text-sm font-black uppercase mb-2 block">Bench Spots</Label>
        <Input
          type="number"
          min="0"
          value={rules.bench}
          disabled={leagueStarted}
          onChange={(event) => setRules({ ...rules, bench: Math.max(0, Number(event.target.value) || 0) })}
          className="neo-border font-bold max-w-xs"
        />
      </div>

      {leagueStarted && (
        <div className="neo-border bg-[#FFF1E8] p-4 font-bold text-sm">
          Roster settings are locked because this league already has a season.
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending || leagueStarted}
        className="neo-btn bg-[#00D9FF] text-black w-full py-4"
      >
        <Save className="w-5 h-5 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Roster Rules"}
      </Button>
    </div>
  );
}
