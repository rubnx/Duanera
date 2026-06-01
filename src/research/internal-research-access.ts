export function isInternalResearchEnabled() {
  return (
    process.env.DUANERA_ENABLE_INTERNAL_RESEARCH === "true" ||
    process.env.NODE_ENV === "development"
  );
}
