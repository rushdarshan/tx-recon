---
title: Transaction Reconciliation Engine
type: feat
status: active
date: 2026-05-24
origin: docs/brainstorms/transaction-reconciliation-engine-requirements.md
---

# Transaction Reconciliation Engine

## Overview

Build a Node.js reconciliation engine that ingests two CSV sources of crypto transaction data (user-exported and exchange-exported), matches transactions across them using configurable tolerances, and produces a structured CSV reconciliation report via REST API.

---

## Problem Frame

Crypto users and exchanges maintain separate records of the same activity. Timestamps drift by seconds, asset names differ (`BTC` vs `bitcoin`), quantities round differently, and transfer directions invert depending on perspective. Manual checking does not scale. This engine automates the comparison and flags every discrepancy with a reason so users can audit their transaction history.

---

## Requirements Trace

- R1. Parse both CSV files and store in MongoDB without silently dropping bad rows — flag data quality issues with a reason
- R2. Match transactions across sources using configurable tolerances for timestamp (±300s default), quantity (±0.01% default), type (with TRANSFER_IN↔TRANSFER_OUT mapping), and asset (case-insensitive with alias resolution)
- R3. Produce a reconciliation report CSV with four categories: Matched, Conflicting, Unmatched (User), Unmatched (Exchange)
- R4. Expose REST endpoints: POST `/reconcile`, GET `/report/:runId`, GET `/report/:runId/summary`, GET `/report/:runId/unmatched`
- R5. Matching tolerances must be configurable via env vars, config file, or request body on `/reconcile` (request body overrides all)

---

## Scope Boundaries

- Real-time or streaming reconciliation — batch only
- Non-CSV sources — v1 only accepts CSV; API ingestion deferred
- Auto-correction of data quality issues — flagged only, user decides
- Frontend UI — API-only; CSV report is the output format
- Multi-account or multi-exchange aggregation

---

## Context & Research

### Relevant Code and Patterns

Greenfield project — no existing code to follow. Architecture decisions documented below.

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20+ | Required by spec |
| Language | TypeScript | Production-grade, self-documenting types |
| API framework | Express | Most widely adopted, simple routing |
| Database | MongoDB via Mongoose | Preferenced by spec; flexible schema suits variable-quality data |
| CSV parsing | csv-parse | Streaming parser, handles edge cases well |
| Testing | Jest + ts-jest | Standard for TypeScript Node projects |

---

## Key Technical Decisions

- **TypeScript over JavaScript**: Type safety catches field mismatches early, critical when two data sources have subtly different schemas.
- **Mongoose over native driver**: Schema validation at the DB layer catches bad data during ingest, aligning with the "flag don't silently drop" requirement.
- **csv-parse over papaparse**: Streaming parser works well for large files; built-in quote/escape handling for messy CSV.
- **In-memory matching for v1**: For the dataset sizes described (hundreds to low thousands of rows), loading all records into memory during matching is simpler and faster than cursor-based streaming. If datasets grow to 100k+ rows, a streaming or chunked approach can replace the in-memory matching in a future iteration.
- **MongoDB aggregation for summaries**: Use MongoDB's built-in aggregation for summary counts rather than loading all results into Node.js memory.

---

## Open Questions

### Resolved During Planning

- **TypeScript vs JavaScript**: TypeScript — production-grade requirement makes the additional compile step worthwhile.
- **In-memory vs streaming matching**: In-memory for v1. The sample dataset has ~25 rows per side; matching is cheap.
- **Report storage format**: Each reconciliation run gets a dedicated results collection documenting every match decision, making individual lookup and resummarization efficient.

### Deferred to Implementation

- **Exact Mongoose schema field types**: Final field types (String vs enum for type, Decimal128 vs Number for quantity) depend on MongoDB version and precision requirements — resolve during U2.
- **CSV column mapping strategy**: Whether to use positional or header-based mapping — header-based is obvious but implementer should confirm with sample data edge cases (BOM, extra whitespace).
- **Error response format**: Status codes and error body shape for API endpoints — standardize during U5.

---

## Output Structure

