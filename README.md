# Incidents Dashboard + Rerun Flow

This repository contains a runnable baseline implementation for an incident dashboard:

- list/table of recent runs with status and filters,
- failed run detail view with plain-language root cause and technical detail,
- ordered "How to fix" steps with links,
- rerun action for failed runs with duplicate-rerun protection,
- near real-time status updates using SSE.

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## API surface

- `GET /api/incidents`
- `GET /api/incidents/:runId`
- `POST /api/runs/:runId/rerun`
- `GET /api/runs/:runId/events`

## Tests

```bash
npm test
```

