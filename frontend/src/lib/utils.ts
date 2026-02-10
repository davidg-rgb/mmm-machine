import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getStatusBadgeVariant(
  status: string,
): "success" | "warning" | "error" | "info" | "brand" | "default" {
  switch (status) {
    case "completed":
      return "success";
    case "fitting":
    case "preprocessing":
    case "postprocessing":
      return "brand";
    case "queued":
      return "info";
    case "failed":
      return "error";
    default:
      return "default";
  }
}
