export const latestImportJobKey = ["latest-import-job"];

export function freshJobPanelSnapshot(job) {
  return {
    ...job,
    status: "PENDING",
    progress: 0,
    summary: null,
    error_details: null,
    logs: Array.isArray(job?.logs) ? job.logs : [],
  };
}

export function showFreshJobInPanel(queryClient, job) {
  queryClient.setQueryData(latestImportJobKey, freshJobPanelSnapshot(job));
}

export function refreshJobPanel(queryClient) {
  return queryClient.invalidateQueries({ queryKey: latestImportJobKey });
}
