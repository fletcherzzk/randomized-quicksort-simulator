"use strict";

const apiBaseUrl = (window.QUICKSORT_API_BASE_URL || "https://randomized-quicksort-backend.onrender.com").replace(/\/$/, "");
const input = document.querySelector("#sequence-input");
const generateButton = document.querySelector("#generate-button");
const sortButton = document.querySelector("#sort-button");
const message = document.querySelector("#message");
const count = document.querySelector("#value-count");
const runsList = document.querySelector("#runs-list");
const runsEmpty = document.querySelector("#runs-empty");
const treeContainer = document.querySelector("#tree-container");
const treeEmpty = document.querySelector("#tree-empty");
const treeTitle = document.querySelector("#tree-title");
const treeSummary = document.querySelector("#tree-summary");
const batchBadge = document.querySelector("#batch-badge");

// Only the current page keeps the batch; selecting a run needs no network call.
let currentRuns = [];
let selectedRun = -1;
let requestInProgress = false;
let statsUpdatedAfterLoad = false;

function setMessage(text, kind = "error") {
  message.textContent = text;
  message.className = `message message-${kind}`;
  message.hidden = !text;
}

function setBusy(busy) {
  requestInProgress = busy;
  generateButton.disabled = busy;
  sortButton.disabled = busy;
  input.disabled = busy;
  generateButton.setAttribute("aria-busy", String(busy));
  sortButton.setAttribute("aria-busy", String(busy));
}

function tokensFromInput() {
  return input.value.trim() ? input.value.trim().split(/[\s,]+/).filter(Boolean) : [];
}

function updateCount() {
  count.textContent = `${tokensFromInput().length} / 16 values`;
}

function parseSequence() {
  const tokens = tokensFromInput();
  if (tokens.length !== 16) {
    throw new Error(`Enter exactly 16 integers. You have ${tokens.length}.`);
  }
  if (tokens.some((token) => !/^[+-]?\d+$/.test(token))) {
    throw new Error("Use whole integers only, separated by commas or spaces.");
  }
  const sequence = tokens.map(Number);
  if (sequence.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 99)) {
    throw new Error("Every integer must be between 1 and 99.");
  }
  if (new Set(sequence).size !== 16) {
    throw new Error("All 16 integers must be distinct. Remove duplicates.");
  }
  return sequence;
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, options);
  } catch {
    throw new Error("Could not reach the backend. Check that the server is running and the API URL is correct.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Server request failed (HTTP ${response.status}).`);
  }
  return data;
}

function showStats(stats) {
  document.querySelector("#stat-runs").textContent = stats.total_runs.toLocaleString();
  document.querySelector("#stat-comparisons").textContent = stats.total_comparisons.toLocaleString();
  document.querySelector("#stat-average").textContent = stats.average_comparisons === null
    ? "—"
    : stats.average_comparisons.toFixed(2);
}

function clearBatch() {
  currentRuns = [];
  selectedRun = -1;
  runsList.replaceChildren();
  treeContainer.replaceChildren();
  runsEmpty.hidden = false;
  treeEmpty.hidden = false;
  treeTitle.textContent = "Recursion tree";
  treeSummary.textContent = "";
  batchBadge.hidden = true;
}

function renderRunList() {
  runsList.replaceChildren();
  runsEmpty.hidden = currentRuns.length > 0;
  batchBadge.hidden = currentRuns.length === 0;

  currentRuns.forEach((run, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "run-button";
    button.setAttribute("aria-pressed", String(index === selectedRun));

    const label = document.createElement("span");
    label.className = "run-name";
    label.textContent = `Run ${String(index + 1).padStart(2, "0")}`;
    const total = document.createElement("span");
    total.className = "run-count";
    total.textContent = `${run.comparisons} comparisons`;
    button.append(label, total);
    button.addEventListener("click", () => selectRun(index));
    item.append(button);
    runsList.append(item);
  });
}

function makeTreeNode(tree, level = 0) {
  const item = document.createElement("li");
  const card = document.createElement("div");
  card.className = "tree-node";

  const heading = document.createElement("div");
  heading.className = "node-heading";
  const title = document.createElement("strong");
  title.textContent = `${tree.subarray.length === 1 ? "Leaf" : "Subarray"} · Level ${level}`;
  const pivotLabel = document.createElement("span");
  pivotLabel.className = "pivot-label";
  pivotLabel.textContent = `Pivot ${tree.pivot}`;
  heading.append(title, pivotLabel);

  const values = document.createElement("div");
  values.className = "node-values";
  values.setAttribute("aria-label", `Subarray ${tree.subarray.join(", ")}; pivot ${tree.pivot}`);
  tree.subarray.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = value === tree.pivot ? "value-chip pivot-chip" : "value-chip";
    chip.textContent = value;
    values.append(chip);
  });
  card.append(heading, values);
  item.append(card);

  if (tree.left || tree.right) {
    const children = document.createElement("ul");
    children.className = "tree-children";
    for (const [side, child] of [["Left", tree.left], ["Right", tree.right]]) {
      const branch = document.createElement("li");
      branch.className = "tree-branch";
      const branchLabel = document.createElement("span");
      branchLabel.className = "branch-label";
      branchLabel.textContent = `${side} · Level ${level + 1}`;
      branch.append(branchLabel);
      if (child) {
        const childList = document.createElement("ul");
        childList.append(makeTreeNode(child, level + 1));
        branch.append(childList);
      } else {
        const empty = document.createElement("span");
        empty.className = "empty-branch";
        empty.textContent = "∅";
        branch.append(empty);
      }
      children.append(branch);
    }
    item.append(children);
  }
  return item;
}

function selectRun(index) {
  selectedRun = index;
  const run = currentRuns[index];
  treeTitle.textContent = `Run ${String(index + 1).padStart(2, "0")} · Recursion tree`;
  treeSummary.textContent = `${run.comparisons} comparisons · Sorted: ${run.sorted_sequence.join(", ")}`;
  treeContainer.replaceChildren();
  const root = document.createElement("ul");
  root.className = "tree-root";
  root.append(makeTreeNode(run.tree));
  treeContainer.append(root);
  treeEmpty.hidden = true;
  renderRunList();
}

input.addEventListener("input", () => {
  clearBatch();
  setMessage("");
  updateCount();
});

generateButton.addEventListener("click", async () => {
  if (requestInProgress) return;
  setMessage("");
  setBusy(true);
  try {
    const data = await apiRequest("/api/random-sequence");
    clearBatch();
    input.value = data.sequence.join(", ");
    updateCount();
  } catch (error) {
    setMessage(error.message);
  } finally {
    setBusy(false);
  }
});

sortButton.addEventListener("click", async () => {
  if (requestInProgress) return;
  clearBatch();
  setMessage("");
  let sequence;
  try {
    sequence = parseSequence();
  } catch (error) {
    setMessage(error.message);
    return;
  }

  setBusy(true);
  try {
    const data = await apiRequest("/api/sort-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence }),
    });
    currentRuns = data.runs;
    renderRunList();
    statsUpdatedAfterLoad = true;
    showStats(data.stats);
  } catch (error) {
    setMessage(error.message);
  } finally {
    setBusy(false);
  }
});

updateCount();
apiRequest("/api/stats")
  .then((stats) => {
    if (!statsUpdatedAfterLoad) showStats(stats);
  })
  .catch((error) => {
    if (!statsUpdatedAfterLoad) setMessage(error.message);
  });
