import {
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  Rows3,
  Megaphone,
  SlidersHorizontal,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/shared";
import type { ValidationReport } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface ValidationPanelProps {
  report: ValidationReport;
  onProceed: () => void;
  onBack: () => void;
}

export default function ValidationPanel({
  report,
  onProceed,
  onBack,
}: ValidationPanelProps) {
  const { errors, warnings, suggestions, data_summary } = report;
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-5">
      {/* Overall status */}
      <div
        className={`flex items-center gap-3 rounded-lg p-4 ${
          hasErrors
            ? "border border-red-200 bg-red-50"
            : "border border-emerald-200 bg-emerald-50"
        }`}
      >
        {hasErrors ? (
          <AlertCircle className="h-5 w-5 text-red-600" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        )}
        <div>
          <p
            className={`text-sm font-medium ${
              hasErrors ? "text-red-800" : "text-emerald-800"
            }`}
          >
            {hasErrors
              ? `${errors.length} error${errors.length > 1 ? "s" : ""} found`
              : "Data validation passed"}
          </p>
          <p
            className={`text-xs ${
              hasErrors ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {hasErrors
              ? "Fix errors before running the model"
              : `${warnings.length} warning${warnings.length !== 1 ? "s" : ""}, ${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Data Summary Card */}
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold text-gray-900">
            Data Summary
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <Rows3 className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Rows</p>
                <p className="text-sm font-medium text-gray-900">
                  {data_summary.row_count.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Date Range</p>
                <p className="text-sm font-medium text-gray-900">
                  {data_summary.date_range_start} - {data_summary.date_range_end}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Media Channels</p>
                <p className="text-sm font-medium text-gray-900">
                  {data_summary.media_channel_count}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Control Vars</p>
                <p className="text-sm font-medium text-gray-900">
                  {data_summary.control_variable_count}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Media Spend</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(data_summary.total_media_spend)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Avg. Target Value</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(data_summary.avg_target_value)}/wk
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertCircle className="h-4 w-4" />
            Errors
          </p>
          {errors.map((item) => (
            <div
              key={item.code}
              className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-2.5 text-sm text-red-700"
            >
              {item.column && (
                <Badge variant="error" className="mr-2">
                  {item.column}
                </Badge>
              )}
              {item.message}
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Warnings
          </p>
          {warnings.map((item) => (
            <div
              key={item.code}
              className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-2.5 text-sm text-amber-700"
            >
              {item.column && (
                <Badge variant="warning" className="mr-2">
                  {item.column}
                </Badge>
              )}
              {item.message}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
            <Lightbulb className="h-4 w-4" />
            Suggestions
          </p>
          {suggestions.map((item) => (
            <div
              key={item.code}
              className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm text-blue-700"
            >
              {item.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back to Column Mapping
        </Button>
        <Button onClick={onProceed} disabled={hasErrors}>
          {hasErrors ? "Fix Issues First" : "Proceed to Model Config"}
        </Button>
      </div>
    </div>
  );
}
