import express from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RERUN_QUEUE_DELAY_MS = 1200;
const RERUN_FINAL_DELAY_MS = 4200;
const DEFAULT_PAGE_SIZE = 50;

const FIX_TEMPLATES = {
  artifact_missing: {
    rootCause: (run) =>
      `${run.component} could not find the required input artifact for this run.`,
    steps: (run) => [
      {
        order: 1,
        text: "Open Storage settings and verify bucket/path access for this workflow.",
        link: run.links.configUrl
      },
      {
        order: 2,
        text: "Restore or re-upload the missing file and confirm the object key exists.",
        link: null
      },
      {
        order: 3,
        text: "Return to this incident and click Rerun this run.",
        link: null
      }
    ],
    transientHint: null
  },
  auth_expired: {
    rootCause: () =>
      "Paperclip could not authenticate to an external integration because the token is expired.",
    steps: (run) => [
      {
        order: 1,
        text: "Go to Integrations settings.",
        link: run.links.configUrl
      },
      {
        order: 2,
        text: "Reconnect the integration to refresh credentials.",
        link: run.links.configUrl
      },
      {
        order: 3,
        text: "Run the incident again with the same inputs.",
        link: null
      }
    ],
    transientHint: null
  },
  rate_limit: {
    rootCause: (run) =>
      `${run.component} hit an upstream rate limit while processing this request.`,
    steps: (run) => [
      {
        order: 1,
        text: "Inspect provider usage and retry headers in logs.",
        link: run.links.logUrl
      },
      {
        order: 2,
        text: "If usage is high, reduce request burst or wait for quota reset.",
        link: null
      },
      {
        order: 3,
        text: "Click Rerun this run.",
        link: null
      }
    ],
    transientHint: "This is often transient. A rerun may succeed without config changes."
  },
  retired_workflow: {
    rootCause: () =>
      "The source workflow version has been retired and cannot be replayed as-is.",
    steps: (run) => [
      {
        order: 1,
        text: "Open workflow version history and select an active version.",
        link: run.links.configUrl
      },
      {
        order: 2,
        text: "Migrate the run inputs to the active version schema.",
        link: null
      },
      {
        order: 3,
        text: "Execute a new run from the active workflow.",
        link: null
      }
    ],
    transientHint: null
  },
  generic: {
    rootCause: (run) =>
      `${run.component} failed to complete the requested operation.`,
    steps: (run) => [
      {
        order: 1,
        text: "Review technical logs for this run.",
        link: run.links.logUrl
      },
      {
        order: 2,
        text: "Apply the corrective change in configuration or input data.",
        link: run.links.configUrl
      },
      {
        order: 3,
        text: "Rerun the workflow.",
        link: null
      }
    ],
    transientHint: null
  }
};

