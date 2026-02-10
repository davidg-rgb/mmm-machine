import { useState } from "react";
import { Link } from "react-router-dom";
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
import ModelConfigForm from "@/components/model/ModelConfigForm";
import ModelProgress from "@/components/model/ModelProgress";
import { mockModelRuns, mockDatasets, getStatusBadgeVariant } from "@/services/mock-data";
import type { ModelRunConfig } from "@/types";

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
  const [showConfig, setShowConfig] = useState(false);
  const activeRun = mockModelRuns.find(
    (r) => r.status !== "completed" && r.status !== "failed",
  );
  const validatedDataset = mockDatasets.find((d) => d.status === "validated");

  function handleStartRun(_config: ModelRunConfig) {
    setShowConfig(false);
    // In production, this would call createModelRun(config)
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
              progress={activeRun.progress}
              message={`${activeRun.status.charAt(0).toUpperCase()}${activeRun.status.slice(1)}...`}
              etaSeconds={180}
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
          <div className="divide-y divide-gray-100">
            {mockModelRuns.map((run) => (
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
