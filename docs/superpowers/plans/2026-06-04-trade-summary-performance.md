# Trade Summary Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Explorer usable as loaded Aduana months grow by bounding expensive broad summary/ranking work before loading more historical data.

**Architecture:** Keep list/count/search data server-rendered and preserve the existing trade query layer. Do not add schema unless the no-schema bounded path fails. Exact-month and narrowed searches keep full summaries; un-narrowed multi-month searches return a bounded summary with record count and an explicit performance reason instead of scanning every metric/ranking.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle, Neon Postgres, existing trade search services.

---

### Task 1: Add Summary Bounding Logic

**Files:**
- Modify: `src/trade/trade-record-analytics.ts`
- Modify: `src/trade/trade-record-search.ts`
- Test: `scripts/inspect/trade-record-search.test.ts`

- [ ] Add a `status` and optional `skippedReason` to `TradeRecordIntelligenceSummary`.
- [ ] Add `emptyTradeRecordSummary(totalRecords, skippedReason)` so broad searches can preserve record count without fake metric totals.
- [ ] Add `shouldSkipTradeRecordSummary(filters)` for un-narrowed multi-month searches only.
- [ ] Update `searchTradeRecords` so it runs the list first when summary must be bounded, then returns the empty bounded summary and skips the expensive summary/comparison queries.

### Task 2: Surface Bounded Summary State

**Files:**
- Modify: `src/app/explorer/page.tsx`

- [ ] Show a compact notice when `result.summary.status === "bounded"`.
- [ ] Keep the records count visible.
- [ ] Hide or soften value/ranking surfaces that would otherwise imply missing metrics are real zero values.

### Task 3: Validate

**Commands:**
- `npm run test:trade-search`
- `npm run typecheck`

**Smoke checks:**
- Exact `2026-04` still returns a complete summary.
- Exact `2025-12` still returns a complete summary.
- Broad `2025-12` through `2026-04` returns quickly with bounded summary status.
- Narrowed broad HS/country query still returns a complete summary.
- `/explorer` still defaults to `2026-04`; `2025-12` remains selectable.