function minutesAgoToIso(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function seedRuns() {
  return [
    {
      runId: "run-ops-1001",
      status: "failed",
      workflowName: "Invoice OCR Pipeline",
      stepName: "Fetch PDF",
      component: "S3Reader",
      severity: "high",
      summary: "Could not download source PDF from object storage.",
      environment: "prod",
      requestId: "req-55391",
      userId: "user-411",
      createdAt: minutesAgoToIso(56),
      technical: {
        errorType: "NoSuchKeyError",
        component: "S3Reader",
        stackTraceRef: "trace://run-ops-1001",
        logUrl: "/logs/runs/run-ops-1001"
      },
      inputs: {
        bucket: "invoices-prod",
        key: "2026/03/missing-source.pdf",
        ocrProfile: "default",
        retryPolicy: "standard"
      },
      errorCategory: "artifact_missing",
      rerunBlockedReason: null,
      links: {
        configUrl: "/settings/integrations/storage",
        logUrl: "/logs/runs/run-ops-1001"
      }
    },
    {
      runId: "run-ops-1002",
      status: "failed",
      workflowName: "Google Drive Sync",
      stepName: "List Folder",
      component: "GoogleDriveConnector",
      severity: "medium",
      summary: "Integration token is no longer valid.",
      environment: "prod",
      requestId: "req-55384",
      userId: "user-221",
      createdAt: minutesAgoToIso(44),
      technical: {
        errorType: "OAuthTokenExpiredError",
        component: "GoogleDriveConnector",
        stackTraceRef: "trace://run-ops-1002",
        logUrl: "/logs/runs/run-ops-1002"
      },
      inputs: {
        folderId: "finance-q1",
        syncDepth: 2,
        includeArchived: false
      },
      errorCategory: "auth_expired",
      rerunBlockedReason: null,
      links: {
        configUrl: "/settings/integrations/google-drive",
        logUrl: "/logs/runs/run-ops-1002"
      }
    },
    {
      runId: "run-ops-1003",
      status: "failed",
      workflowName: "Model Summary Job",
      stepName: "Call LLM Provider",
      component: "OpenAIClient",
      severity: "medium",
      summary: "Upstream provider rate limit reached.",
      environment: "staging",
      requestId: "req-55377",
      userId: "user-090",
      createdAt: minutesAgoToIso(27),
      technical: {
        errorType: "RateLimitError",
        component: "OpenAIClient",
        stackTraceRef: "trace://run-ops-1003",
        logUrl: "/logs/runs/run-ops-1003"
      },
      inputs: {
        model: "gpt-5.4",
        promptTemplate: "daily-brief",
        maxTokens: 1200
      },
      errorCategory: "rate_limit",
      rerunBlockedReason: null,
      links: {
        configUrl: "/settings/models/openai",
        logUrl: "/logs/runs/run-ops-1003"
      }
    },
    {
      runId: "run-ops-1004",
      status: "running",
      workflowName: "Incident Digest",
      stepName: "Generate Summary",
      component: "DigestWorker",
      severity: "low",
      summary: "Incident digest is currently running.",
      environment: "prod",
      requestId: "req-55365",
      userId: "user-411",
      createdAt: minutesAgoToIso(10),
      technical: {
        errorType: null,
        component: "DigestWorker",
        stackTraceRef: null,
        logUrl: "/logs/runs/run-ops-1004"
      },
      inputs: {
        windowHours: 24,
        includeResolved: false
      },
      errorCategory: null,
      rerunBlockedReason: null,
      links: {
        configUrl: "/settings/workflows/incident-digest",
        logUrl: "/logs/runs/run-ops-1004"
      }
    },
    {
      runId: "run-ops-1005",
      status: "succeeded",
      workflowName: "Slack Alert Fanout",
      stepName: "Post Alerts",
      component: "SlackNotifier",
      severity: "low",
      summary: "Alerts delivered successfully.",
      environment: "prod",
      requestId: "req-55351",
      userId: "user-110",
      createdAt: minutesAgoToIso(70),
      technical: {
        errorType: null,
        component: "SlackNotifier",
        stackTraceRef: null,
        logUrl: "/logs/runs/run-ops-1005"
      },
      inputs: {
        channels: ["#ops-incidents", "#eng-triage"],
        maxBatch: 10
      },
      errorCategory: null,
      rerunBlockedReason: null,
      links: {
        configUrl: "/settings/integrations/slack",
        logUrl: "/logs/runs/run-ops-1005"
      }
    },
    {
      runId: "run-ops-1006",
      status: "failed",
      workflowName: "Legacy ETL Replay",
      stepName: "Replay Run",
      component: "WorkflowRunner",
      severity: "high",
      summary: "Workflow version has been retired.",
      environment: "prod",
      requestId: "req-55342",
      userId: "user-998",
      createdAt: minutesAgoToIso(82),
      technical: {
        errorType: "WorkflowVersionRetiredError",
        component: "WorkflowRunner",
        stackTraceRef: "trace://run-ops-1006",
        logUrl: "/logs/runs/run-ops-1006"
      },
      inputs: {
        workflowVersion: "v1",
        replayWindow: "2026-03-24T00:00:00Z/2026-03-25T00:00:00Z"
      },
      errorCategory: "retired_workflow",
      rerunBlockedReason: "This workflow version is retired. Migrate to an active version before replay.",
      links: {
        configUrl: "/settings/workflows/legacy-etl",
        logUrl: "/logs/runs/run-ops-1006"
      }
    }
  ];
}

function parseCsvFilter(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function redactPayload(payload) {
  const redactedKeys = ["token", "password", "secret", "apiKey", "authorization"];

  function recurse(value) {
    if (Array.isArray(value)) {
      return value.map(recurse);
    }

    if (value && typeof value === "object") {
      const clone = {};
      for (const [key, innerValue] of Object.entries(value)) {
        const shouldRedact = redactedKeys.some((token) =>
          key.toLowerCase().includes(token.toLowerCase())
        );
        clone[key] = shouldRedact ? "[redacted]" : recurse(innerValue);
      }
      return clone;
    }

    return value;
  }

  return recurse(payload ?? {});
}

function getRerunState(run, activeRerunByOriginal) {
  if (run.originalRunId) {
    return {
      eligible: false,
      disabledReason: "Rerun attempts cannot be rerun from this view.",
      activeRerunRunId: null
    };
  }

  if (run.status !== "failed") {
    return {
      eligible: false,
      disabledReason: "Only failed runs can be rerun.",
      activeRerunRunId: null
    };
  }

  const activeRerunRunId = activeRerunByOriginal.get(run.runId) ?? null;
  if (activeRerunRunId) {
    return {
      eligible: false,
      disabledReason: "A rerun is already in progress for this run.",
      activeRerunRunId
    };
  }

  if (!run.inputs || Object.keys(run.inputs).length === 0) {
    return {
      eligible: false,
      disabledReason: "Rerun disabled: required input payload is missing.",
      activeRerunRunId: null
    };
  }

  if (run.rerunBlockedReason) {
    return {
      eligible: false,
      disabledReason: run.rerunBlockedReason,
      activeRerunRunId: null
    };
  }

  return {
    eligible: true,
    disabledReason: null,
    activeRerunRunId: null
  };
}

function buildHowToFix(run) {
  const template = FIX_TEMPLATES[run.errorCategory] ?? FIX_TEMPLATES.generic;
  return {
    rootCause: template.rootCause(run),
    steps: template.steps(run),
    transientHint: template.transientHint
  };
}

function buildIncidentRow(run, activeRerunByOriginal) {
  return {
    runId: run.runId,
    status: run.status,
    workflowName: run.workflowName,
    stepName: run.stepName,
    component: run.component,
    severity: run.severity,
    summary: run.summary,
    environment: run.environment,
    requestId: run.requestId,
    userId: run.userId,
    createdAt: run.createdAt,
    rerun: getRerunState(run, activeRerunByOriginal)
  };
}

function buildIncidentDetail(run, activeRerunByOriginal) {
  return {
    runId: run.runId,
    status: run.status,
    summary: run.summary,
    technical: cloneJson(run.technical),
    context: {
      workflowName: run.workflowName,
      stepName: run.stepName,
      environment: run.environment,
      requestId: run.requestId,
      userId: run.userId,
      createdAt: run.createdAt
    },
    inputs: {
      payload: redactPayload(run.inputs),
      redactionPolicy: "Keys that resemble secrets or credentials are redacted."
    },
    howToFix: buildHowToFix(run),
    rerun: getRerunState(run, activeRerunByOriginal)
  };
}

function makeEvent(type, payload = {}) {
  return JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    ...payload
  });
}

