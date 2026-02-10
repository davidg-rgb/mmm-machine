import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelRunStatus } from "@/types";

interface ProgressStage {
  key: ModelRunStatus;
  label: string;
}

const stages: ProgressStage[] = [
  { key: "queued", label: "Queued" },
  { key: "preprocessing", label: "Preprocessing" },
  { key: "fitting", label: "Fitting Model" },
  { key: "postprocessing", label: "Postprocessing" },
  { key: "completed", label: "Completed" },
];

interface ModelProgressProps {
  status: ModelRunStatus;
  progress: number;
  message?: string;
  etaSeconds?: number;
}

function stageIndex(status: ModelRunStatus): number {
  const idx = stages.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function ModelProgress({
  status,
  progress,
  message,
  etaSeconds,
}: ModelProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const currentIdx = stageIndex(status);
  const isFailed = status === "failed";

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">
            {isFailed ? "Run Failed" : message || "Processing..."}
          </p>
          <span className="text-sm font-medium text-gray-500">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isFailed ? "bg-red-500" : "bg-brand-600",
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-gray-400">
          <span>Elapsed: {formatTime(elapsed)}</span>
          {etaSeconds != null && status !== "completed" && !isFailed && (
            <span>ETA: ~{formatTime(etaSeconds)}</span>
          )}
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {stages.map((stage, i) => {
          const isActive = i === currentIdx && !isFailed;
          const isDone = i < currentIdx || status === "completed";
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  isDone
                    ? "bg-emerald-100"
                    : isActive
                      ? "bg-brand-100"
                      : "bg-gray-100",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                ) : isFailed && i === currentIdx ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-300" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isDone
                    ? "text-emerald-600"
                    : isActive
                      ? "text-brand-600"
                      : "text-gray-400",
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
