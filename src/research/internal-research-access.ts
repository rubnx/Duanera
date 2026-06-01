export function isInternalToolsEnabled() {
  return (
    process.env.DUANERA_ENABLE_INTERNAL_RESEARCH === "true" ||
    process.env.NODE_ENV === "development"
  );
}

export function isInternalResearchEnabled() {
  return isInternalToolsEnabled();
}
