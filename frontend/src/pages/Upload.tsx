import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@/components/shared";
import DataUploader from "@/components/upload/DataUploader";
import DataPreview from "@/components/upload/DataPreview";
import ColumnMapper from "@/components/upload/ColumnMapper";
import ValidationPanel from "@/components/upload/ValidationPanel";
import {
  useUploadDataset,
  useUpdateMapping,
  useValidateDataset,
} from "@/hooks/api-hooks";
import { useDatasetStore } from "@/store/dataset";
import type { ColumnMapping, ValidationReport } from "@/types";

type WizardStep = 1 | 2 | 3;

const stepLabels: Record<WizardStep, string> = {
  1: "Upload File",
  2: "Map Columns",
  3: "Validate",
};

export default function Upload() {
  usePageTitle("Upload Data");
  const [step, setStep] = useState<WizardStep>(1);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const navigate = useNavigate();
  const datasetStore = useDatasetStore();

  const uploadMutation = useUploadDataset();
  const mappingMutation = useUpdateMapping(datasetId ?? "");
  const validateMutation = useValidateDataset(datasetId ?? "");

  function handleFileAccepted(file: File) {
    uploadMutation.mutate(file, {
      onSuccess: (data: { id: string; headers?: string[]; preview_rows?: string[][] }) => {
        setDatasetId(data.id);
        setHeaders(data.headers ?? []);
        setPreviewRows(data.preview_rows ?? []);
        datasetStore.setCurrentDataset(data.id);
        setStep(2);
      },
    });
  }

  function handleMappingComplete(mapping: ColumnMapping) {
    datasetStore.setColumnMapping(mapping);
    mappingMutation.mutate(mapping, {
      onSuccess: () => {
        validateMutation.mutate(undefined, {
          onSuccess: (data: ValidationReport) => {
            setValidationReport(data);
            setStep(3);
          },
        });
      },
    });
  }

  function handleProceed() {
    navigate("/models");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Upload Marketing Data
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your CSV and map columns to run Bayesian MMM analysis
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {([1, 2, 3] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8",
                  step > s - 1 ? "bg-brand-400" : "bg-gray-200",
                )}
              />
            )}
            <button
              onClick={() => {
                if (s < step) setStep(s);
              }}
              disabled={s > step}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                s === step
                  ? "bg-brand-600 text-white"
                  : s < step
                    ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                    : "bg-gray-100 text-gray-400",
              )}
            >
              {s < step ? <Check className="h-3 w-3" /> : s}
              <span className="hidden sm:inline">{stepLabels[s]}</span>
            </button>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && "Step 1: Upload Your Data File"}
            {step === 2 && "Step 2: Map Your Columns"}
            {step === 3 && "Step 3: Review Validation"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            uploadMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500">Uploading your dataset...</p>
              </div>
            ) : (
              <DataUploader onFileAccepted={handleFileAccepted} />
            )
          )}

          {step === 2 && (
            mappingMutation.isPending || validateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500">
                  {mappingMutation.isPending
                    ? "Saving column mapping..."
                    : "Validating your data..."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <DataPreview headers={headers} rows={previewRows} />
                <ColumnMapper
                  headers={headers}
                  onMappingComplete={handleMappingComplete}
                  onBack={() => setStep(1)}
                />
              </div>
            )
          )}

          {step === 3 && validationReport && (
            <ValidationPanel
              report={validationReport}
              onProceed={handleProceed}
              onBack={() => setStep(2)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
