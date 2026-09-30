# Randomized Quicksort Visualizer

A static frontend and Flask API for comparing ten independent randomized quicksort runs on the same sequence of 16 distinct integers from 1 through 99.

## What the backend does

`backend/app.py` validates each batch, runs sequential randomized quicksort ten times, and returns each sorted sequence, total comparison count, and JSON recursion tree. At each non-leaf call it selects a random pivot position, partitions the remaining values in one pass, and counts one comparison per remaining value. It updates the shared counters only after all ten runs succeed.

The API has three endpoints:

| Endpoint | Response |
| --- | --- |
| `GET /api/random-sequence` | `{ "sequence": [...] }` with 16 distinct values |
| `GET /api/stats` | `{ "total_runs": R, "total_comparisons": C, "average_comparisons": C/R }`; average is `null` while `R` is zero |
| `POST /api/sort-batch` | Send `{ "sequence": [...] }`; receive `{ "runs": [...], "stats": {...} }` or HTTP 400 with `{ "error": "..." }` |

The backend keeps only `R` and `C` in process memory. It does not retain input sequences, run histories, or trees. **Statistics are since server start** and reset when the server restarts, including after Render idle shutdown or redeployment. No database, API key, or other secret is used.

## Run locally

From the project root, create a Python environment and install the backend dependencies:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Flask listens at `http://127.0.0.1:5000`. In another terminal, serve the frontend:

```powershell
cd frontend
py -m http.server 8000
```

Open `http://127.0.0.1:8000`. `frontend/config.js` points to the local API by default. The frontend uses `fetch()` and stores the current batch only in page memory. Editing or generating input clears it; refreshing the page clears it too. Selecting a run builds just that run's visible tree from data already returned by the batch request.

Run the backend tests from `backend/`:

```powershell
python -m unittest discover -s tests -v
```

Run the frontend behavior tests from `frontend/` with Node.js:

```powershell
node tests/app.test.js
```

## Deploy

The project is arranged in `backend/` and `frontend/` so they can be moved to separate repositories for final submission.

1. Put the contents of `backend/` at the root of the backend repository. On Render, create a Python Web Service with build command `pip install -r requirements.txt` and start command `gunicorn --workers 1 app:app`. One worker is required because counters are in process memory.
2. Set `window.QUICKSORT_API_BASE_URL` in `frontend/config.js` to the public Render service URL, with no trailing slash.
3. Put the contents of `frontend/` at the root of the frontend repository and publish it with GitHub Pages. The API sends `Access-Control-Allow-Origin: *`, which allows this public GitHub Pages site and local development origins to call it. The API uses no credentials.
4. Verify a batch on the deployed site, then record the URLs below.

**Deployed frontend URL:** Not deployed yet.

**Deployed backend URL:** Not deployed yet.

## Limits

The frontend displays total comparisons for each run, with no per-node counts or animation. The backend does not persist statistics across restarts. Running multiple Render workers would split counters, so use one worker.
