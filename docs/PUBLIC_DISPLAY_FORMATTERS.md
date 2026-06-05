# Public Display Formatters

## Purpose

Duanera keeps Aduana/source data unchanged. Public display formatters only make source text easier to read in the app, exports, and reports.

These formatters must work for past and future data loads. Do not add rules only because they appear in the current loaded sample.

## Formatter Types

Use the narrowest formatter that matches the field.

| Field type | Formatter | Where rules live |
| --- | --- | --- |
| Product descriptions and normal source prose | `cleanPublicText` | `src/text/public-text.ts` |
| Descriptor, brand, model-like product attributes | `cleanPublicDescriptorText` | `src/text/public-text.ts` |
| Countries, ports, Aduanas, transport labels, code-table labels | `cleanPublicReferenceLabel` | `src/text/reference-labels.ts` |
| Search terms and stored product search text | `normalizePublicSearchText` / `publicSearchTerms` | `src/text/public-text.ts` |

## Rules

- Do not rewrite stored records.
- Do not change raw Aduana/source values.
- Do not change schema for display cleanup.
- Do not make importer/exporter identity claims.
- Keep search accent-insensitive.
- Keep product, descriptor, reference, and search formatters separate.
- Add tests before adding broad cleanup rules.

## Where To Add Future Rules

- Add product prose accents and safe source text repairs in `src/text/public-text.ts`.
- Add descriptor or brand/model preservation rules in `src/text/public-text.ts`, inside the descriptor formatter path.
- Add country, port, Aduana, transport, and code-table label rules in `src/text/reference-labels.ts`.
- Add search token behavior only in `normalizePublicSearchText` or `publicSearchTerms`.

If a rule cannot be explained as broad and safe for future data, do not add it yet.

## Required Checks

When changing formatter behavior, run:

```bash
npm run test:public-display-formatters
npm run test:trade-record-display
npm run test:trade-record-format
npm run test:trade-search
npm run typecheck
```
