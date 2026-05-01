
import React from "react";
import { appClient } from "@/api/appClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, Hash, Calculator } from "lucide-react";

export default function PlayerManagement() {
  const queryClient = useQueryClient();

  const createJobMutation = useMutation({
    mutationFn: async (jobType) => {
      const job = await appClient.entities.ImportJob.create({
        job_type: jobType,
        status: "PENDING",
        logs: [`Job '${jobType}' created. Awaiting processing...`]
      });
      
      await appClient.functions.invoke('processImportJobs', {});
      return job;
    },
    onSuccess: (data) => {
      toast.success(`Job '${data.job_type}' started!`);
      queryClient.invalidateQueries({ queryKey: ['latest-import-job'] });
    },
    onError: (error, jobType) => {
      toast.error(`Failed to start job '${jobType}'.`);
    }
  });

  return (
    <div className="neo-card bg-white p-8">
      <h3 className="text-2xl font-black uppercase mb-6">Player Data Jobs</h3>
      <div className="space-y-6">
        
        <div className="neo-border p-6 bg-red-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-black text-lg uppercase flex items-center gap-2 text-red-800">
                <RefreshCw className="w-5 h-5" />
                Rebuild Players
              </h4>
              <p className="text-sm font-bold text-red-700 mt-2">
                ⚠️ Run this FIRST if Player table is empty. Creates Player records from PlayerWeek data.
              </p>
            </div>
            <Button 
              onClick={() => createJobMutation.mutate("REBUILD_PLAYERS")}
              className="neo-btn bg-red-600 text-white"
              disabled={createJobMutation.isPending}
            >
              Rebuild
            </Button>
          </div>
        </div>

        <div className="neo-border p-6 bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-black text-lg uppercase flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-500" />
                Recount Players
              </h4>
              <p className="text-sm font-bold text-gray-600 mt-2">
                Recalculate the number of players by position (QB, K, OFF, DEF) in the Global table.
              </p>
            </div>
            <Button 
              onClick={() => createJobMutation.mutate("RECOUNT_PLAYERS")}
              className="neo-btn bg-[#6A4C93] text-white"
              disabled={createJobMutation.isPending}
            >
              Run Job
            </Button>
          </div>
        </div>

        <div className="neo-border p-6 bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-black text-lg uppercase flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-500" />
                Scoring Update
              </h4>
              <p className="text-sm font-bold text-gray-600 mt-2">
                Run scoring calculation on all PlayerWeek records. Updates fantasy_points for every week.
              </p>
            </div>
            <Button 
              onClick={() => createJobMutation.mutate("SCORING_UPDATE")}
              className="neo-btn bg-[#00D9FF] text-black"
              disabled={createJobMutation.isPending}
            >
              Run Job
            </Button>
          </div>
        </div>

        <div className="neo-border p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-lg uppercase flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Player Stat Aggregation
              </h4>
              <p className="text-sm font-bold text-gray-600 mt-2">
                Updates player aggregates (avg_points, total_points, high_score, low_score) from PlayerWeek data.
              </p>
            </div>
            <Button 
              onClick={() => createJobMutation.mutate("PLAYER_STAT_AGGREGATION")}
              className="neo-btn bg-[#9EF01A] text-black"
              disabled={createJobMutation.isPending}
            >
              Run Job
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
