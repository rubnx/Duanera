# Chile Aduana Parse Failure Audit: 2025-01 through 2025-05

Date: 2026-06-05

## Summary

The retained parse failures from the completed 2025-01 through 2025-05 Chile Aduana backfill are not critical for current product-facing use.

The five-month batch contains 2,450,515 raw rows. Of those, 2,450,443 parsed and normalized successfully, and 72 failed field-count validation. The overall failure rate is 0.00294%.

Every failed row still has retained raw payloads with `payload_retained_reason = parse_error`. No failed row was silently dropped.

Recommendation: proceed to `2024-12` with the same one-month-at-a-time gates. Do not implement parser recovery before `2024-12`, but continue tracking these failure patterns.

## Failure Counts

| Period | Parsed rows | Failed rows | Failure rate |
| --- | ---: | ---: | ---: |
| 2025-01 | 510,462 | 54 | 0.01058% |
| 2025-02 | 453,390 | 6 | 0.00132% |
| 2025-03 | 486,829 | 0 | 0.00000% |
| 2025-04 | 503,656 | 8 | 0.00159% |
| 2025-05 | 496,106 | 4 | 0.00081% |

Total: 2,450,443 parsed rows and 72 failed rows.

## Failure Patterns

### Export split-line segments

Affected periods:

- `2025-01`: 8 rows with 19 fields and 8 rows with 66 fields.
- `2025-02`: 3 rows with 19 fields and 3 rows with 66 fields.
- `2025-04`: 4 rows with 19 fields and 4 rows with 66 fields.
- `2025-05`: 2 rows with 19 fields and 2 rows with 66 fields.

Expected export layout: 84 fields.

These are adjacent failed export rows. A read-only reconstruction check showed that concatenating representative adjacent `19 + 66` segments parses into 84 fields. This strongly suggests official source lines split across physical file lines.

Current decision: retain as `parse_error`; do not recover automatically yet.

Future parser option: a conservative adjacent-row recovery path could be added later, but it must require:

- same source file,
- row `N` has 19 fields,
- row `N + 1` has 66 fields,
- concatenated raw text parses to exactly 84 fields,
- no overwrite of source raw payloads,
- explicit recovered-row provenance.

### January export 63-field records

Affected period:

- `2025-01`: 18 export rows with 63 fields instead of 84.

These are not the same as the adjacent `19 + 66` split-line pattern. The sampled rows look like short source records, often with product/service text, and are not obviously recoverable from the immediately adjacent row.

Current decision: retain as `parse_error`; do not recover automatically.

Future parser option: inspect older months for recurrence. If the same 63-field shape appears frequently, treat it as a possible alternate official export row shape and design a separate parser path only after mapping the 63 fields against official metadata.

### January import 135-137-field records

Affected period:

- `2025-01`: 4 import rows with 135 fields, 9 with 136 fields, and 7 with 137 fields.

Expected import layout: 178 fields.

These failures cluster in the later part of the January import file. Adjacent parsed rows remain valid, and the short records are not proven safe to reconstruct.

Current decision: retain as `parse_error`; do not recover automatically.

Future parser option: inspect recurrence in older months. If this appears materially in 2024, compare affected rows against official import metadata before attempting recovery.

## Product Impact

Product-facing Explorer trust is not materially affected.

Validation results:

- Normalized records equal parsed raw rows.
- Failed rows are the only rows without normalized `trade_records`.
- Failed rows retain raw payloads for audit.
- Duplicate raw trade record links: 0.
- Parsed rows missing normalized trade records: 0.
- Orphan trade records: 0.
- Source/import-batch mismatches: 0.
- Pending prune rows: 0.

The UI should continue to treat these as source/parser audit exceptions, not as normal records.

## Operational Recommendation

Proceed to `2024-12` as the next one-month historical backfill.

Continue to enforce:

- R2 archive verification before database load.
- `RAW_ROW_PAYLOAD_RETENTION=errors_and_warnings`.
- `RAW_TRADE_ROW_SOURCE_FILENAMES` for raw loading.
- `NORMALIZE_PERIOD=YYYY-MM` for normalization.
- `RAW_ROW_PRUNE_PERIOD=YYYY-MM` for pruning.
- Post-month provenance/integrity checks.

Stop before continuing unattended if a future month shows:

- failure rate materially above January 2025,
- a new unknown field-count pattern,
- non-retained failed payloads,
- normalized count not matching parsed raw count,
- any provenance/integrity mismatch.

## Reproduction

Run:

```bash
npm run inspect:aduana-parse-failures
```

Focused helper tests:

```bash
npm run test:aduana-parse-failures
```
