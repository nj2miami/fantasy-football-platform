import React, { useState } from "react";
import { appClient, DEFAULT_LEAGUE_VISIBILITY_CONFIG, DEFAULT_MANAGER_POINT_ACTIONS } from "@/api/appClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { leagueTeamLimits } from "@/lib/entitlements";

function formatJoinFee(league) {
  if (league.league_tier !== "PAID") return "Free to join";
  const amount = Number(league.join_fee_cents || 0) / 100;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)} to join`;
}

function actionConfig(actions) {
  return Object.fromEntries(
    Object.entries({ ...DEFAULT_MANAGER_POINT_ACTIONS, ...(actions || {}) }).map(([key, action]) => [
      key,
      { ...DEFAULT_MANAGER_POINT_ACTIONS[key], ...action },
    ])
  );
}

const RULE_NOTE_FIELDS = [
  {
    key: "draft_cadence",
    label: "Draft",
    description: "How managers acquire players for the season or week.",
  },
  {
    key: "schedule",
    label: "Schedule",
    description: "How weekly matchups are generated and presented.",
  },
  {
    key: "ranking",
    label: "Ranking",
    description: "How standings are ordered after weekly scoring.",
  },
  {
    key: "retention",
    label: "Retention",
    description: "How long players remain on manager rosters.",
  },
  {
    key: "player_names",
    label: "Player Names",
    description: "How much player identity is visible during the draft.",
  },
  {
    key: "durability",
    label: "Durability",
    description: "How durability is applied and revealed.",
  },
  {
    key: "manager_points",
    label: "Manager Points",
    description: "How the manager points bank should be understood.",
  },
  {
    key: "roster_draft",
    label: "Roster / Draft Settings",
    description: "How roster shape and draft group rules work in this league.",
  },
];

export default function LeagueSettings({ league }) {
  const queryClient = useQueryClient();
  const visibility = { ...DEFAULT_LEAGUE_VISIBILITY_CONFIG, ...league };
  const [formData, setFormData] = useState({
    name: league.name || "",
    description: league.description || "",
    is_public: league.is_public || false,
    max_members: league.max_members || 8,
    league_type: "standard",
    fantasy_points_visibility: "hidden",
    draft_player_name_visibility: visibility.draft_player_name_visibility || "shown",
    draft_team_visibility: visibility.draft_team_visibility || "hidden_until_drafted",
    durability_mode: visibility.durability_mode || "hidden_until_drafted",
    manager_points_enabled: league.manager_points_enabled === true,
    manager_points_starting: Number(league.manager_points_starting || 0),
    manager_point_actions: actionConfig(league.manager_point_actions),
    commissioner_message_of_day: league.commissioner_message_of_day || "",
    league_rule_notes: league.league_rule_notes || {},
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: seasons = [] } = useQuery({
    queryKey: ["league-seasons", league.id],
    queryFn: () => appClient.entities.Season.filter({ league_id: league.id }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["league-members-count", league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ["league-audit-events", league.id],
    queryFn: () => appClient.entities.LeagueAuditEvent.filter({ league_id: league.id }, "-created_date"),
  });

  const { data: auditFeedback = [] } = useQuery({
    queryKey: ["league-audit-feedback", league.id],
    queryFn: () => appClient.entities.LeagueAuditFeedback.filter({ league_id: league.id }),
  });

  const leagueStarted = seasons.length > 0 && seasons.some((season) => season.status !== "DRAFTING");
  const currentMemberCount = members.filter((member) => member.is_active !== false).length;
  const teamLimits = leagueTeamLimits(league.league_tier || "FREE");

  const updateLeagueMutation = useMutation({
    mutationFn: (data) => appClient.functions.invoke("update_league_settings", { league_id: league.id, ...data }),
    onSuccess: () => {
      toast.success("League settings saved!");
      queryClient.invalidateQueries(["league", league.id]);
      queryClient.invalidateQueries(["league-details", league.id]);
      queryClient.invalidateQueries(["league-audit-events", league.id]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save settings.");
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ auditEventId, vote }) => appClient.functions.invoke("vote_league_audit", { audit_event_id: auditEventId, vote }),
    onSuccess: () => {
      toast.success("Feedback saved.");
      queryClient.invalidateQueries(["league-audit-feedback", league.id]);
    },
    onError: (error) => toast.error(error.message || "Failed to save feedback."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

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
    if (formData.manager_points_enabled && Number(formData.manager_points_starting || 0) <= 0) {
      toast.error("Manager Points require a starting value greater than 0.");
      return;
    }

    updateLeagueMutation.mutate({
      ...formData,
      league_type: "standard",
      fantasy_points_visibility: "hidden",
      draft_team_visibility: "hidden_until_drafted",
      manager_points_starting: formData.manager_points_enabled ? Number(formData.manager_points_starting || 0) : 0,
    });
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
      queryClient.invalidateQueries(["league", league.id]);
    } catch (error) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const updateManagerAction = (key, patch) => {
    setFormData({
      ...formData,
      manager_point_actions: {
        ...formData.manager_point_actions,
        [key]: { ...formData.manager_point_actions[key], ...patch },
      },
    });
  };

  const updateRuleNote = (key, value) => {
    setFormData({
      ...formData,
      league_rule_notes: {
        ...formData.league_rule_notes,
        [key]: value,
      },
    });
  };

  const feedbackCounts = (eventId) => {
    const rows = auditFeedback.filter((item) => item.audit_event_id === eventId);
    return {
      up: rows.filter((item) => item.vote === "up").length,
      down: rows.filter((item) => item.vote === "down").length,
    };
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="mb-4 text-2xl font-black uppercase">League Settings</h3>

      <div className="neo-border bg-[#FFF7D6] p-6">
        <h4 className="mb-4 text-xl font-black uppercase">Commissioner Notes</h4>
        <div>
          <Label className="mb-2 block text-sm font-black uppercase">League Message</Label>
          <Textarea
            value={formData.commissioner_message_of_day}
            onChange={(event) => setFormData({ ...formData, commissioner_message_of_day: event.target.value })}
            className="neo-border min-h-32 font-bold"
            placeholder="Add the current commissioner message shown on the league hub."
          />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {RULE_NOTE_FIELDS.map((rule) => (
            <div key={rule.key} className="neo-border bg-white p-4">
              <Label className="mb-2 block text-sm font-black uppercase">{rule.label}</Label>
              <p className="mb-2 text-xs font-bold text-gray-600">{rule.description}</p>
              <Textarea
                value={formData.league_rule_notes?.[rule.key] || ""}
                onChange={(event) => updateRuleNote(rule.key, event.target.value)}
                className="neo-border min-h-24 font-bold"
                placeholder={`Commissioner note for ${rule.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="neo-border bg-white p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-2 block text-sm font-black uppercase">League Type</Label>
            <Select value="standard" disabled>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard League</SelectItem></SelectContent>
            </Select>
            <p className="mt-2 text-xs font-bold text-gray-600">
              Standard hides exact fantasy scoring from everyone and uses tiers with scoring ranges at draft time.
            </p>
          </div>
          <div className="neo-border bg-[#EFFBFF] p-4">
            <p className="text-xs font-black uppercase text-gray-500">Rule Summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase">Fantasy Points Hidden</span>
              <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase">
                Names {formData.draft_player_name_visibility === "hidden_until_drafted" ? "Hidden Until Drafted" : "Shown"}
              </span>
              <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase">Teams Hidden Until Drafted</span>
              <span className="neo-border bg-white px-2 py-1 text-xs font-black uppercase">
                Durability {formData.durability_mode === "off" ? "Off" : formData.durability_mode === "revealed_at_draft" ? "Revealed" : "Hidden Until Drafted"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label className="mb-2 block text-sm font-black uppercase">Fantasy Points</Label>
            <Select value="hidden" disabled>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="hidden">Hidden</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-black uppercase">Player Name at Draft</Label>
            <Select value={formData.draft_player_name_visibility} onValueChange={(value) => setFormData({ ...formData, draft_player_name_visibility: value })}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shown">Show</SelectItem>
                <SelectItem value="hidden_until_drafted">Hide Until Drafted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block text-sm font-black uppercase">Durability</Label>
            <Select value={formData.durability_mode} onValueChange={(value) => setFormData({ ...formData, durability_mode: value })}>
              <SelectTrigger className="neo-border font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hidden_until_drafted">On - Hidden Until Drafted</SelectItem>
                <SelectItem value="revealed_at_draft">On - Revealed At Draft</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="neo-border bg-gray-50 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="block text-sm font-black uppercase">Manager Points</Label>
            <p className="mt-1 text-xs font-bold text-gray-600">
              Configure the points bank and available manager skills. Spending actions will be implemented separately.
            </p>
          </div>
          <Switch
            checked={formData.manager_points_enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, manager_points_enabled: checked, manager_points_starting: checked ? Math.max(1, Number(formData.manager_points_starting || 1)) : 0 })}
            className="data-[state=checked]:bg-black"
          />
        </div>
        {formData.manager_points_enabled && (
          <div className="mt-4 space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">Starting Points</Label>
              <Input
                type="number"
                min="1"
                value={formData.manager_points_starting}
                onChange={(event) => setFormData({ ...formData, manager_points_starting: Number(event.target.value || 0) })}
                className="neo-border font-bold"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(formData.manager_point_actions).map(([key, action]) => (
                <div key={key} className="neo-border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-black uppercase">{action.label}</Label>
                    <Switch
                      checked={action.active === true}
                      onCheckedChange={(checked) => updateManagerAction(key, { active: checked })}
                      className="data-[state=checked]:bg-black"
                    />
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs font-black uppercase text-gray-500">Cost</Label>
                    <Input
                      type="number"
                      min="0"
                      value={Number(action.cost || 0)}
                      onChange={(event) => updateManagerAction(key, { cost: Number(event.target.value || 0) })}
                      className="neo-border mt-1 font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {auditEvents.length > 0 && (
        <div className="neo-border bg-white p-6">
          <h4 className="mb-4 text-xl font-black uppercase">League Rule Change Log</h4>
          <div className="space-y-3">
            {auditEvents.slice(0, 8).map((event) => {
              const counts = feedbackCounts(event.id);
              return (
                <div key={event.id} className="neo-border bg-gray-50 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black uppercase">{(event.changed_keys || []).join(", ")}</p>
                      <p className="text-xs font-bold text-gray-600">
                        {event.actor_email || "League admin"} | {new Date(event.created_date).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => voteMutation.mutate({ auditEventId: event.id, vote: "up" })} className="neo-btn bg-[#D7F8E8] px-3 py-2 text-black">
                        <ThumbsUp className="mr-1 h-4 w-4" />{counts.up}
                      </Button>
                      <Button type="button" onClick={() => voteMutation.mutate({ auditEventId: event.id, vote: "down" })} className="neo-btn bg-red-100 px-3 py-2 text-black">
                        <ThumbsDown className="mr-1 h-4 w-4" />{counts.down}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="neo-border bg-[#EFFBFF] p-4">
        <Label className="mb-1 block text-sm font-black uppercase">Join Requirement</Label>
        <p className="text-lg font-black">{formatJoinFee(league)}</p>
        <p className="mt-1 text-xs font-bold text-gray-600">
          Paid league collection will be enforced by Stripe in a later integration.
        </p>
      </div>

      <div className="neo-border bg-gray-50 p-6">
        <Label className="mb-2 block text-sm font-black uppercase">League Header Image</Label>
        {league.header_image_url && (
          <div className="neo-border mb-4 overflow-hidden">
            <img src={league.header_image_url} alt="League header" className="h-48 w-full object-cover" />
          </div>
        )}
        <div className="flex gap-3">
          <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="neo-border font-bold" />
          {uploadingImage && <p className="text-sm font-bold text-gray-500">Uploading...</p>}
        </div>
        <p className="mt-2 text-xs font-bold text-gray-500">
          This image will be displayed on the league page and home page if featured
        </p>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-black uppercase">League Name</Label>
        <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="neo-border text-lg font-bold" />
      </div>
      <div>
        <Label className="mb-2 block text-sm font-black uppercase">Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="neo-border h-24 font-bold" />
      </div>
      <div>
        <Label className="mb-2 block text-sm font-black uppercase">Max Teams</Label>
        <Input
          type="number"
          min={teamLimits.min}
          max={teamLimits.max}
          step="2"
          value={formData.max_members}
          onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value, 10) })}
          disabled={leagueStarted}
          className="neo-border text-lg font-bold"
        />
        <p className="mt-1 text-xs font-bold text-gray-500">
          {leagueStarted ? "Cannot change max teams after league has started" : `Must be even, between ${teamLimits.min}-${teamLimits.max}. Current teams: ${currentMemberCount}`}
        </p>
      </div>
      <div className="neo-border flex items-center justify-between bg-gray-50 p-4">
        <Label className="block text-sm font-black uppercase">Public League</Label>
        <Switch checked={formData.is_public} onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })} className="data-[state=checked]:bg-black" />
      </div>
      <Button type="submit" disabled={updateLeagueMutation.isPending} className="neo-btn w-full bg-[#FF6B35] py-4 text-white">
        {updateLeagueMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
