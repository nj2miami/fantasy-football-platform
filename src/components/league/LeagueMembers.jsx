import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Bot, Copy, Crown, KeyRound, Trash2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LeagueMembers({ league, setupLocked = false }) {
  const queryClient = useQueryClient();
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [teamName, setTeamName] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["league-members", league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["league-invites", league.id],
    queryFn: () => appClient.entities.LeagueInvite.filter({ league_id: league.id }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["league-member-profiles", league.id],
    queryFn: () => appClient.entities.UserProfile.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["league-members", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-invites", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }) => {
      if (setupLocked) throw new Error("League setup is locked after the draft starts.");
      return appClient.functions.invoke(action, payload);
    },
    onSuccess: (_, variables) => {
      const labels = {
        rename_league_member_team: "Team renamed.",
        remove_league_member: "Member deactivated.",
        transfer_commissioner: "Commissioner transferred.",
        create_league_invite: "Invite code created.",
        disable_league_invite: "Invite disabled.",
      };
      toast.success(labels[variables.action] || "Action complete.");
      setEditingMemberId(null);
      setTeamName("");
      invalidate();
    },
    onError: (error) => toast.error(error.message || "Action failed."),
  });

  const startEdit = (member) => {
    setEditingMemberId(member.id);
    setTeamName(member.team_name || "");
  };

  const activeMembers = members.filter((member) => member.is_active !== false);
  const activeInvites = invites.filter((invite) => invite.is_active);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="text-2xl font-black uppercase">
          Members ({activeMembers.length} / {league.max_members})
        </h3>
        <Button
          onClick={() => actionMutation.mutate({ action: "create_league_invite", payload: { league_id: league.id } })}
          disabled={actionMutation.isPending || setupLocked}
          className="neo-btn bg-[#F7B801] text-black"
        >
          <KeyRound className="w-5 h-5 mr-2" />
          Create Invite Code
        </Button>
      </div>

      <div className="neo-border p-4 bg-[#EFFBFF]">
        <p className="font-black uppercase mb-3">Invite Codes</p>
        {activeInvites.length === 0 ? (
          <p className="font-bold text-sm text-gray-600">No active invite codes.</p>
        ) : (
          <div className="space-y-2">
            {activeInvites.map((invite) => (
              <div key={invite.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white neo-border p-3">
                <div>
                  <p className="font-black text-lg">{invite.code}</p>
                  <p className="text-xs font-bold text-gray-500">
                    Uses: {invite.used_count || 0}{invite.max_uses ? ` / ${invite.max_uses}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(invite.code);
                      toast.success("Invite code copied.");
                    }}
                    className="neo-btn bg-white text-black"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    onClick={() => actionMutation.mutate({ action: "disable_league_invite", payload: { invite_id: invite.id } })}
                    disabled={setupLocked}
                    className="neo-btn bg-gray-200 text-black"
                  >
                    Disable
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <p>Loading members...</p>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const isCommissioner = member.user_email === league.commissioner_email || member.role_in_league === "COMMISSIONER";
            const inactive = member.is_active === false;
            const profile = profiles.find((item) => item.user_email === member.user_email);
            const managerName = member.is_ai
              ? "AI Manager"
              : profile?.profile_name
                ? `@${profile.profile_name}`
                : profile?.display_name || "Manager";
            return (
              <div key={member.id} className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 neo-border ${inactive ? "bg-gray-100 opacity-60" : "bg-gray-50"}`}>
                <div className="flex items-center gap-3">
                  {member.is_ai ? <Bot className="w-6 h-6 text-blue-500" /> : <UserCircle className="w-6 h-6 text-green-600" />}
                  <div>
                    {editingMemberId === member.id ? (
                      <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} disabled={setupLocked} className="neo-border font-bold" />
                    ) : (
                      <p className="font-black text-lg">{member.team_name}</p>
                    )}
                    <p className="text-gray-600 font-bold text-sm">{managerName}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isCommissioner && (
                    <div className="bg-[#F7B801] text-black px-2 py-1 neo-border text-xs font-black uppercase">Commish</div>
                  )}
                  {member.is_ai && (
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 neo-border text-xs font-black uppercase">{member.ai_persona || "BALANCED"}</div>
                  )}
                  {inactive && (
                    <div className="bg-gray-200 text-gray-700 px-2 py-1 neo-border text-xs font-black uppercase">Inactive</div>
                  )}

                  {editingMemberId === member.id ? (
                    <Button
                      onClick={() => actionMutation.mutate({ action: "rename_league_member_team", payload: { member_id: member.id, team_name: teamName } })}
                      disabled={setupLocked}
                      className="neo-btn bg-[#00D9FF] text-black"
                    >
                      Save
                    </Button>
                  ) : (
                    <Button onClick={() => startEdit(member)} disabled={inactive || setupLocked} className="neo-btn bg-white text-black">
                      Rename
                    </Button>
                  )}

                  {!member.is_ai && !isCommissioner && (
                    <Button
                      onClick={() => actionMutation.mutate({ action: "transfer_commissioner", payload: { member_id: member.id } })}
                      disabled={inactive || setupLocked}
                      className="neo-btn bg-[#6A4C93] text-white"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Transfer
                    </Button>
                  )}

                  {!isCommissioner && (
                    <Button
                      onClick={() => actionMutation.mutate({ action: "remove_league_member", payload: { member_id: member.id } })}
                      disabled={inactive || setupLocked}
                      className="neo-btn bg-red-500 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
