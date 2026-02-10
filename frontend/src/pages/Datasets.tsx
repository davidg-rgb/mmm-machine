import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Upload, Trash2, FileSpreadsheet, Calendar, Hash } from "lucide-react";
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
import { useDatasets, useDeleteDataset } from "@/hooks/api-hooks";
import { getStatusBadgeVariant } from "@/lib/utils";
import type { Dataset } from "@/types";

export default function Datasets() {
  usePageTitle("Datasets");
  const { data: datasets, isLoading } = useDatasets();
  const deleteDataset = useDeleteDataset();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const list: Dataset[] = datasets ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Datasets</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your uploaded marketing datasets</p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="h-4 w-4" />
            Upload New
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">No datasets yet</p>
              <p className="text-xs text-gray-400">Upload your first marketing dataset to get started</p>
              <Link to="/upload">
                <Button variant="outline" size="sm" className="mt-4">
                  <Upload className="h-4 w-4" />
                  Upload Dataset
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {list.map((ds) => (
                <div key={ds.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                    <FileSpreadsheet className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{ds.filename}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {ds.row_count && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {ds.row_count} rows
                        </span>
                      )}
                      {ds.date_range_start && ds.date_range_end && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {ds.date_range_start} to {ds.date_range_end}
                        </span>
                      )}
                      {ds.frequency && <span>{ds.frequency}</span>}
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(ds.status)}>{ds.status}</Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => setDeleteConfirmId(ds.id)}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Delete dataset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Delete Dataset</ModalTitle>
          </ModalHeader>
          <div className="p-4">
            <p className="text-sm text-gray-600">
              Are you sure? This will permanently delete this dataset and its S3 file.
              Model runs using this dataset will NOT be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (deleteConfirmId) {
                    deleteDataset.mutate(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
