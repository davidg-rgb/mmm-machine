import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared";
import DataUploader from "@/components/upload/DataUploader";
import DataPreview from "@/components/upload/DataPreview";
import ColumnMapper from "@/components/upload/ColumnMapper";
import ValidationPanel from "@/components/upload/ValidationPanel";
import type { ColumnMapping } from "@/types";
import {
  mockCsvHeaders,
  mockCsvRows,
  mockValidationReport,
} from "@/services/mock-data";

type WizardStep = 1 | 2 | 3;

const stepLabels: Record<WizardStep, string> = {
  1: "Upload File",
  2: "Map Columns",
  3: "Validate",
};

export default function Upload() {
  const [step, setStep] = useState<WizardStep>(1);
  const [_file, setFile] = useState<File | null>(null);
  const [_mapping, setMapping] = useState<ColumnMapping | null>(null);
  const navigate = useNavigate();

  function handleFileAccepted(file: File) {
    setFile(file);
    setStep(2);
  }

  function handleMappingComplete(mapping: ColumnMapping) {
    setMapping(mapping);
    setStep(3);
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
          {step === 1 && <DataUploader onFileAccepted={handleFileAccepted} />}

          {step === 2 && (
            <div className="space-y-5">
              <DataPreview headers={mockCsvHeaders} rows={mockCsvRows} />
              <ColumnMapper
                headers={mockCsvHeaders}
                onMappingComplete={handleMappingComplete}
                onBack={() => setStep(1)}
              />
            </div>
          )}

          {step === 3 && (
            <ValidationPanel
              report={mockValidationReport}
              onProceed={handleProceed}
              onBack={() => setStep(2)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
