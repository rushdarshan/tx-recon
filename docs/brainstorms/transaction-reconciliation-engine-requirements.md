# Transaction Reconciliation Engine — Requirements

**Date:** 2026-05-24
**Status:** Draft
**Scope:** Standard

## Problem

Crypto users export transaction history from exchanges and maintain their own records. These two views of the same activity systematically diverge — timestamps drift by seconds, asset names use different conventions, quantities round differently, and transfer directions invert based on perspective. Manual reconciliation is error-prone and does not scale.

## Users

- **Primary:** Crypto investors who self-report or import transactions from multiple sources and need an auditable, single source of truth for tax reporting or portfolio tracking.
- **Secondary:** Internal operations at KoinX who need to validate data pipelines against exchange exports.

## Goals

1. Ingest two CSV sources without silently dropping bad data — flag quality issues with a reason
2. Match transactions across sources using configurable tolerances for timestamp, quantity, type, and asset
3. Produce a structured report with four categories: Matched, Conflicting, Unmatched (User), Unmatched (Exchange)
4. Expose the reconciliation engine via REST API with run tracking and configurable tolerance overrides

## Non-Goals

- Real-time / streaming reconciliation — batch only
- Auto-correction of data quality issues — flagged only, user decides
- Support for non-CSV sources in v1 (API ingestion deferred)
- Multi-account or multi-exchange aggregation
- Frontend UI — API-only; CSV report is the output format

## Product Decisions

### Duplicate Handling (USR-001 appearing twice)

Both copies of a duplicate row flow into matching independently. The matching engine may pair both with the same exchange transaction — the first becomes Matched, the second becomes Conflicting (duplicate matched to same exchange row). No special duplicate-dedup logic at ingest.

### Data Quality Approach

All rows are ingested regardless of quality issues. Each issue is logged with a specific reason. Malformed timestamps, negative quantities, missing types, and asset aliases all pass through to matching — the engine attempts to match with whatever data is available. Quality flags are stored alongside the transaction record and surfaced in the report.

### Matching Algorithm — N-Pass Greedy

A multi-pass approach where each pass tries progressively looser criteria. Once a pair is matched, both transactions are consumed and excluded from subsequent passes.

| Pass | Criteria |
|---|---|
| 1 | Exact match on (asset, type, quantity, timestamp ± tolerance) |
| 2 | Relax quantity tolerance (wider window) |
| 3 | Apply type mapping: `TRANSFER_IN` ↔ `TRANSFER_OUT` |
| 4 | Apply asset alias resolution (e.g., `bitcoin` → `BTC`) |
| 5 | Residual — all remaining tolerances relaxed to max |

When multiple candidates exist for a transaction, prefer the closest timestamp match.

### Type Mapping

| Exchange | User |
|---|---|
| `TRANSFER_IN` | `TRANSFER_OUT` |
| `TRANSFER_OUT` | `TRANSFER_IN` |

BUY/SELL must match exactly on both sides.

### Asset Alias Resolution

| Alias | Canonical |
|---|---|
| `bitcoin` | `BTC` |
| `ethereum` | `ETH` |
| Case-insensitive comparison on all assets |

Alias map should be configurable (extensible via config file or env).

### Report Columns (Flat Merged View)

Each row in the output CSV contains all applicable fields from both sides:

`category, reason, user_tx_id, exchange_tx_id, user_timestamp, exchange_timestamp, asset, type, user_quantity, exchange_quantity, user_price_usd, exchange_price_usd, user_fee, exchange_fee, user_note, exchange_note`

Fields are null where not applicable (e.g., exchange fields null for unmatched user rows).

### Configurable Tolerances

| Parameter | Default | Applied in Matching |
|---|---|---|
| `TIMESTAMP_TOLERANCE_SECONDS` | 300 (5 min) | Pass 1, expanded in Pass 5 |
| `QUANTITY_TOLERANCE_PCT` | 0.01 | Pass 1, expanded in Pass 2 |

Support via: environment variables, optional JSON config file, and request body on `POST /reconcile` (request body overrides both).

## Edge Cases (from sample data)

| Issue | Handling |
|---|---|
| Duplicate row (USR-001 ×2) | Both ingested; second instance becomes Conflicting |
| Asset alias (`bitcoin` → `BTC`) | Resolved in Pass 4 alias map |
| Type perspective flip (TRANSFER_OUT → TRANSFER_IN) | Resolved in Pass 3 type mapping |
| Malformed timestamp (USR-018: `2024-03-09T`) | Flagged on ingest; timestamp treated as null, matching falls back to other fields |
| Negative quantity (USR-019: -0.1 BTC) | Flagged on ingest; matched by other fields if possible |
| Missing type (USR-024) | Flagged on ingest; null type cannot match — becomes Unmatched (User) |
| Quantity outside tolerance (USR-012: 0.3 vs EXC-1012: 0.3001) | Beyond default 0.01% tolerance → Conflicting |
| Fee mismatch (USR-010: 0.0015 vs EXC-1010: 0.002) | Fee not a matching criterion; row may still be Matched if other fields align |
| Exchange-only rows (EXC-1024, EXC-1025) | Unmatched (Exchange) with reason |

## API Surface

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/reconcile` | Trigger a reconciliation run. Accepts optional `{ timestampToleranceSeconds, quantityTolerancePct }` in body to override defaults. Returns `runId`. |
| `GET` | `/report/:runId` | Full reconciliation report (CSV download). |
| `GET` | `/report/:runId/summary` | Counts: matched, conflicting, unmatchedUser, unmatchedExchange. |
| `GET` | `/report/:runId/unmatched` | Only unmatched rows from both sides, with reasons. |

## Data Ingestion — Quality Flags

Every row receives a quality assessment on ingest. Known issues to detect and flag:

- Malformed timestamp (unparseable ISO 8601)
- Missing timestamp
- Missing type
- Unknown type (not BUY/SELL/TRANSFER_IN/TRANSFER_OUT)
- Negative quantity or quantity = 0
- Missing quantity
- Duplicate transaction_id within same source

## Success Criteria

1. All rows from both CSVs are accounted for in the report (no silent drops)
2. Every row has exactly one category: Matched, Conflicting, Unmatched (User), or Unmatched (Exchange)
3. Data quality flags are reproducible and explainable per row
4. Running the same configuration twice produces identical results
5. Adjusting tolerances on `/reconcile` changes match outcomes as expected
6. All four report endpoints return correct, internally consistent data

## Open Questions / Deferred to Planning

- **Database**: MongoDB preferred per spec; schema design deferred
- **Framework**: Express vs Fastify vs bare Node.js HTTP
- **CSV parsing library**: csv-parse vs papaparse vs custom
- **Testing strategy**: unit vs integration, test data fixtures
- **Deployment**: Docker vs bare metal, CI/CD
- **Report generation**: streaming writer vs in-memory aggregation
