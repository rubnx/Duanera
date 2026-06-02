import type { DataQualityStatus } from "@/quality/data-quality";

const dataQualityStatusLabels: Record<DataQualityStatus, string> = {
  ok: "Confiable",
  review: "Revisar",
  warning: "Riesgo",
};

const dataQualityStatusClasses: Record<DataQualityStatus, string> = {
  ok: "border-emerald-600/30 bg-emerald-50 text-emerald-900",
  review: "border-amber-600/30 bg-amber-50 text-amber-900",
  warning: "border-red-600/30 bg-red-50 text-red-900",
};

export function dataQualityStatusLabel(value: DataQualityStatus): string {
  return dataQualityStatusLabels[value];
}

export function dataQualityStatusClassName(value: DataQualityStatus): string {
  return dataQualityStatusClasses[value];
}

export function DataQualityStatusBadge({ status }: { status: DataQualityStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dataQualityStatusClassName(status)}`}
    >
      {dataQualityStatusLabel(status)}
    </span>
  );
}
