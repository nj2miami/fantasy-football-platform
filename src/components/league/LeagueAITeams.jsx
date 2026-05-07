import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Bot, Trash2, Edit } from "lucide-react";

const AddAIDialog = ({ league, membersCount, setupLocked = false }) => {
  const queryClient = useQueryClient();
  const [persona, setPersona] = useState("BALANCED");
  const [isOpen, setIsOpen] = useState(false);

  const addAIMutation = useMutation({
    mutationFn: async () => {
      if (setupLocked) throw new Error("League setup is locked after the draft starts.");
      return appClient.functions.invoke("add_ai_team", {
        league_id: league.id,
        ai_persona: persona,
      });
    },
    onSuccess: () => {
      toast.success("AI team added to the league!");
      queryClient.invalidateQueries({ queryKey: ['league-ai-teams', league.id] });
      setIsOpen(false);
    },
    onError: (e) => {
      toast.error(e.message || "Failed to add AI team.");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="neo-btn bg-[#00D9FF] text-black w-auto px-4" disabled={membersCount >= league.max_members || setupLocked}>
          <Plus className="w-5 h-5 mr-2" />
          Add AI
        </Button>
      </DialogTrigger>
      <DialogContent className="neo-card">
        <DialogHeader>
          <DialogTitle className="font-black uppercase text-2xl">Add AI Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <p className="font-bold text-gray-600">Choose a persona for the AI. This will determine its drafting strategy.</p>
            <div>
                <Label className="font-black uppercase text-sm">AI Persona</Label>
                <Select value={persona} onValueChange={setPersona}>
                    <SelectTrigger className="neo-border mt-2 font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="BALANCED">Balanced</SelectItem>
                        <SelectItem value="OFFENSIVE">Offensive</SelectItem>
                        <SelectItem value="DEFENSIVE">Defensive</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={() => addAIMutation.mutate()} disabled={addAIMutation.isPending} className="neo-btn bg-[#FF6B35] text-white w-full">
                {addAIMutation.isPending ? "Adding..." : "Add AI to League"}
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const EditAIDialog = ({ member, league, setupLocked = false }) => {
    const queryClient = useQueryClient();
    const [teamName, setTeamName] = useState(member.team_name);
    const [persona, setPersona] = useState(member.ai_persona);
    const [isOpen, setIsOpen] = useState(false);

    const updateAIMutation = useMutation({
        mutationFn: (data) => {
          if (setupLocked) throw new Error("League setup is locked after the draft starts.");
          return appClient.functions.invoke("update_ai_team", { member_id: member.id, ...data });
        },
        onSuccess: () => {
            toast.success("AI Team updated!");
            queryClient.invalidateQueries({ queryKey: ['league-ai-teams', league.id] });
            setIsOpen(false);
        },
        onError: () => toast.error("Failed to update AI team.")
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={setupLocked}><Edit className="w-4 h-4 text-gray-500" /></Button>
            </DialogTrigger>
            <DialogContent className="neo-card">
                <DialogHeader><DialogTitle className="font-black uppercase text-2xl">Edit AI Team</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label className="font-black uppercase text-sm">Team Name</Label>
                        <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="neo-border mt-1" />
                    </div>
                    <div>
                        <Label className="font-black uppercase text-sm">AI Persona</Label>
                        <Select value={persona} onValueChange={setPersona}>
                            <SelectTrigger className="neo-border mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BALANCED">Balanced</SelectItem>
                                <SelectItem value="OFFENSIVE">Offensive</SelectItem>
                                <SelectItem value="DEFENSIVE">Defensive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => updateAIMutation.mutate({ team_name: teamName, ai_persona: persona })} disabled={updateAIMutation.isPending} className="neo-btn bg-[#FF6B35] text-white w-full">
                        {updateAIMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const DeleteAIDialog = ({ member, league, setupLocked = false }) => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    
    const deleteAIMutation = useMutation({
        mutationFn: () => {
          if (setupLocked) throw new Error("League setup is locked after the draft starts.");
          return appClient.functions.invoke("remove_ai_team", { member_id: member.id });
        },
        onSuccess: () => {
            toast.success("AI Team removed.");
            queryClient.invalidateQueries({ queryKey: ['league-ai-teams', league.id] });
            setIsOpen(false);
        },
        onError: () => toast.error("Failed to remove AI team.")
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="ghost" size="icon" disabled={setupLocked}><Trash2 className="w-4 h-4 text-red-500" /></Button></DialogTrigger>
            <DialogContent className="neo-card">
                <DialogHeader><DialogTitle className="font-black uppercase text-2xl">Remove AI Team?</DialogTitle></DialogHeader>
                <DialogDescription className="font-bold">Are you sure you want to remove {member.team_name}? This cannot be undone.</DialogDescription>
                <DialogFooter>
                    <DialogClose asChild><Button className="neo-btn bg-gray-200 text-black">Cancel</Button></DialogClose>
                    <Button onClick={() => deleteAIMutation.mutate()} className="neo-btn bg-red-500 text-white">Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function LeagueAITeams({ league, setupLocked = false }) {
  const { data: members, isLoading } = useQuery({
    queryKey: ['league-ai-teams', league.id],
    queryFn: () => appClient.entities.LeagueMember.filter({ league_id: league.id }),
  });

  const aiMembers = members?.filter(m => m.is_ai && m.is_active !== false) || [];
  const totalMembers = members?.filter(m => m.is_active !== false).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black uppercase">
          AI Teams ({aiMembers.length})
        </h3>
        <AddAIDialog league={league} membersCount={totalMembers} setupLocked={setupLocked} />
      </div>
      {isLoading ? (
        <p>Loading members...</p>
      ) : (
        <div className="space-y-3">
          {aiMembers.map(member => (
            <div key={member.id} className="flex justify-between items-center bg-gray-50 p-3 neo-border">
              <div className="flex items-center gap-3">
                <Bot className={`w-6 h-6 text-blue-500`} />
                <div>
                  <p className="font-black text-lg">{member.team_name}</p>
                  <p className="text-gray-600 font-bold text-sm">{member.user_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="bg-blue-100 text-blue-800 px-2 py-1 neo-border text-xs font-black uppercase">{member.ai_persona}</div>
                <EditAIDialog member={member} league={league} setupLocked={setupLocked} />
                <DeleteAIDialog member={member} league={league} setupLocked={setupLocked} />
              </div>
            </div>
          ))}
          {aiMembers.length === 0 && <p className="text-gray-500 font-bold">No AI teams in this league yet.</p>}
        </div>
      )}
    </div>
  );
}
