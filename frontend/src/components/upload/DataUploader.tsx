import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/shared";

interface DataUploaderProps {
  onFileAccepted: (file: File) => void;
}

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES: Record<string, string[]> = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};

export default function DataUploader({ onFileAccepted }: DataUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: readonly { readonly file: File; readonly errors: readonly { message: string }[] }[]) => {
      setError(null);
      if (rejected.length > 0) {
        const first = rejected[0];
        if (first) {
          const msg = first.errors[0]?.message ?? "Invalid file";
          if (msg.includes("larger")) {
            setError("File exceeds 50MB limit");
          } else {
            setError("Please upload a CSV or Excel file (.csv, .xlsx)");
          }
        }
        return;
      }
      const f = accepted[0];
      if (f) {
        setFile(f);
      }
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    multiple: false,
  });

  function handleClear() {
    setFile(null);
    setError(null);
  }

  function handleContinue() {
    if (file) onFileAccepted(file);
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors",
            isDragActive
              ? "border-brand-400 bg-brand-50"
              : "border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50",
          )}
          aria-label="Upload data file - drag and drop or click to browse"
        >
          <input {...getInputProps()} />
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm">
            <Upload className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? "Drop your file here" : "Drag & drop your data file"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            CSV or Excel (.csv, .xlsx) up to 50MB
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Browse files
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2.5">
              <FileSpreadsheet className="h-6 w-6 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {file.name}
              </p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleClear}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleContinue}>
              Continue to Column Mapping
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
