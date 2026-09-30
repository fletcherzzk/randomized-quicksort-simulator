const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class Element {
  constructor() {
    this.children = [];
    this.handlers = new Map();
    this.attributes = new Map();
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this._textContent = "";
  }
  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }
  get textContent() { return this._textContent; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(name, handler) { this.handlers.set(name, handler); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  click() { return this.handlers.get("click")?.(); }
  input() { return this.handlers.get("input")?.(); }
}

const IDS = [
  "sequence-input", "generate-button", "sort-button", "message", "value-count",
  "runs-list", "runs-empty", "tree-container", "tree-empty", "tree-title",
  "tree-summary", "batch-badge", "stat-runs", "stat-comparisons", "stat-average",
];

function loadApp(fetch) {
  const elements = Object.fromEntries(IDS.map((id) => [id, new Element()]));
  const document = {
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => new Element(),
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  vm.runInNewContext(source, { window: {}, document, fetch, console, Number, Set });
  return elements;
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const sequence = [42, 7, 91, 3, 65, 24, 88, 12, 56, 1, 73, 38, 99, 17, 50, 81];
const tree = { subarray: sequence, pivot: 42, left: null, right: null };
const runs = Array.from({ length: 10 }, (_, index) => ({
  sorted_sequence: [...sequence].sort((a, b) => a - b),
  comparisons: 60 + index,
  tree,
}));
const stats = { total_runs: 10, total_comparisons: 645, average_comparisons: 64.5 };
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("generation, selection, editing, and a new batch manage only the current tree", async () => {
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    if (url.endsWith("/api/stats")) return response({ total_runs: 0, total_comparisons: 0, average_comparisons: null });
    if (url.endsWith("/api/random-sequence")) return response({ sequence });
    return response({ runs, stats });
  };
  const e = loadApp(fetch);
  await tick();
  assert.equal(e["stat-average"].textContent, "—");

  await e["generate-button"].click();
  assert.equal(e["value-count"].textContent, "16 / 16 values");
  assert.equal(e["runs-list"].children.length, 0);
  assert.equal(e["stat-runs"].textContent, "0");

  await e["sort-button"].click();
  assert.equal(e["runs-list"].children.length, 10);
  assert.equal(e["tree-container"].children.length, 0);
  assert.equal(e["stat-runs"].textContent, "10");
  const requestCount = requests.length;

  e["runs-list"].children[2].children[0].click();
  assert.equal(e["tree-container"].children.length, 1);
  assert.match(e["tree-summary"].textContent, /62 comparisons/);
  assert.equal(requests.length, requestCount);

  e["sequence-input"].value = sequence.slice().reverse().join(", ");
  e["sequence-input"].input();
  assert.equal(e["runs-list"].children.length, 0);
  assert.equal(e["tree-container"].children.length, 0);

  await e["sort-button"].click();
  assert.equal(e["runs-list"].children.length, 10);
  assert.equal(e["tree-container"].children.length, 0);
  assert.equal(requests.length, requestCount + 1);

  const refreshed = loadApp(fetch);
  await tick();
  assert.equal(refreshed["runs-list"].children.length, 0);
  assert.equal(refreshed["tree-container"].children.length, 0);
});

test("a delayed initial stats response cannot overwrite a completed batch", async () => {
  let resolveInitial;
  const initial = new Promise((resolve) => { resolveInitial = resolve; });
  const fetch = async (url) => url.endsWith("/api/stats")
    ? initial
    : response({ runs, stats });
  const e = loadApp(fetch);
  e["sequence-input"].value = sequence.join(", ");
  await e["sort-button"].click();
  assert.equal(e["stat-runs"].textContent, "10");
  resolveInitial(response({ total_runs: 0, total_comparisons: 0, average_comparisons: null }));
  await tick();
  assert.equal(e["stat-runs"].textContent, "10");
});

test("invalid input, server errors, and network failures show useful messages", async () => {
  let sortCalls = 0;
  const fetch = async (url) => {
    if (url.endsWith("/api/stats")) return response({ total_runs: 0, total_comparisons: 0, average_comparisons: null });
    sortCalls += 1;
    return response({ error: "Server rejected this sequence." }, 400);
  };
  const e = loadApp(fetch);
  await tick();
  await e["sort-button"].click();
  assert.match(e.message.textContent, /exactly 16/);
  assert.equal(sortCalls, 0);

  e["sequence-input"].value = [...sequence.slice(0, 15), sequence[0]].join(", ");
  await e["sort-button"].click();
  assert.match(e.message.textContent, /distinct/);
  assert.equal(sortCalls, 0);

  e["sequence-input"].value = sequence.join(", ");
  await e["sort-button"].click();
  assert.equal(e.message.textContent, "Server rejected this sequence.");
  assert.equal(sortCalls, 1);

  const offline = loadApp(async () => { throw new Error("offline"); });
  await tick();
  assert.match(offline.message.textContent, /Could not reach the backend/);
});
