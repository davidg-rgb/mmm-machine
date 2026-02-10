import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import ModelConfigForm from "@/components/model/ModelConfigForm";
import ModelProgress from "@/components/model/ModelProgress";
import { useModelRuns, useDatasets, useCreateModelRun, queryKeys } from "@/hooks/api-hooks";
import { subscribeToProgress } from "@/services/api";
import { getStatusBadgeVariant } from "@/lib/utils";
import type { ModelRunConfig, ModelRun as ModelRunType, ProgressEvent } from "@/types";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "fitting":
    case "preprocessing":
    case "postprocessing":
      return <Loader2 className="h-4 w-4 animate-spin text-brand-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

export default function ModelRun() {
  usePageTitle("Model Runs");
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [sseProgress, setSseProgress] = useState<number | null>(null);
  const [sseMessage, setSseMessage] = useState<string | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | undefined>(undefined);
  const prevRunIdRef = useRef<string | undefined>(undefined);

  const { data: modelRuns, isLoading: runsLoading } = useModelRuns();
  const { data: datasets } = useDatasets();
  const createModelRun = useCreateModelRun();

  const runs: ModelRunType[] = modelRuns ?? [];
  const activeRun = runs.find(
    (r) => !["completed", "failed"].includes(r.status),
  );
  const validatedDataset = (datasets ?? []).find(
    (d: { status: string }) => d.status === "validated",
  );

  const activeRunId = activeRun?.id;
  const activeRunStatus = activeRun?.status;
  const activeRunProgress = activeRun?.progress ?? 0;

  // Reset SSE state when the active run changes
  if (prevRunIdRef.current !== activeRunId) {
    prevRunIdRef.current = activeRunId;
    setSseProgress(null);
    setSseMessage(null);
    setEtaSeconds(undefined);
  }

  // Derive progress/message from SSE state or fallback to activeRun data
  const progress = sseProgress ?? activeRunProgress;
  const message = sseMessage ??
    (activeRunStatus
      ? `${activeRunStatus.charAt(0).toUpperCase()}${activeRunStatus.slice(1)}...`
      : "");

  // SSE progress subscription for active runs
  useEffect(() => {
    if (
      !activeRunId ||
      !activeRunStatus ||
      !["fitting", "preprocessing", "postprocessing"].includes(activeRunStatus)
    ) {
      return;
    }

    const es = subscribeToProgress(activeRunId, (event: unknown) => {
      const evt = event as ProgressEvent;
      setSseProgress(evt.progress);
      setSseMessage(evt.message);
      if (evt.eta_seconds != null) {
        setEtaSeconds(evt.eta_seconds);
      }
      if (evt.status === "completed" || evt.status === "failed") {
        queryClient.invalidateQueries({ queryKey: queryKeys.modelRuns });
        es.close();
      }
    });

    return () => es.close();
  }, [activeRunId, activeRunStatus, queryClient]);

  function handleStartRun(config: ModelRunConfig) {
    setShowConfig(false);
    createModelRun.mutate(config);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Model Runs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure and run Bayesian Marketing Mix Models
          </p>
        </div>
        <Button
          onClick={() => setShowConfig(true)}
          disabled={!validatedDataset}
        >
          <Plus className="h-4 w-4" />
          New Run
        </Button>
      </div>

      {/* Active run progress */}
      {activeRun && (
        <Card className="border-brand-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
              {activeRun.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ModelProgress
              status={activeRun.status}
              progress={progress}
              message={
                message ||
                `${activeRun.status.charAt(0).toUpperCase()}${activeRun.status.slice(1)}...`
              }
              etaSeconds={etaSeconds}
            />
          </CardContent>
        </Card>
      )}

      {/* Run list */}
      <Card>
        <CardHeader>
          <CardTitle>All Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No model runs yet. Upload data to get started.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <StatusIcon status={run.status} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {run.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {run.config.adstock_type}/{run.config.saturation_type}
                      {" \u00b7 "}
                      {run.config.mode === "quick" ? "Quick" : "Full"}
                      {run.started_at &&
                        ` \u00b7 ${new Date(run.started_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(run.status)}>
                    {run.status}
                  </Badge>
                  {run.status === "completed" && run.results && (
                    <span className="text-xs text-gray-500">
                      R{"\u00b2"}{" "}
                      {(run.results.diagnostics.r_squared * 100).toFixed(0)}%
                    </span>
                  )}
                  {run.status === "completed" ? (
                    <Link
                      to={`/results/${run.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Results
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : run.status === "failed" ? (
                    <span className="max-w-48 truncate text-xs text-red-500">
                      {run.error_message}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config modal */}
      <Modal open={showConfig} onOpenChange={setShowConfig}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Configure Model Run</ModalTitle>
          </ModalHeader>
          <ModelConfigForm
            datasetId={validatedDataset?.id ?? ""}
            onSubmit={handleStartRun}
          />
        </ModalContent>
      </Modal>
    </div>
  );
}
