import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShieldCheck, UploadCloud, Settings, Users, ClipboardList, Trophy, Terminal, RefreshCw, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DataImport from "../components/admin/DataImport";
import ScoringSettings from "../components/admin/ScoringSettings";
import PlayerManagement from "../components/admin/PlayerManagement";
import RosterSettings from "../components/admin/RosterSettings";
import LeagueManagement from "../components/admin/LeagueManagement";

const AdminTabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { name: "Data Import", icon: UploadCloud, id: "import" },
    { name: "Scoring Rules", icon: Settings, id: "scoring" },
    { name: "Player Jobs", icon: Users, id: "players" },
    { name: "Roster Rules", icon: ClipboardList, id: "roster" },
    { name: "Leagues", icon: Trophy, id: "leagues" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`neo-btn px-6 py-3 flex items-center gap-2 ${
            activeTab === tab.id ? "bg-black text-[#FF6B35]" : "bg-white text-black"
          }`}
        >
          <tab.icon className="w-5 h-5" />
          {tab.name}
        </button>
      ))}
    </div>
  );
};

const StatusIndicator = ({ status }) => {
  switch (status) {
    case "PENDING":
      return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
    case "RUNNING":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "COMPLETED":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "FAILED":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return null;
  }
};

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("import");
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [paginationTestResult, setPaginationTestResult] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await appClient.auth.me();
        if (user.role !== 'admin') {
          navigate(createPageUrl("Dashboard"));
        }
      } catch {
        navigate(createPageUrl("Dashboard"));
      }
    };
    checkAdmin();
  }, [navigate]);

  const { data: latestJob, isLoading, refetch } = useQuery({
    queryKey: ["latest-import-job"],
    queryFn: async () => {
      const jobs = await appClient.entities.ImportJob.list("-created_date", 1);
      return jobs[0] || null;
    },
    refetchInterval: (data) => (data?.status === "RUNNING" || data?.status === "PENDING" ? 2000 : false),
  });

  const runDiagnosticMutation = useMutation({
    mutationFn: async () => {
      const response = await appClient.functions.invoke('diagnosticPlayerData', {});
      return response.data;
    },
    onSuccess: (data) => {
      setDiagnosticResult(data);
      toast.success("Diagnostic complete - check results below");
    },
    onError: (error) => {
      console.error("Diagnostic failed:", error);
      toast.error("Diagnostic failed");
    }
  });

  const runPaginationTestMutation = useMutation({
    mutationFn: async () => {
      const response = await appClient.functions.invoke('testPagination', {});
      return response.data;
    },
    onSuccess: (data) => {
      setPaginationTestResult(data);
      toast.success("Pagination test complete");
    },
    onError: (error) => {
      console.error("Pagination test failed:", error);
      toast.error("Pagination test failed");
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="neo-card bg-black text-white p-8 mb-8 rotate-[-0.5deg]">
        <div className="rotate-[0.5deg] flex items-center gap-4">
          <ShieldCheck className="w-12 h-12 text-[#FF6B35]" />
          <div>
            <h1 className="text-orange-600 mb-2 text-4xl font-black uppercase">ADMIN PANEL</h1>
            <p className="text-lg font-bold text-[#F7B801]">
              Site Management & Data Operations
            </p>
          </div>
        </div>
      </div>

      {/* Status & Logs - Above Tabs */}
      <div className="neo-card bg-black text-white p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black uppercase flex items-center gap-3">
            <Terminal className="w-6 h-6 text-[#00D9FF]" />
            Job Status & Logs
          </h3>
          <div className="flex gap-2">
            <Button
              onClick={() => runPaginationTestMutation.mutate()}
              disabled={runPaginationTestMutation.isPending}
              className="neo-btn bg-[#9EF01A] text-black"
              size="sm"
            >
              Test Pagination
            </Button>
            <Button
              onClick={() => runDiagnosticMutation.mutate()}
              disabled={runDiagnosticMutation.isPending}
              className="neo-btn bg-[#F7B801] text-black"
              size="sm"
            >
              Run Diagnostic
            </Button>
            <Button
              onClick={() => refetch()}
              className="neo-btn bg-[#00D9FF] text-black"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Update
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <p className="font-bold text-gray-400">Loading job status...</p>
        ) : !latestJob ? (
          <p className="font-bold text-gray-400">No jobs run yet.</p>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 p-4 neo-border bg-[#222]">
              <div className="flex items-center gap-3">
                <StatusIndicator status={latestJob.status} />
                <p className="font-black uppercase text-lg">{latestJob.status}</p>
                <p className="text-sm font-bold text-gray-400">
                  {latestJob.job_type}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-400">
                {new Date(latestJob.created_date).toLocaleString()}
              </p>
            </div>
            
            {latestJob.status === "RUNNING" && (
              <div className="mb-4">
                <div className="h-4 neo-border bg-gray-700 overflow-hidden">
                  <div 
                    className="h-full bg-[#00D9FF] transition-all duration-500"
                    style={{ width: `${latestJob.progress || 0}%` }}
                  />
                </div>
                <p className="text-right text-sm font-bold mt-1 text-[#00D9FF]">{latestJob.progress || 0}%</p>
              </div>
            )}
            
            <div className="h-64 bg-[#111] neo-border p-4 font-mono text-sm overflow-y-auto">
              {(latestJob.logs || []).map((log, i) => (
                <p key={i} className="whitespace-pre-wrap">{`> ${log}`}</p>
              ))}
              {latestJob.status === "COMPLETED" && latestJob.summary && (
                <p className="text-green-500 font-bold mt-2">{`> JOB COMPLETED: ${latestJob.summary || 'Success'}`}</p>
              )}
              {latestJob.status === "FAILED" && latestJob.error_details && (
                <p className="text-red-500 font-bold mt-2">{`> JOB FAILED: ${latestJob.error_details}`}</p>
              )}
            </div>
          </div>
        )}

        {/* Pagination Test Results */}
        {paginationTestResult && (
          <div className="mt-6 p-4 neo-border bg-[#222]">
            <h4 className="font-black text-[#9EF01A] mb-3">PAGINATION TEST RESULTS</h4>
            <pre className="text-xs text-green-400 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(paginationTestResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Diagnostic Results */}
        {diagnosticResult && (
          <div className="mt-6 p-4 neo-border bg-[#222]">
            <h4 className="font-black text-[#F7B801] mb-3">DIAGNOSTIC RESULTS</h4>
            <pre className="text-xs text-green-400 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(diagnosticResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div>
        {activeTab === "import" && <DataImport />}
        {activeTab === "scoring" && <ScoringSettings />}
        {activeTab === "players" && <PlayerManagement />}
        {activeTab === "roster" && <RosterSettings />}
        {activeTab === "leagues" && <LeagueManagement />}
      </div>
    </div>
  );
}
