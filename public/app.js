const state = {
  incidents: [],
  selectedRunId: null,
  selectedDetail: null,
  eventSource: null,
  flashTimer: null,
  refreshTimer: null
};

const elements = {
  filtersForm: document.querySelector("#filters"),
  workflowFilter: document.querySelector("#workflowFilter"),
  tableBody: document.querySelector("#runsTableBody"),
  detailPanel: document.querySelector("#detailPanel"),
  flash: document.querySelector("#flash"),
  totalRuns: document.querySelector("#totalRuns"),
  lastUpdated: document.querySelector("#lastUpdated"),
  clearFilters: document.querySelector("#clearFilters")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

function statusPill(status) {
  return `<span class="pill pill-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

function severityPill(severity) {
  return `<span class="pill pill-${escapeHtml(severity)}">${escapeHtml(
    severity
  )}</span>`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function formParams() {
  const data = new FormData(elements.filtersForm);
  const params = new URLSearchParams();

  for (const [key, value] of data.entries()) {
    if (String(value).trim() !== "") {
      params.set(key, String(value));
    }
  }

  return params;
}

function updateWorkflowFilterOptions() {
  const selectedValue = elements.workflowFilter.value;
  const workflows = [...new Set(state.incidents.map((item) => item.workflowName))].sort();

  elements.workflowFilter.innerHTML = `<option value="">All</option>${workflows
    .map(
      (workflow) =>
        `<option value="${escapeHtml(workflow)}">${escapeHtml(workflow)}</option>`
    )
    .join("")}`;

  if (workflows.includes(selectedValue)) {
    elements.workflowFilter.value = selectedValue;
  }
}

function renderTable() {
  if (state.incidents.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">No runs match the current filters.</td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = state.incidents
    .map((incident) => {
      const rerunDisabled = !incident.rerun.eligible;
      const rowClass = incident.runId === state.selectedRunId ? "selected" : "";

      return `
        <tr data-run-id="${escapeHtml(incident.runId)}" class="${rowClass}">
          <td>${statusPill(incident.status)}</td>
          <td class="summary-cell">
            <strong>${escapeHtml(incident.summary)}</strong><br />
            <span class="subtle mono">${escapeHtml(incident.component)} • ${escapeHtml(
              incident.environment
            )}</span>
          </td>
          <td>${escapeHtml(incident.workflowName)}</td>
          <td>${severityPill(incident.severity)}</td>
          <td class="mono">${escapeHtml(formatDate(incident.createdAt))}</td>
          <td>
            <button
              class="action-btn"
              data-action="rerun"
              data-run-id="${escapeHtml(incident.runId)}"
              ${rerunDisabled ? "disabled" : ""}
              title="${escapeHtml(incident.rerun.disabledReason ?? "Rerun this run")}"
            >
              Rerun
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  for (const row of elements.tableBody.querySelectorAll("tr[data-run-id]")) {
    row.addEventListener("click", () => {
      const runId = row.getAttribute("data-run-id");
      if (runId) {
        selectRun(runId);
      }
    });
  }

  for (const button of elements.tableBody.querySelectorAll("button[data-action='rerun']")) {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const runId = button.getAttribute("data-run-id");
      if (!runId) {
        return;
      }
      await triggerRerun(runId);
    });
  }
}