export function createApp() {
  const app = express();
  app.use(express.json());

  const incidents = new Map(seedRuns().map((run) => [run.runId, run]));
  const activeRerunByOriginal = new Map();
  const streamClients = new Map();
  const timers = new Set();

  function schedule(fn, delayMs) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, delayMs);
    timers.add(timer);
  }

  function writeSse(runId, type, payload = {}) {
    const clients = streamClients.get(runId);
    if (!clients || clients.size === 0) {
      return;
    }

    const body = `data: ${makeEvent(type, payload)}\n\n`;
    for (const response of clients) {
      response.write(body);
    }
  }

  function registerClient(runId, response) {
    if (!streamClients.has(runId)) {
      streamClients.set(runId, new Set());
    }
    streamClients.get(runId).add(response);
  }

  function unregisterClient(runId, response) {
    const clients = streamClients.get(runId);
    if (!clients) {
      return;
    }
    clients.delete(response);
    if (clients.size === 0) {
      streamClients.delete(runId);
    }
  }

  function updateRunStatus(runId, patch, sourceRunId) {
    const run = incidents.get(runId);
    if (!run) {
      return;
    }

    Object.assign(run, patch);
    writeSse(runId, "status_update", {
      runId,
      status: run.status,
      summary: run.summary
    });

    if (sourceRunId) {
      writeSse(sourceRunId, "rerun_update", {
        sourceRunId,
        runId,
        status: run.status,
        summary: run.summary
      });
    }
  }

  function createRerunRun(sourceRun) {
    const newRunId = `run-rerun-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    incidents.set(newRunId, {
      runId: newRunId,
      originalRunId: sourceRun.runId,
      status: "queued",
      workflowName: sourceRun.workflowName,
      stepName: sourceRun.stepName,
      component: sourceRun.component,
      severity: "low",
      summary: `Rerun for ${sourceRun.runId} is queued.`,
      environment: sourceRun.environment,
      requestId: `req-${Math.floor(10000 + Math.random() * 89999)}`,
      userId: sourceRun.userId,
      createdAt: now,
      technical: {
        errorType: null,
        component: sourceRun.component,
        stackTraceRef: null,
        logUrl: `/logs/runs/${newRunId}`
      },
      inputs: cloneJson(sourceRun.inputs),
      errorCategory: null,
      rerunBlockedReason: null,
      links: {
        configUrl: sourceRun.links.configUrl,
        logUrl: `/logs/runs/${newRunId}`
      }
    });

    activeRerunByOriginal.set(sourceRun.runId, newRunId);
    writeSse(sourceRun.runId, "rerun_started", {
      sourceRunId: sourceRun.runId,
      runId: newRunId,
      status: "queued"
    });

    schedule(() => {
      updateRunStatus(
        newRunId,
        {
          status: "running",
          summary: `Rerun ${newRunId} is running.`
        },
        sourceRun.runId
      );
    }, RERUN_QUEUE_DELAY_MS);

    schedule(() => {
      const shouldFail =
        sourceRun.errorCategory === "artifact_missing" ||
        sourceRun.errorCategory === "retired_workflow";

      if (shouldFail) {
        updateRunStatus(
          newRunId,
          {
            status: "failed",
            severity: "high",
            summary: "Rerun failed because required artifacts are still unavailable.",
            technical: {
              errorType: "NoSuchKeyError",
              component: sourceRun.component,
              stackTraceRef: `trace://${newRunId}`,
              logUrl: `/logs/runs/${newRunId}`
            },
            errorCategory: "artifact_missing"
          },
          sourceRun.runId
        );
      } else {
        updateRunStatus(
          newRunId,
          {
            status: "succeeded",
            severity: "low",
            summary: "Rerun completed successfully.",
            technical: {
              errorType: null,
              component: sourceRun.component,
              stackTraceRef: null,
              logUrl: `/logs/runs/${newRunId}`
            },
            errorCategory: null
          },
          sourceRun.runId
        );
      }

      activeRerunByOriginal.delete(sourceRun.runId);
      writeSse(sourceRun.runId, "rerun_finished", {
        sourceRunId: sourceRun.runId,
        runId: newRunId,
        status: incidents.get(newRunId)?.status ?? "unknown"
      });
    }, RERUN_FINAL_DELAY_MS);

    return newRunId;
  }

  app.get("/api/incidents", (request, response) => {
    const statusFilter = parseCsvFilter(request.query.status);
    const workflowFilter = parseCsvFilter(request.query.workflow);
    const environmentFilter = parseCsvFilter(request.query.environment);
    const severityFilter = parseCsvFilter(request.query.severity);
    const fromDate = request.query.from ? new Date(String(request.query.from)) : null;
    const toDate = request.query.to ? new Date(String(request.query.to)) : null;

    let rows = [...incidents.values()].map((run) =>
      buildIncidentRow(run, activeRerunByOriginal)
    );

    if (statusFilter) {
      rows = rows.filter((row) => statusFilter.has(row.status.toLowerCase()));
    }
    if (workflowFilter) {
      rows = rows.filter((row) =>
        workflowFilter.has(row.workflowName.toLowerCase())
      );
    }
    if (environmentFilter) {
      rows = rows.filter((row) =>
        environmentFilter.has(row.environment.toLowerCase())
      );
    }
    if (severityFilter) {
      rows = rows.filter((row) =>
        severityFilter.has(row.severity.toLowerCase())
      );
    }
    if (fromDate && !Number.isNaN(fromDate.valueOf())) {
      rows = rows.filter((row) => new Date(row.createdAt) >= fromDate);
    }
    if (toDate && !Number.isNaN(toDate.valueOf())) {
      rows = rows.filter((row) => new Date(row.createdAt) <= toDate);
    }

    rows.sort(
      (left, right) =>
        new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf()
    );

    const cursor = Number.parseInt(String(request.query.cursor ?? "0"), 10);
    const pageSizeRaw = Number.parseInt(
      String(request.query.pageSize ?? DEFAULT_PAGE_SIZE),
      10
    );
    const safeCursor = Number.isNaN(cursor) ? 0 : Math.max(cursor, 0);
    const safePageSize = Number.isNaN(pageSizeRaw)
      ? DEFAULT_PAGE_SIZE
      : Math.min(Math.max(pageSizeRaw, 1), 100);

    const items = rows.slice(safeCursor, safeCursor + safePageSize);
    const nextCursor =
      safeCursor + safePageSize < rows.length ? safeCursor + safePageSize : null;

    response.json({
      items,
      nextCursor,
      total: rows.length
    });
  });

  app.get("/api/incidents/:runId", (request, response) => {
    const run = incidents.get(request.params.runId);
    if (!run) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    response.json(buildIncidentDetail(run, activeRerunByOriginal));
  });

  app.post("/api/runs/:runId/rerun", (request, response) => {
    const run = incidents.get(request.params.runId);
    if (!run) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    const rerunState = getRerunState(run, activeRerunByOriginal);
    if (rerunState.activeRerunRunId) {
      response.status(409).json({
        error: "A rerun is already in progress for this run.",
        activeRerunRunId: rerunState.activeRerunRunId
      });
      return;
    }

    if (!rerunState.eligible) {
      response.status(400).json({
        error: rerunState.disabledReason
      });
      return;
    }

    const newRunId = createRerunRun(run);
    response.status(202).json({
      originalRunId: run.runId,
      newRunId,
      status: "queued"
    });
  });

  app.get("/api/runs/:runId/events", (request, response) => {
    const runId = request.params.runId;
    const run = incidents.get(runId);

    if (!run) {
      response.status(404).json({ error: "Run not found." });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    response.write(
      `data: ${makeEvent("snapshot", {
        runId: run.runId,
        status: run.status,
        summary: run.summary,
        activeRerunRunId: activeRerunByOriginal.get(runId) ?? null
      })}\n\n`
    );

    registerClient(runId, response);
    const pingTimer = setInterval(() => {
      response.write(": ping\n\n");
    }, 15_000);

    request.on("close", () => {
      clearInterval(pingTimer);
      unregisterClient(runId, response);
    });
  });

  app.use(express.static(path.join(__dirname, "public")));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(__dirname, "public", "index.html"));
  });

  function dispose() {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();

    for (const clients of streamClients.values()) {
      for (const response of clients) {
        response.end();
      }
    }
    streamClients.clear();
  }

  return {
    app,
    dispose
  };
}

