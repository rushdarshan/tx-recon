# Transaction Reconciliation Engine

## Overview

Ingests user-exported and exchange-exported crypto transactions, matches them using configurable tolerances, and produces a reconciliation report with matched, conflicting, and unmatched entries.

## Prerequisites

- **Node.js 20+**
- **MongoDB** running locally (or set `MONGO_URI`)

## Quick start

```bash
npm install
npm run build
npm start
```

The server listens on port **3000** by default (override with `PORT`).

## Run reconciliation

Trigger a reconciliation run and get a run ID plus summary counts.

```json
POST /reconcile
{
  "timestampToleranceSeconds": 300,
  "quantityTolerancePct": 0.01
}
```

```json
{
  "data": {
    "runId": "uuid",
    "summary": {
      "matched": 23,
      "conflicting": 1,
      "unmatchedUser": 3,
      "unmatchedExchange": 2
    }
  }
}
```

## Fetch reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/report/:runId` | Download full CSV report |
| `GET` | `/report/:runId/summary` | JSON summary counts |
| `GET` | `/report/:runId/unmatched` | JSON list of unmatched rows |

Example summary response:

```json
{
  "data": {
    "runId": "uuid",
    "summary": {
      "matched": 23,
      "conflicting": 1,
      "unmatchedUser": 3,
      "unmatchedExchange": 2
    },
    "config": {
      "timestampToleranceSeconds": 300,
      "quantityTolerancePct": 0.01
    }
  }
}
```

## Configuration

Tolerances can be set in the request body, environment variables, or the default config file (env overrides the file, request overrides env).

| Parameter | Default | Env variable |
|-----------|---------|-------------|
| `timestampToleranceSeconds` | 300 | `TIMESTAMP_TOLERANCE_SECONDS` |
| `quantityTolerancePct` | 0.01 | `QUANTITY_TOLERANCE_PCT` |

Other common environment variables: `PORT`, `MONGO_URI`.

## Matching rules

- **Timestamp tolerance** and **quantity tolerance** are applied first.
- **Type mapping** supports `TRANSFER_IN` ↔ `TRANSFER_OUT`.
- **Asset aliases** map common names (e.g., bitcoin → BTC).
- **Conflicts** are “near misses” that exceed base tolerances but match under relaxed criteria.

## Data quality handling

Bad rows are **not dropped**. Issues like malformed timestamps, missing types, negative quantities, and duplicates are flagged and logged, and the rows still participate in reconciliation.

## API response format

Successful JSON responses:

```json
{ "data": { "..." : "..." } }
```

Error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "timestampToleranceSeconds", "message": "Must be a positive number" }
    ]
  }
}
```

## Running tests

```bash
npm test
```

Integration tests use an in-memory MongoDB instance — no external DB needed.

## Troubleshooting

- **MongoDB connection errors:** ensure MongoDB is running or set `MONGO_URI`.
- **Port already in use:** set `PORT` to a free port.
- **Unexpected CSV parsing issues:** ensure the input CSVs have the expected header columns and UTF‑8 compatible encoding.