function renderDetail(detail) {
  if (!detail) {
    elements.detailPanel.innerHTML = `
      <div class="empty-detail">
        <h3>Select a run</h3>
        <p>Pick a row from the run table to inspect details and rerun behavior.</p>
      </div>
    `;
    return;
  }

  const rerunDisabled = !detail.rerun.eligible;
  const steps = detail.howToFix.steps
    .map((step) => {
      const text = escapeHtml(step.text);
      if (step.link) {
        return `<li>${text} <a href="${escapeHtml(step.link)}">${escapeHtml(step.link)}</a></li>`;
      }
      return `<li>${text}</li>`;
    })
    .join("");

  elements.detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Run ${escapeHtml(detail.runId)}</p>
        <h3>${escapeHtml(detail.summary)}</h3>
      </div>
      ${statusPill(detail.status)}
    </div>

    <div class="detail-meta">
      <div><strong>Workflow</strong><span>${escapeHtml(detail.context.workflowName)}</span></div>
      <div><strong>Step</strong><span>${escapeHtml(detail.context.stepName ?? "N/A")}</span></div>
      <div><strong>Environment</strong><span>${escapeHtml(detail.context.environment)}</span></div>
      <div><strong>Request ID</strong><span class="mono">${escapeHtml(
        detail.context.requestId ?? "N/A"
      )}</span></div>
      <div><strong>User ID</strong><span class="mono">${escapeHtml(
        detail.context.userId ?? "N/A"
      )}</span></div>
      <div><strong>Timestamp</strong><span>${escapeHtml(
        formatDate(detail.context.createdAt)
      )}</span></div>
    </div>

    <section class="section">
      <h4>Technical details</h4>
      <p><strong>Error type:</strong> ${escapeHtml(detail.technical.errorType ?? "N/A")}</p>
      <p><strong>Component:</strong> ${escapeHtml(detail.technical.component ?? "N/A")}</p>
      <p><strong>Stack trace:</strong> <span class="mono">${escapeHtml(
        detail.technical.stackTraceRef ?? "N/A"
      )}</span></p>
      <p><strong>Log reference:</strong> <a href="${escapeHtml(
        detail.technical.logUrl ?? "#"
      )}">${escapeHtml(detail.technical.logUrl ?? "N/A")}</a></p>
    </section>

    <section class="section">
      <h4>How to fix</h4>
      <p>${escapeHtml(detail.howToFix.rootCause)}</p>
      <ol class="fix-steps">${steps}</ol>
      ${
        detail.howToFix.transientHint
          ? `<p class="hint">${escapeHtml(detail.howToFix.transientHint)}</p>`
          : ""
      }
    </section>

    <section class="section">
      <h4>Input payload</h4>
      <p class="hint">${escapeHtml(detail.inputs.redactionPolicy)}</p>
      <pre class="payload">${escapeHtml(JSON.stringify(detail.inputs.payload, null, 2))}</pre>
    </section>

    <section class="detail-actions">
      <button
        id="detailRerunButton"
        class="btn-primary"
        ${rerunDisabled ? "disabled" : ""}
        title="${escapeHtml(detail.rerun.disabledReason ?? "Rerun this run")}"
      >
        Rerun this run
      </button>
      <span class="hint">
        ${
          rerunDisabled
            ? escapeHtml(detail.rerun.disabledReason ?? "Rerun unavailable.")
            : "Rerun will use the same inputs and create a new run ID."
        }
      </span>
    </section>
  `;

  const rerunButton = document.querySelector("#detailRerunButton");
  if (rerunButton) {
    rerunButton.addEventListener("click", async () => {
      await triggerRerun(detail.runId);
    });
  }
}

function showFlash(message, type = "info") {
  clearTimeout(state.flashTimer);
  elements.flash.hidden = false;
  elements.flash.className = `flash flash-${type}`;
  elements.flash.textContent = message;

  state.flashTimer = setTimeout(() => {
    elements.flash.hidden = true;
    elements.flash.textContent = "";
  }, 5500);
}

async function loadIncidents({ preserveSelection = true } = {}) {
  const params = formParams();
  const query = params.toString();
  const url = query ? `/api/incidents?${query}` : "/api/incidents";
  const data = await fetchJson(url);

  state.incidents = data.items;
  elements.totalRuns.textContent = `${data.total} runs`;
  elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  updateWorkflowFilterOptions();
  renderTable();

  if (!preserveSelection) {
    return;
  }

  if (state.selectedRunId) {
    const stillVisible = state.incidents.some((item) => item.runId === state.selectedRunId);
    if (!stillVisible && state.selectedDetail?.runId !== state.selectedRunId) {
      state.selectedRunId = null;
      state.selectedDetail = null;
      renderDetail(null);
    }
  }
}

async function loadDetail(runId) {
  state.selectedRunId = runId;
  const detail = await fetchJson(`/api/incidents/${encodeURIComponent(runId)}`);
  state.selectedDetail = detail;
  renderTable();
  renderDetail(detail);
}

function connectEventStream(runId) {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  state.eventSource = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  state.eventSource.onmessage = async () => {
    await loadIncidents();
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  };

  state.eventSource.onerror = () => {
    showFlash("Live updates disconnected. Retrying...", "error");
  };
}

async function selectRun(runId) {
  await loadDetail(runId);
  connectEventStream(runId);
}

async function triggerRerun(runId) {
  try {
    const data = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/rerun`, {
      method: "POST"
    });
    showFlash(
      `Rerun queued for ${data.originalRunId}. New run: ${data.newRunId}.`,
      "success"
    );
    await loadIncidents();
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  } catch (error) {
    if (error.status === 409 && error.body?.activeRerunRunId) {
      showFlash(
        `Rerun already in progress: ${error.body.activeRerunRunId}.`,
        "info"
      );
    } else {
      showFlash(error.message, "error");
    }
    await loadIncidents();
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  }
}

function startAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }
  state.refreshTimer = setInterval(async () => {
    await loadIncidents();
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  }, 20_000);
}

function attachEvents() {
  elements.filtersForm.addEventListener("change", async () => {
    await loadIncidents({ preserveSelection: false });
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  });

  elements.clearFilters.addEventListener("click", async () => {
    elements.filtersForm.reset();
    await loadIncidents({ preserveSelection: false });
    if (state.selectedRunId) {
      await loadDetail(state.selectedRunId);
    }
  });
}

async function bootstrap() {
  attachEvents();
  await loadIncidents({ preserveSelection: false });

  const preferred = state.incidents.find((item) => item.status === "failed");
  if (preferred) {
    await selectRun(preferred.runId);
  }

  startAutoRefresh();
}

bootstrap().catch((error) => {
  showFlash(`Failed to initialize dashboard: ${error.message}`, "error");
});

