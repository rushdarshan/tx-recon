# Transaction Reconciliation Engine

Ingests two CSV sources of crypto transaction data (user-exported and exchange-exported), matches transactions across them using configurable tolerances, and produces a structured reconciliation report.

## Setup

```bash
npm install
npm run build
```

## Usage

### Start the server

```bash
npm start
```

Server listens on port 3000 by default (configurable via `PORT` env variable).

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/reconcile` | Trigger reconciliation. Accepts optional config overrides in body. |
| `GET` | `/report/:runId` | Download full CSV report. |
| `GET` | `/report/:runId/summary` | JSON summary counts. |
| `GET` | `/report/:runId/unmatched` | JSON list of unmatched rows. |

### Reconcile request

```json
POST /reconcile
{
  "timestampToleranceSeconds": 300,
  "quantityTolerancePct": 0.01
}
```

Returns:
```json
{
  "runId": "uuid",
  "summary": {
    "matched": 23,
    "conflicting": 0,
    "unmatchedUser": 3,
    "unmatchedExchange": 2
  }
}
```

### Configuration

Tolerances are configurable via three mechanisms (request body overrides env, which overrides file):

| Parameter | Default | Env variable |
|-----------|---------|-------------|
| `timestampToleranceSeconds` | 300 | `TIMESTAMP_TOLERANCE_SECONDS` |
| `quantityTolerancePct` | 0.01 | `QUANTITY_TOLERANCE_PCT` |

Other config in `config/default.json`: `port`, `mongoUri`, `userCsvPath`, `exchangeCsvPath`.

### Prerequisites

- **Node.js 20+**
- **MongoDB** running locally on port 27017 (or set `MONGO_URI` env)
- Sample CSVs (`user_transactions.csv`, `exchange_transactions.csv`) at repo root

## Running tests

```bash
npm test
```

Uses `mongodb-memory-server` for integration tests — no external MongoDB needed.

## Key Design Decisions

### TypeScript over JavaScript

Type safety catches field mismatches between two data sources with subtly different schemas.

### N-pass greedy matching

Five passes with progressively relaxed criteria:

| Pass | Criteria |
|------|----------|
| Pass 1 | Exact match on all fields (asset, type, quantity, timestamp ± tolerance) |
| Pass 2 | Relax quantity tolerance 10× |
| Pass 3 | Apply type mapping: `TRANSFER_IN` ↔ `TRANSFER_OUT` |
| Pass 4 | Resolve asset aliases (`bitcoin` → `BTC`) |
| Pass 5 | Max tolerance (3× timestamp, 50× quantity) |

### Data quality: flag, don't drop

All rows are ingested regardless of quality issues. Malformed timestamps, negative quantities, missing types, and duplicates are flagged with a reason and still passed through the matching engine. This preserves auditability — no silent drops.

### Duplicate handling

Duplicate rows (e.g., USR-001 appearing twice) are ingested independently. The first occurrence matches normally; the second becomes "Unmatched (User)" with a reason indicating it's a duplicate.

### Asset aliasing

Common aliases (`bitcoin` → `BTC`, `ethereum` → `ETH`) are resolved case-insensitively. The alias map is in `src/matching/typeMappings.ts` and can be extended without code changes.

### Embedded report storage

Match results are embedded within each `ReconciliationRun` document. This avoids collection joins for CSV generation and summary queries. If result sets grow beyond ~10k rows per run, migrating to a separate collection is straightforward.

## Project structure

```
├── src/
│   ├── config/          # Config loader (file → env → override)
│   ├── db/
│   │   ├── connection.ts
│   │   └── models/      # Mongoose schemas
│   ├── ingest/          # CSV parsing + data quality detection
│   ├── matching/        # N-pass greedy matching engine
│   ├── report/          # CSV generation + summary computation
│   ├── api/             # Express routes
│   └── index.ts         # Server entry point
├── tests/
│   ├── unit/            # Unit tests per module
│   └── integration/     # Full pipeline tests with real CSVs
├── user_transactions.csv
├── exchange_transactions.csv
└── config/default.json
```
