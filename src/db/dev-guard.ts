const DEV_TARGET = "dev";

export function assertDevDatabaseTarget(scriptName: string): void {
  if (process.env.DUANERA_DB_TARGET !== DEV_TARGET) {
    throw new Error(
      `${scriptName} mutates data and must only run with DUANERA_DB_TARGET=${DEV_TARGET}.`,
    );
  }
}