```
.
├── src/
│   ├── config/
│   │   └── index.ts
│   ├── ingest/
│   │   ├── csvParser.ts
│   │   ├── qualityChecker.ts
│   │   └── index.ts
│   ├── matching/
│   │   ├── engine.ts
│   │   ├── comparator.ts
│   │   └── typeMappings.ts
│   ├── report/
│   │   ├── generator.ts
│   │   └── summary.ts
│   ├── api/
│   │   ├── server.ts
│   │   └── routes.ts
│   ├── db/
│   │   ├── connection.ts
│   │   └── models/
│   │       ├── Transaction.ts
│   │       └── ReconciliationRun.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   │   ├── csvParser.test.ts
│   │   ├── qualityChecker.test.ts
│   │   ├── comparator.test.ts
│   │   ├── engine.test.ts
│   │   └── reportGenerator.test.ts
│   └── integration/
│       └── reconciliation.test.ts
├── config/
│   └── default.json
├── user_transactions.csv
├── exchange_transactions.csv
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Implementation Units

- U1. **[Project Scaffolding]**

**Goal:** Initialize the Node.js TypeScript project with dependencies, config, and directory structure

**Requirements:** R4, R5

**Dependencies:** None

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `config/default.json`
- Create: `src/types/index.ts`

**Approach:**
- Initialize npm project with TypeScript, Express, Mongoose, csv-parse, dotenv, uuid dependencies
- Configure TypeScript with strict mode, ES2020 target, commonjs module
- Define shared types: `TransactionRow`, `Source`, `TransactionType`, `QualityFlag`, `MatchCategory`, `ReconciliationConfig`, `ReconciliationSummary`, `MatchResult`
- Create default config JSON with `timestampToleranceSeconds: 300` and `quantityTolerancePct: 0.01`
- Add `.gitignore` for node_modules, dist, .env, *.csv (but keep sample CSVs via explicit negation)

**Approach:**
- The config loader (`src/config/index.ts`) reads from three sources with descending priority: request body overrides > env vars > config/default.json
- Env var names: `TIMESTAMP_TOLERANCE_SECONDS`, `QUANTITY_TOLERANCE_PCT`

**Execution Note:** Implement config loading test-first to nail the override precedence

**Test scenarios:**
- Happy path: config loads defaults when no env vars set
- Edge case: env var overrides default JSON value
- Edge case: partial override — only one tolerance provided, other uses default
- Edge case: invalid env var values (negative numbers, non-numeric strings) produce clear error

**Verification:**
- `npm run build` produces no errors
- Config loader returns correct merged values for all three override levels

---

- U2. **[CSV Ingestion with Data Quality Detection]**

**Goal:** Parse both CSV files, detect and flag data quality issues, store all rows in MongoDB

**Requirements:** R1

**Dependencies:** U1

**Files:**
- Create: `src/db/connection.ts`
- Create: `src/db/models/Transaction.ts`
- Create: `src/ingest/csvParser.ts`
- Create: `src/ingest/qualityChecker.ts`
- Create: `src/ingest/index.ts`
- Test: `tests/unit/csvParser.test.ts`
- Test: `tests/unit/qualityChecker.test.ts`

**Approach:**
- Mongoose `Transaction` schema with two sub-objects (`userSource`, `exchangeSource`) and at least the source-agnostic fields: `transactionId`, `timestamp`, `type`, `asset`, `quantity`, `priceUsd`, `fee`, `note`, `qualityFlags` (array of `{ field, issue, severity }`), `source`, `ingestedAt`
- `csvParser.ts`: Read CSV with csv-parse, return array of raw row objects with header mapping. Handle BOM, extra whitespace in headers, quoted fields, and empty values
- `qualityChecker.ts`: Detect and return quality flags for each row:
  - Malformed timestamp (unparseable ISO 8601)
  - Missing timestamp
  - Missing type / unknown type (not BUY/SELL/TRANSFER_IN/TRANSFER_OUT)
  - Negative or zero quantity
  - Missing quantity
  - Duplicate `transaction_id` within same source (track seen IDs in a Set)
- `ingest/index.ts`: Orchestrate: read file → parse CSV → check quality → upsert into MongoDB. All rows stored even with quality flags

**Test scenarios:**
- Happy path: clean CSV row stores with empty qualityFlags array
- Edge case: USR-018 malformed timestamp (`2024-03-09T`) produces qualityFlag `{ field: "timestamp", issue: "malformed", severity: "warning" }`
- Edge case: USR-019 negative quantity produces qualityFlag
- Edge case: USR-024 missing type produces qualityFlag
- Edge case: USR-001 duplicate produces qualityFlag on second occurrence
- Error path: missing file produces descriptive error
- Error path: empty CSV produces zero rows stored, no crash

**Verification:**
- Running ingest against both sample CSVs produces 25 user rows + 25 exchange rows in MongoDB
- Each data quality scenario from the sample data produces the expected flag

---

- U3. **[Matching Engine]**

**Goal:** Implement the N-pass greedy matching algorithm that pairs transactions across sources

**Requirements:** R2

**Dependencies:** U2

**Files:**
- Create: `src/matching/comparator.ts`
- Create: `src/matching/typeMappings.ts`
- Create: `src/matching/engine.ts`
- Test: `tests/unit/comparator.test.ts`
- Test: `tests/unit/engine.test.ts`

**Approach:**
- `comparator.ts`: Pure functions for field-level comparison
  - `timestampsWithin(ts1, ts2, toleranceSec): boolean`
  - `quantitiesWithin(q1, q2, tolerancePct): boolean` — uses absolute difference divided by mean
  - `typesMatch(t1, t2, typeMap): boolean` — exact match or mapped equivalent
  - `assetsMatch(a1, a2, aliasMap): boolean` — case-insensitive, alias lookup
- `typeMappings.ts`: Define `TRANSFER_IN ↔ TRANSFER_OUT` mapping. Define asset alias map: `{ bitcoin: "BTC", ethereum: "ETH" }`. Both maps are externally configurable
- `engine.ts`: N-pass greedy matching
  1. Load all user and exchange transactions from DB for a given run
  2. For each pass (Pass 1–5 from the requirements doc), iterate unmatched user transactions and try to match against unmatched exchange transactions
  3. On match, record a `MatchResult` with category `"matched"`, reason (which pass), and store both side IDs
  4. Remove matched pairs from the unmatched pools
  5. After all passes, remaining unpaired rows get category `"unmatched_user"` or `"unmatched_exchange"`
  6. Rows matched but with key fields outside tolerance on later passes (or with fee/note differences flagged) get category `"conflicting"` — decision rule: if matched on a tolerance-relaxed pass (quantity or timestamp), categorize as conflicting with reason explaining which field exceeded default tolerance
  7. Store all results in ReconciliationRun's results sub-collection

**Execution note:** Implement comparator test-first. Engine can follow since it composes comparators.

**Test scenarios:**
- Happy path: exact match on all fields (USR-002 ↔ EXC-1002) returns matched on Pass 1
- Edge case: type mapping (USR-004 TRANSFER_OUT ↔ EXC-1004 TRANSFER_IN) matches on Pass 3
- Edge case: asset alias (USR-005 `bitcoin` ↔ EXC-1005 `BTC`) matches on Pass 4
- Edge case: duplicate user row (USR-001 ×2) — first matches EXC-1001 on Pass 1, second finds no available exchange match → becomes unmatched_user with reason "duplicate"
- Edge case: quantity outside tolerance (USR-012 0.3 vs EXC-1012 0.3001) → conflicting with reason "quantity difference 0.0333% exceeds 0.01% tolerance"
- Edge case: malformed timestamp row (USR-018) still attempts match → if type/asset/quantity align with EXC-1018, matches with quality flag note
- Edge case: missing type (USR-024) cannot match any exchange row → unmatched_user
- Error path: empty user list → all exchange rows unmatched_exchange
- Integration: running engine on full sample data produces exactly N matched pairs from the expected set

**Verification:**
- All expected match pairs from sample data are found
- Conflicting rows correctly identified with reasons
- Unmatched counts match manual inspection

---

- U4. **[Reconciliation Report Generation]**

**Goal:** Generate CSV report and summary from match results stored in MongoDB

**Requirements:** R3

**Dependencies:** U3

**Files:**
- Create: `src/report/generator.ts`
- Create: `src/report/summary.ts`
- Create: `src/db/models/ReconciliationRun.ts`
- Test: `tests/unit/reportGenerator.test.ts`

**Approach:**
- `ReconciliationRun` Mongoose schema: `runId` (UUID), `config` (embedded tolerances used), `status` (pending/running/completed/failed), `startedAt`, `completedAt`, `summary` (embedded: matchedCount, conflictingCount, unmatchedUserCount, unmatchedExchangeCount), `results` (array of embedded MatchResult documents)
  - Embedded results avoid separate collection joins; if results grow large (>10k), refactor to separate collection
  - Each MatchResult: `category`, `reason`, plus `userTxId`, `exchangeTxId`, and all report columns from the flat merged view
- `generator.ts`: Query all results for a run, stream CSV output with columns from the flat merged view: `category, reason, user_tx_id, exchange_tx_id, user_timestamp, exchange_timestamp, asset, type, user_quantity, exchange_quantity, user_price_usd, exchange_price_usd, user_fee, exchange_fee, user_note, exchange_note`
- `summary.ts`: Simple aggregation — count results by category for a run

**Test scenarios:**
- Happy path: report CSV has correct headers and row count matching results
- Edge case: run with zero matches — CSV has header row only (or "No results")
- Edge case: unmatched user row — exchange fields empty in CSV
- Edge case: conflicting row — all fields populated with both sides' data
- Summary returns correct counts matching manual tally

**Verification:**
- CSV output parses back to correct number of rows
- Summary counts reconcile with CSV row categories

---

- U5. **[REST API]**

**Goal:** Expose reconciliation engine via Express API endpoints

**Requirements:** R4, R5

**Dependencies:** U4

**Files:**
- Create: `src/api/server.ts`
- Create: `src/api/routes.ts`
- Create: `src/index.ts`
- Test: `tests/integration/reconciliation.test.ts`

**Approach:**
- `POST /reconcile`: Accept optional `{ timestampToleranceSeconds, quantityTolerancePct }` in body. Create ReconciliationRun with status=pending. Run ingestion (reads CSV file paths from config or env). Run matching engine with merged config. Generate report. Update run status=completed. Return `{ runId }`.
- `GET /report/:runId`: Query results for run, generate CSV on-the-fly, stream as `text/csv` response with `Content-Disposition: attachment`
- `GET /report/:runId/summary`: Return JSON `{ runId, matched, conflicting, unmatchedUser, unmatchedExchange, config }`
- `GET /report/:runId/unmatched`: Query only results where category is unmatched_user or unmatched_exchange, return JSON array
- Error handling: 404 for unknown runId, 400 for invalid config values, 500 for internal failures with structured error response
- Server setup: Express with JSON body parser, CORS enabled for local dev, port from `PORT` env var (default 3000)

**Execution note:** Start with integration test that POSTs to `/reconcile` and validates the full flow returns correct results from sample data.

**Test scenarios:**
- Integration: POST `/reconcile` with default config returns 200 with runId
- Integration: GET `/report/:runId` returns CSV with correct Content-Type and Content-Disposition
- Integration: GET `/report/:runId/summary` returns JSON with correct counts against known sample data
- Integration: GET `/report/:runId/unmatched` returns only unmatched rows
- Integration: POST `/reconcile` with override tolerances produces different match results
- Edge case: GET `/report/nonexistent-id` returns 404
- Edge case: POST `/reconcile` with negative tolerance returns 400
- Edge case: GET `/report/:runId` for a run that hasn't completed yet returns meaningful error

**Verification:**
- All endpoints return correct status codes and response bodies
- Full reconciliation pipeline completes end-to-end via HTTP

---

## System-Wide Impact

- **Error propagation:** Ingest failures (bad file paths, DB connection errors) propagate as 500 with structured error body. Matching failures are caught and stored as run status=failed with error reason.
- **State lifecycle:** `/reconcile` is synchronous for v1 — the response waits for completion. For large datasets, this should become async (return immediately, poll for status). Deferred.
- **Concurrent runs:** No locking in v1 — sequential runs create separate run documents. If runs overlap, they operate on the originally ingested data snapshot (ingest happens fresh each run).
- **Unchanged invariants:** Sample CSVs remain at repo root as test fixtures. README documents setup instructions.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| CSV format varies from expected columns | csv-parse with header mapping + validation; quality checker flags missing columns |
| MongoDB not available in CI | Use mongodb-memory-server for integration tests |
| Matching performance with large datasets | Monitored; streaming/chunked matching is a documented future iteration |
| Type mapping misses edge cases | Configurable maps; user can add mappings without code changes |

---

## Sources & References

- **Origin document:** `docs/brainstorms/transaction-reconciliation-engine-requirements.md`
- **Sample data:** `user_transactions.csv`, `exchange_transactions.csv` at repo root
