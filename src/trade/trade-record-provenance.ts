export function formatPayloadRetentionMode(value: string) {
  const labels: Record<string, string> = {
    full_postgres: "Completo en Postgres",
    errors_and_warnings: "Solo errores y advertencias",
    pruned_after_normalization: "Podado después de normalizar",
  };

  return labels[value] ?? value;
}

export function formatPayloadRetainedReason(value: string | null) {
  if (!value) {
    return "No informado";
  }

  const labels: Record<string, string> = {
    existing_full_postgres_payload: "Payload completo retenido de carga existente",
    parse_error: "Retenido por error de parseo",
    parse_warning: "Retenido por advertencia de parseo",
    pending_post_normalization_prune: "Pendiente de poda posterior a normalización",
    pruned_after_normalization: "Podado después de normalizar",
  };

  return labels[value] ?? value;
}

export function formatPayloadStorageKind(value: string) {
  const labels: Record<string, string> = {
    object_storage: "Almacenamiento externo",
    postgres: "Postgres",
  };

  return labels[value] ?? value;
}

export function formatBoolean(value: boolean) {
  return value ? "Sí" : "No";
}
