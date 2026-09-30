"""Flask API for independent randomized quicksort runs."""

from __future__ import annotations

import random
from threading import Lock

from flask import Flask, jsonify, request


app = Flask(__name__)

# These counters intentionally live only as long as this server process does.
# Deploy with one Gunicorn worker so every request sees the same counters.
_stats_lock = Lock()
_total_runs = 0
_total_comparisons = 0
_rng = random.SystemRandom()


@app.after_request
def allow_frontend(response):
    # The public API uses no credentials or secrets. This permits both local
    # frontend origins and the eventual GitHub Pages origin.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def statistics():
    with _stats_lock:
        runs = _total_runs
        comparisons = _total_comparisons
    return {
        "total_runs": runs,
        "total_comparisons": comparisons,
        "average_comparisons": comparisons / runs if runs else None,
    }


def validate_sequence(payload):
    if not isinstance(payload, dict) or "sequence" not in payload:
        return "Provide a JSON object with a 'sequence' array."

    sequence = payload["sequence"]
    if not isinstance(sequence, list):
        return "Sequence must be an array of 16 integers."
    if len(sequence) != 16:
        return "Sequence must contain exactly 16 integers."
    if any(type(value) is not int for value in sequence):
        return "Every value must be an integer (not a decimal, string, or boolean)."
    if any(value < 1 or value > 99 for value in sequence):
        return "Every integer must be between 1 and 99."
    if len(set(sequence)) != 16:
        return "All 16 integers must be distinct; remove duplicates."
    return None


def quicksort(sequence):
    """Return (sorted values, recursion tree, comparisons) for one run."""
    if not sequence:
        return [], None, 0

    if len(sequence) == 1:
        return sequence[:], {
            "subarray": sequence[:],
            "pivot": sequence[0],
            "left": None,
            "right": None,
        }, 0

    pivot_index = _rng.randrange(len(sequence))
    pivot = sequence[pivot_index]
    left_values = []
    right_values = []

    # One pass and exactly one comparison for each non-pivot element.
    for index, value in enumerate(sequence):
        if index == pivot_index:
            continue
        if value < pivot:
            left_values.append(value)
        else:
            right_values.append(value)

    sorted_left, left_tree, left_count = quicksort(left_values)
    sorted_right, right_tree, right_count = quicksort(right_values)
    tree = {
        "subarray": sequence[:],
        "pivot": pivot,
        "left": left_tree,
        "right": right_tree,
    }
    comparisons = len(sequence) - 1 + left_count + right_count
    return sorted_left + [pivot] + sorted_right, tree, comparisons


@app.get("/api/random-sequence")
def random_sequence():
    return jsonify({"sequence": _rng.sample(range(1, 100), 16)})


@app.get("/api/stats")
def get_stats():
    return jsonify(statistics())


@app.post("/api/sort-batch")
def sort_batch():
    payload = request.get_json(silent=True)
    error = validate_sequence(payload)
    if error:
        return jsonify({"error": error}), 400

    sequence = payload["sequence"]
    runs = []
    for _ in range(10):
        sorted_sequence, tree, comparisons = quicksort(sequence)
        runs.append({
            "sorted_sequence": sorted_sequence,
            "comparisons": comparisons,
            "tree": tree,
        })

    # Commit only after every run has completed successfully.
    global _total_runs, _total_comparisons
    with _stats_lock:
        _total_runs += 10
        _total_comparisons += sum(run["comparisons"] for run in runs)
        stats = {
            "total_runs": _total_runs,
            "total_comparisons": _total_comparisons,
            "average_comparisons": _total_comparisons / _total_runs,
        }
    return jsonify({"runs": runs, "stats": stats})


if __name__ == "__main__":
    app.run(debug=True)
