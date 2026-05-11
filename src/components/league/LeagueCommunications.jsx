import React, { useEffect, useMemo, useState } from "react";
import { appClient } from "@/api/appClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Megaphone, MessageSquare, Newspaper, Send } from "lucide-react";

function formatDate(value) {
  if (!value) return "Unpublished";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unpublished";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function memberName(member) {
  return member?.team_name || member?.user_email || (member?.is_ai ? "AI Manager" : "Manager");
}

export default function LeagueCommunications({ league, members = [] }) {
  const queryClient = useQueryClient();
  const commissionerMember = useMemo(() => (
    members.find((member) => member.is_active !== false && member.role_in_league === "COMMISSIONER") || null
  ), [members]);
  const recipientMembers = useMemo(() => (
    members
      .filter((member) => member.is_active !== false && !member.is_ai && member.role_in_league !== "COMMISSIONER")
      .sort((a, b) => memberName(a).localeCompare(memberName(b)))
  ), [members]);

  const [leagueMessage, setLeagueMessage] = useState(league.commissioner_message_of_day || "");
  const [newsForm, setNewsForm] = useState({ title: "", body: "" });
  const [messageForm, setMessageForm] = useState({ recipient_member_id: "", subject: "", body: "" });

  useEffect(() => {
    setLeagueMessage(league.commissioner_message_of_day || "");
  }, [league.commissioner_message_of_day]);

  useEffect(() => {
    if (!messageForm.recipient_member_id && recipientMembers[0]?.id) {
      setMessageForm((current) => ({ ...current, recipient_member_id: recipientMembers[0].id }));
    }
  }, [messageForm.recipient_member_id, recipientMembers]);

  const { data: newsItems = [] } = useQuery({
    queryKey: ["league-communications-news", league.id],
    queryFn: async () => {
      const rows = await appClient.entities.LeagueNewsItem.filter({ league_id: league.id }, "-published_at");
      return rows.sort((a, b) => new Date(b.published_at || b.created_date).getTime() - new Date(a.published_at || a.created_date).getTime());
    },
  });

  const { data: managerMessages = [] } = useQuery({
    queryKey: ["league-communications-messages", league.id],
    queryFn: async () => {
      const rows = await appClient.entities.ManagerMessage.filter({ league_id: league.id }, "-created_date");
      return rows.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    },
  });

  const invalidateCommunicationData = () => {
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-details", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-news", league.id] });
    queryClient.invalidateQueries({ queryKey: ["manager-messages", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-communications-news", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league-communications-messages", league.id] });
  };

  const leagueMessageMutation = useMutation({
    mutationFn: () => appClient.entities.League.update(league.id, { commissioner_message_of_day: leagueMessage.trim() }),
    onSuccess: () => {
      toast.success("League message published.");
      invalidateCommunicationData();
    },
    onError: (error) => toast.error(error.message || "Failed to publish league message."),
  });

  const newsMutation = useMutation({
    mutationFn: () => appClient.entities.LeagueNewsItem.create({
      league_id: league.id,
      title: newsForm.title.trim(),
      summary: newsForm.body.trim().replace(/\s+/g, " ").slice(0, 180),
      body: newsForm.body.trim(),
      news_type: "COMMISSIONER",
      status: "PUBLISHED",
      published_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      toast.success("League news published.");
      setNewsForm({ title: "", body: "" });
      invalidateCommunicationData();
    },
    onError: (error) => toast.error(error.message || "Failed to publish league news."),
  });

  const messageMutation = useMutation({
    mutationFn: () => appClient.entities.ManagerMessage.create({
      league_id: league.id,
      sender_member_id: commissionerMember?.id || null,
      recipient_member_id: messageForm.recipient_member_id,
      subject: messageForm.subject.trim() || "League Message",
      body: messageForm.body.trim(),
    }),
    onSuccess: () => {
      toast.success("Manager message sent.");
      setMessageForm((current) => ({ ...current, subject: "", body: "" }));
      invalidateCommunicationData();
    },
    onError: (error) => toast.error(error.message || "Failed to send manager message."),
  });

  const publishNews = (event) => {
    event.preventDefault();
    if (!newsForm.title.trim()) {
      toast.error("News needs a title.");
      return;
    }
    if (!newsForm.body.trim()) {
      toast.error("News needs a body.");
      return;
    }
    newsMutation.mutate();
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!messageForm.recipient_member_id) {
      toast.error("Choose a league member.");
      return;
    }
    if (!messageForm.body.trim()) {
      toast.error("Message body is required.");
      return;
    }
    messageMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-2xl font-black uppercase">
          <Megaphone className="h-6 w-6" />
          Communications
        </h3>
        <p className="text-sm font-bold text-gray-600">
          Publish hub updates and send direct notes to managers from one place.
        </p>
      </div>

      <section className="neo-border bg-[#FFF7D6] p-6">
        <h4 className="mb-4 flex items-center gap-2 text-xl font-black uppercase">
          <MessageSquare className="h-5 w-5" />
          League Message
        </h4>
        <Label className="mb-2 block text-sm font-black uppercase">Hub Message</Label>
        <Textarea
          value={leagueMessage}
          onChange={(event) => setLeagueMessage(event.target.value)}
          className="neo-border min-h-32 font-bold"
          placeholder="Add the current commissioner message shown on the league hub."
        />
        <Button
          type="button"
          onClick={() => leagueMessageMutation.mutate()}
          disabled={leagueMessageMutation.isPending}
          className="neo-btn mt-4 bg-[#FF6B35] text-white"
        >
          <MessageSquare className="mr-2 h-5 w-5" />
          {leagueMessageMutation.isPending ? "Publishing..." : "Publish League Message"}
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={publishNews} className="neo-border bg-white p-6">
          <h4 className="mb-4 flex items-center gap-2 text-xl font-black uppercase">
            <Newspaper className="h-5 w-5" />
            League News
          </h4>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">Headline</Label>
              <Input
                value={newsForm.title}
                onChange={(event) => setNewsForm({ ...newsForm, title: event.target.value })}
                className="neo-border font-bold"
                placeholder="Week 1 draft room opens tonight"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">News Body</Label>
              <Textarea
                value={newsForm.body}
                onChange={(event) => setNewsForm({ ...newsForm, body: event.target.value })}
                className="neo-border min-h-40 font-bold"
                placeholder="Write the update managers will see on the league news tab."
              />
            </div>
            <Button type="submit" disabled={newsMutation.isPending} className="neo-btn bg-black text-white">
              <Newspaper className="mr-2 h-5 w-5" />
              {newsMutation.isPending ? "Publishing..." : "Publish News"}
            </Button>
          </div>
        </form>

        <form onSubmit={sendMessage} className="neo-border bg-white p-6">
          <h4 className="mb-4 flex items-center gap-2 text-xl font-black uppercase">
            <Mail className="h-5 w-5" />
            Manager Message
          </h4>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">Recipient</Label>
              <Select
                value={messageForm.recipient_member_id}
                onValueChange={(value) => setMessageForm({ ...messageForm, recipient_member_id: value })}
                disabled={!recipientMembers.length}
              >
                <SelectTrigger className="neo-border font-bold"><SelectValue placeholder="Choose manager" /></SelectTrigger>
                <SelectContent>
                  {recipientMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{memberName(member)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">Subject</Label>
              <Input
                value={messageForm.subject}
                onChange={(event) => setMessageForm({ ...messageForm, subject: event.target.value })}
                className="neo-border font-bold"
                placeholder="Lineup reminder"
              />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-black uppercase">Message</Label>
              <Textarea
                value={messageForm.body}
                onChange={(event) => setMessageForm({ ...messageForm, body: event.target.value })}
                className="neo-border min-h-32 font-bold"
                placeholder="Write a direct message for this manager."
              />
            </div>
            <Button type="submit" disabled={messageMutation.isPending || !recipientMembers.length} className="neo-btn bg-[#00D9FF] text-black">
              <Send className="mr-2 h-5 w-5" />
              {messageMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
          {!recipientMembers.length && <p className="mt-3 text-sm font-bold text-gray-500">No active human managers are available yet.</p>}
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="neo-border bg-gray-50 p-5">
          <h4 className="mb-3 text-lg font-black uppercase">Recent News</h4>
          <div className="space-y-3">
            {newsItems.slice(0, 5).map((item) => (
              <article key={item.id} className="neo-border bg-white p-3">
                <p className="text-xs font-black uppercase text-gray-500">{formatDate(item.published_at || item.created_date)}</p>
                <p className="mt-1 font-black uppercase">{item.title}</p>
                <p className="mt-1 text-sm font-bold text-gray-600">{item.body}</p>
              </article>
            ))}
            {!newsItems.length && <p className="neo-border bg-white p-3 text-sm font-bold text-gray-500">No commissioner news has been published yet.</p>}
          </div>
        </section>

        <section className="neo-border bg-gray-50 p-5">
          <h4 className="mb-3 text-lg font-black uppercase">Recent Manager Messages</h4>
          <div className="space-y-3">
            {managerMessages.slice(0, 5).map((message) => {
              const recipient = members.find((member) => member.id === message.recipient_member_id);
              return (
                <article key={message.id} className="neo-border bg-white p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-black uppercase">{message.subject}</p>
                    <p className="text-xs font-black uppercase text-gray-500">{formatDate(message.created_date)}</p>
                  </div>
                  <p className="text-xs font-bold uppercase text-gray-500">To {memberName(recipient)}</p>
                  <p className="mt-1 text-sm font-bold text-gray-600">{message.body}</p>
                </article>
              );
            })}
            {!managerMessages.length && <p className="neo-border bg-white p-3 text-sm font-bold text-gray-500">No direct manager messages have been sent yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
