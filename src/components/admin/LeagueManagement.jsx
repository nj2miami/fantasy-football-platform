import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Crown, RotateCcw, Star, Plus, Trash2 } from 'lucide-react';

function formatJoinFee(league) {
  if (league.league_tier !== 'PAID') return 'Free';
  const amount = Number(league.join_fee_cents || 0) / 100;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)} to join`;
}

export default function LeagueManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data: leagues = [], isLoading } = useQuery({
    queryKey: ['all-leagues-admin'],
    queryFn: () => appClient.entities.League.list('-created_date'),
  });

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leagues
      .filter((league) => (showArchived ? !!league.archived_at : !league.archived_at))
      .filter((league) => !term || `${league.name} ${league.commissioner_email}`.toLowerCase().includes(term));
  }, [leagues, search, showArchived]);

  const updateLeagueMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.League.update(id, data),
    onSuccess: () => {
      toast.success('League updated!');
      queryClient.invalidateQueries({ queryKey: ['all-leagues-admin'] });
    },
    onError: () => {
      toast.error('Failed to update league.');
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }) => appClient.functions.invoke(action, payload),
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === 'restore_league'
          ? 'League restored.'
          : variables.action === 'force_delete_league'
            ? 'League force deleted.'
            : 'Official league created!'
      );
      queryClient.invalidateQueries({ queryKey: ['all-leagues-admin'] });
    },
    onError: (error) => {
      toast.error(error.message || 'League action failed.');
    },
  });

  if (isLoading) return <div>Loading leagues...</div>;

  return (
    <div className="space-y-6">
      <div className="neo-card bg-[#F7B801] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black uppercase">Official League System</h3>
            <p className="text-sm font-bold text-black/70 mt-1">
              Creates a public sponsored 8-team league through the Supabase function path.
            </p>
          </div>
          <Button
            onClick={() => actionMutation.mutate({ action: 'create_official_league', payload: {} })}
            disabled={actionMutation.isPending}
            className="neo-btn bg-black text-[#F7B801]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Official League
          </Button>
        </div>
      </div>

      <div className="neo-card bg-white p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h3 className="text-2xl font-black uppercase">Manage All Leagues</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leagues..."
              className="neo-border font-bold"
            />
            <Button
              onClick={() => setShowArchived((current) => !current)}
              className="neo-btn bg-white text-black"
            >
              {showArchived ? 'Show Active' : 'Show Archived'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {filteredLeagues.map((league) => (
            <div key={league.id} className="neo-border p-4 bg-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <Link
                  to={createPageUrl(`LeagueManage?id=${league.id}&asAdmin=true`)}
                  className="font-black text-lg uppercase hover:underline"
                >
                  {league.name}
                </Link>
                <p className="text-sm font-bold text-gray-500">
                  Commissioner: {league.commissioner_email || 'None'}
                </p>
                <p className="text-xs font-black uppercase text-gray-500">
                  {league.archived_at ? `Deleted ${new Date(league.archived_at).toLocaleDateString()}` : league.league_status || 'RECRUITING'}
                </p>
                <p className="text-xs font-black uppercase text-gray-500">
                  {league.league_tier || 'FREE'} / {formatJoinFee(league)}
                </p>
                {league.refund_status === 'PENDING' && (
                  <div className="inline-block mt-2 neo-border bg-[#F7B801] text-black px-2 py-1 text-xs font-black uppercase">
                    Refund Pending
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Star className={`w-5 h-5 ${league.is_sponsored ? 'text-yellow-500 fill-yellow-400' : 'text-gray-300'}`} />
                  <Switch
                    checked={!!league.is_sponsored}
                    onCheckedChange={(checked) => updateLeagueMutation.mutate({ id: league.id, data: { is_sponsored: checked } })}
                  />
                </div>
                {league.archived_at ? (
                  <Button
                    onClick={() => actionMutation.mutate({ action: 'restore_league', payload: { league_id: league.id } })}
                    className="neo-btn bg-[#00D9FF] text-black"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    onClick={() => actionMutation.mutate({ action: 'force_delete_league', payload: { league_id: league.id, archive_reason: 'Admin force delete' } })}
                    className="neo-btn bg-red-500 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Force Delete
                  </Button>
                )}
                <Link to={createPageUrl(`LeagueManage?id=${league.id}&asAdmin=true`)}>
                  <button className="neo-btn bg-[#6A4C93] text-white px-4 py-2 flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Admin
                  </button>
                </Link>
              </div>
            </div>
          ))}
          {filteredLeagues.length === 0 && (
            <p className="font-bold text-gray-500">No leagues match this view.</p>
          )}
        </div>
      </div>
    </div>
  );
}
