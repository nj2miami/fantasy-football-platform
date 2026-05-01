import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Info, Upload, Trash2 } from "lucide-react";

export default function DataImport() {
  const queryClient = useQueryClient();
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear() - 1);
  const [uploadFile, setUploadFile] = useState(null);
  const [freshStart, setFreshStart] = useState(false);

  const createJobMutation = useMutation({
    mutationFn: (jobData) => appClient.entities.ImportJob.create(jobData),
    onSuccess: async () => {
      toast.success("Import job started!");
      try {
        await appClient.functions.invoke('processImportJobs', {});
      } catch (error) {
        console.error("Error triggering job:", error);
      }
      queryClient.invalidateQueries(["latest-import-job"]);
    },
    onError: () => {
      toast.error("Failed to start import job.");
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      queryClient.setQueryData(["latest-import-job"], {
        status: "PENDING",
        progress: 0,
        logs: ["Uploading file and starting job..."]
      });
      
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      
      const job = await appClient.entities.ImportJob.create({
        job_type: "HISTORICAL_STATS",
        parameters: { file_url, manual_upload: true, fresh_start: freshStart },
        status: "PENDING",
        logs: [
          freshStart ? "═══ FRESH START MODE ═══" : "Manual CSV upload started.",
          freshStart ? "Will delete all existing data before import..." : "File uploaded, awaiting processing..."
        ]
      });

      await appClient.functions.invoke('processImportJobs', {});
      
      return job;
    },
    onSuccess: () => {
      toast.success("File uploaded and processing started!");
      setUploadFile(null);
      setFreshStart(false);
      queryClient.invalidateQueries(["latest-import-job"]);
    },
    onError: (error) => {
      toast.error("Failed to upload file: " + (error.message || "Unknown error"));
      queryClient.invalidateQueries(["latest-import-job"]);
    }
  });

  const cleanAllMutation = useMutation({
    mutationFn: async () => {
      const job = await appClient.entities.ImportJob.create({
        job_type: "CLEAN_ALL",
        status: "PENDING",
        logs: ["Clean All job created. Will delete all player data..."]
      });

      await appClient.functions.invoke('processImportJobs', {});
      return job;
    },
    onSuccess: () => {
      toast.success("Clean All job started!");
      queryClient.invalidateQueries(["latest-import-job"]);
    },
    onError: () => {
      toast.error("Failed to start Clean All job.");
    }
  });

  const handleImport = () => {
    if (startYear > endYear) {
      toast.error("Start year cannot be after end year.");
      return;
    }
    createJobMutation.mutate({
      job_type: "HISTORICAL_STATS",
      parameters: { start_year: startYear, end_year: endYear },
      status: "PENDING",
      logs: [
        "Job created. Awaiting backend worker...",
        `Fetching data for seasons ${startYear}-${endYear}...`
      ]
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUploadSubmit = () => {
    if (!uploadFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (freshStart) {
      const confirm = window.confirm("⚠️ WARNING: Fresh Start will DELETE ALL existing player and stat data. Are you sure?");
      if (!confirm) return;
    }
    uploadFileMutation.mutate(uploadFile);
  };

  const handleCleanAll = () => {
    const confirm = window.confirm("⚠️ DANGER: This will DELETE ALL player and stat data permanently. This cannot be undone. Are you absolutely sure?");
    if (!confirm) return;
    
    const doubleConfirm = window.confirm("⚠️ FINAL WARNING: All Player and PlayerWeek records will be deleted. Type 'DELETE' to confirm.");
    if (!doubleConfirm) return;

    cleanAllMutation.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Clean All Button */}
      <div className="neo-card bg-red-50 border-red-500 p-6">
        <h3 className="text-2xl font-black uppercase mb-4 text-red-800 flex items-center gap-2">
          <Trash2 className="w-6 h-6" />
          DANGER ZONE
        </h3>
        <p className="text-sm font-bold text-red-700 mb-4">
          This will permanently delete all Player and PlayerWeek records and reset all player counts to zero.
        </p>
        <Button
          onClick={handleCleanAll}
          disabled={cleanAllMutation.isPending}
          className="neo-btn bg-red-600 text-white hover:bg-red-700"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          {cleanAllMutation.isPending ? "Cleaning..." : "Clean All Data"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel - API Import */}
        <div className="neo-card bg-white p-8">
          <h3 className="text-2xl font-black uppercase mb-6">Import via API</h3>
          
          <div className="space-y-6">
            <div className="neo-border bg-[#FFFBEB] text-[#B45309] p-4 flex gap-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-bold">
                This triggers a backend workflow to import the selected completed NFL season into Supabase-backed player and weekly stat tables.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">Start Year</Label>
                <Input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value))}
                  className="neo-border font-bold"
                />
              </div>
              <div>
                <Label className="font-black uppercase text-sm mb-2 block">End Year</Label>
                <Input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(parseInt(e.target.value))}
                  className="neo-border font-bold"
                />
              </div>
            </div>
            
            <Button
              onClick={handleImport}
              disabled={createJobMutation.isPending}
              className="neo-btn bg-[#FF6B35] text-white w-full py-4"
            >
              Start API Import
            </Button>
          </div>
        </div>

        {/* Manual Upload Panel */}
        <div className="neo-card bg-white p-8">
          <h3 className="text-2xl font-black uppercase mb-6">Manual File Upload</h3>
          
          <div className="space-y-6">
            <div className="neo-border bg-[#EFF6FF] text-[#1E40AF] p-4 flex gap-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-bold">
                Upload a CSV (comma-separated) or TSV (tab-separated) file with player-week stats for a completed NFL season.
              </p>
            </div>

            <div>
              <Label className="font-black uppercase text-sm mb-2 block">Select File (CSV/TSV/TXT)</Label>
              <Input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="neo-border font-bold"
              />
              {uploadFile && (
                <p className="text-sm font-bold text-gray-600 mt-2">
                  Selected: {uploadFile.name}
                </p>
              )}
            </div>

            <div className="neo-border bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-black uppercase text-sm text-red-800">Fresh Start</Label>
                <Switch
                  checked={freshStart}
                  onCheckedChange={setFreshStart}
                  className="data-[state=checked]:bg-red-600"
                />
              </div>
              <p className="text-xs font-bold text-red-700">
                ⚠️ WARNING: This will DELETE ALL existing player and stat data before importing.
              </p>
            </div>
            
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadFile || uploadFileMutation.isPending}
              className="neo-btn bg-[#00D9FF] text-black w-full py-4"
            >
              <Upload className="w-5 h-5 mr-2" />
              {uploadFileMutation.isPending ? "Uploading..." : "Upload and Process"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
