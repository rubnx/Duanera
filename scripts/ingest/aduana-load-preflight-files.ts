import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";

import { resolvePreflightDataPath } from "./aduana-load-preflight-candidates";
import { check } from "./aduana-load-preflight-checks";
import type {
  AduanaPreflightCandidate,
  AduanaPreflightCheck,
} from "./aduana-load-preflight";

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function fileChecks(
  candidate: AduanaPreflightCandidate,
  verifyChecksums: boolean,
): Promise<AduanaPreflightCheck[]> {
  const checks: AduanaPreflightCheck[] = [];
  const workingPath = resolvePreflightDataPath(candidate.workingPath);
  if (!existsSync(workingPath)) {
    return [
      check(
        "blocker",
        "working_file_exists",
        "Archivo working",
        "El archivo working no existe en el archivo local data/.",
      ),
    ];
  }

  const workingStat = statSync(workingPath);
  checks.push(
    check(
      "compatible",
      "working_file_exists",
      "Archivo working",
      `Existe y pesa ${workingStat.size} bytes.`,
    ),
  );

  if (candidate.workingFileSize !== null && candidate.workingFileSize !== workingStat.size) {
    checks.push(
      check(
        "blocker",
        "working_file_size",
        "Tamaño working",
        `El manifiesto declara ${candidate.workingFileSize} bytes, pero el archivo local pesa ${workingStat.size}.`,
      ),
    );
  }

  if (candidate.rawPath) {
    const rawPath = resolvePreflightDataPath(candidate.rawPath);
    if (!existsSync(rawPath)) {
      checks.push(
        check("blocker", "raw_file_exists", "Archivo raw", "El archivo raw declarado no existe en data/."),
      );
    } else {
      const rawStat = statSync(rawPath);
      const status =
        candidate.rawFileSize !== null && candidate.rawFileSize !== rawStat.size ? "blocker" : "compatible";
      checks.push(
        check(
          status,
          "raw_file_size",
          "Tamaño raw",
          status === "compatible"
            ? `El archivo raw existe y pesa ${rawStat.size} bytes.`
            : `El manifiesto declara ${candidate.rawFileSize} bytes, pero el raw local pesa ${rawStat.size}.`,
        ),
      );
    }
  } else {
    checks.push(
      check(
        "warning",
        "raw_file_declared",
        "Archivo raw",
        "No hay raw_path de manifiesto; confirmar preservación oficial antes de cargar.",
      ),
    );
  }

  if (verifyChecksums && candidate.workingChecksumSha256) {
    const actual = await sha256File(workingPath);
    checks.push(
      check(
        actual === candidate.workingChecksumSha256 ? "compatible" : "blocker",
        "working_checksum",
        "Checksum working",
        actual === candidate.workingChecksumSha256
          ? "SHA-256 working coincide con el manifiesto."
          : `SHA-256 working no coincide. Manifest=${candidate.workingChecksumSha256}; local=${actual}.`,
      ),
    );
  } else if (candidate.source === "manifest") {
    checks.push(
      check(
        "warning",
        "working_checksum",
        "Checksum working",
        "No hay checksum working verificable en el manifiesto o fue omitido por --skip-checksums.",
      ),
    );
  }

  if (verifyChecksums && candidate.rawPath && candidate.rawChecksumSha256 && existsSync(resolvePreflightDataPath(candidate.rawPath))) {
    const actual = await sha256File(resolvePreflightDataPath(candidate.rawPath));
    checks.push(
      check(
        actual === candidate.rawChecksumSha256 ? "compatible" : "blocker",
        "raw_checksum",
        "Checksum raw",
        actual === candidate.rawChecksumSha256
          ? "SHA-256 raw coincide con el manifiesto."
          : `SHA-256 raw no coincide. Manifest=${candidate.rawChecksumSha256}; local=${actual}.`,
      ),
    );
  }

  return checks;
}
