import { useState } from "react";
import {
  Calendar,
  Target,
  Megaphone,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Button, Badge } from "@/components/shared";
import type { ColumnMapping } from "@/types";

type ColumnRole = "date" | "target" | "media" | "control" | "ignore";

interface ColumnAssignment {
  role: ColumnRole;
  channelName: string;
}

interface ColumnMapperProps {
  headers: string[];
  onMappingComplete: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

function autoDetectRole(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h === "date" || h === "week" || h.includes("date")) return "date";
  if (
    h === "revenue" ||
    h === "sales" ||
    h === "conversions" ||
    h.includes("target") ||
    h.includes("kpi")
  )
    return "target";
  if (
    h.includes("spend") ||
    h.includes("cost") ||
    h.includes("impression") ||
    h.includes("click") ||
    h.includes("_ads") ||
    h.includes("media")
  )
    return "media";
  if (
    h.includes("promo") ||
    h.includes("holiday") ||
    h.includes("season") ||
    h.includes("weather") ||
    h.includes("index") ||
    h.includes("control")
  )
    return "control";
  return "ignore";
}

function autoChannelName(header: string): string {
  return header
    .replace(/_spend$|_cost$|_impressions$|_clicks$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const roleIcons: Record<ColumnRole, React.ReactNode> = {
  date: <Calendar className="h-3.5 w-3.5" />,
  target: <Target className="h-3.5 w-3.5" />,
  media: <Megaphone className="h-3.5 w-3.5" />,
  control: <SlidersHorizontal className="h-3.5 w-3.5" />,
  ignore: null,
};

export default function ColumnMapper({
  headers,
  onMappingComplete,
  onBack,
}: ColumnMapperProps) {
  const [assignments, setAssignments] = useState<Record<string, ColumnAssignment>>(() => {
    const initial: Record<string, ColumnAssignment> = {};
    for (const h of headers) {
      const role = autoDetectRole(h);
      initial[h] = {
        role,
        channelName: role === "media" ? autoChannelName(h) : "",
      };
    }
    return initial;
  });

  function setRole(header: string, role: ColumnRole) {
    setAssignments((prev) => ({
      ...prev,
      [header]: {
        role,
        channelName:
          role === "media"
            ? (prev[header]?.channelName || autoChannelName(header))
            : "",
      },
    }));
  }

  function setChannelName(header: string, name: string) {
    setAssignments((prev) => ({
      ...prev,
      [header]: { ...prev[header]!, channelName: name },
    }));
  }

  function canProceed(): boolean {
    const values = Object.values(assignments);
    const hasDate = values.some((v) => v.role === "date");
    const hasTarget = values.some((v) => v.role === "target");
    const hasMedia = values.some((v) => v.role === "media");
    return hasDate && hasTarget && hasMedia;
  }

  function handleSubmit() {
    const dateCol = Object.entries(assignments).find(
      ([, v]) => v.role === "date",
    );
    const targetCol = Object.entries(assignments).find(
      ([, v]) => v.role === "target",
    );
    const mediaCols = Object.entries(assignments).filter(
      ([, v]) => v.role === "media",
    );
    const controlCols = Object.entries(assignments)
      .filter(([, v]) => v.role === "control")
      .map(([k]) => k);

    if (!dateCol || !targetCol) return;

    const mediaMap: Record<string, { channel_name: string; spend_type: string }> = {};
    for (const [key, val] of mediaCols) {
      mediaMap[key] = {
        channel_name: val.channelName || autoChannelName(key),
        spend_type: "spend",
      };
    }

    const mapping: ColumnMapping = {
      date_column: dateCol[0],
      target_column: targetCol[0],
      media_columns: mediaMap,
      control_columns: controlCols,
    };
    onMappingComplete(mapping);
  }

  const dateCount = Object.values(assignments).filter((v) => v.role === "date").length;
  const targetCount = Object.values(assignments).filter((v) => v.role === "target").length;
  const mediaCount = Object.values(assignments).filter((v) => v.role === "media").length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <span className="text-xs font-medium text-gray-500">Detected:</span>
        <Badge variant={dateCount === 1 ? "brand" : "error"}>
          {dateCount} date column{dateCount !== 1 ? "s" : ""}
        </Badge>
        <Badge variant={targetCount === 1 ? "success" : "error"}>
          {targetCount} target column{targetCount !== 1 ? "s" : ""}
        </Badge>
        <Badge variant={mediaCount > 0 ? "warning" : "error"}>
          {mediaCount} media channel{mediaCount !== 1 ? "s" : ""}
        </Badge>
        {canProceed() && (
          <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            Ready to proceed
          </div>
        )}
      </div>

      {/* Column rows */}
      <div className="space-y-2">
        {headers.map((header) => {
          const assignment = assignments[header];
          if (!assignment) return null;
          return (
            <div
              key={header}
              data-testid={`column-row-${header}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <code className="min-w-0 flex-1 truncate text-sm font-mono text-gray-700">
                {header}
              </code>

              {/* Role selector */}
              <div className="flex gap-1">
                {(["date", "target", "media", "control", "ignore"] as ColumnRole[]).map(
                  (role) => (
                    <button
                      key={role}
                      onClick={() => setRole(header, role)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        assignment.role === role
                          ? role === "date"
                            ? "bg-brand-100 text-brand-700"
                            : role === "target"
                              ? "bg-emerald-100 text-emerald-700"
                              : role === "media"
                                ? "bg-amber-100 text-amber-700"
                                : role === "control"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-200 text-gray-600"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                      aria-label={`Set ${header} as ${role} column`}
                      aria-pressed={assignment.role === role}
                    >
                      {roleIcons[role]}
                      {role}
                    </button>
                  ),
                )}
              </div>

              {/* Channel name input for media columns */}
              {assignment.role === "media" && (
                <input
                  type="text"
                  value={assignment.channelName}
                  onChange={(e) => setChannelName(header, e.target.value)}
                  placeholder="Channel name"
                  className="w-36 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  aria-label={`Channel name for ${header}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={!canProceed()} data-testid="validate-data-btn">
          Validate Data
        </Button>
      </div>
    </div>
  );
}
