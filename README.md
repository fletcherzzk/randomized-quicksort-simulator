Half written by Codex, but I read the code, added the details and wrote some parts. 

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

//The use of lock is crucial here to maintain that the global variables are protected from data race! This helps regulate the "critical area" according to chatgpt (helps regulate parallel and sequential)

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

Open `http://127.0.0.1:8000`. `frontend/config.js` points to the deployed Render API by default. To test against your local Flask process, temporarily set `window.QUICKSORT_API_BASE_URL` there to `http://127.0.0.1:5000`. The frontend uses `fetch()` and stores the current batch only in page memory. Editing or generating input clears it; refreshing the page clears it too. Selecting a run builds just that run's visible tree from data already returned by the batch request.

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
2. Confirm `window.QUICKSORT_API_BASE_URL` in `frontend/config.js` points to the public Render service URL, with no trailing slash.
3. Put the contents of `frontend/` at the root of the frontend repository and publish it with GitHub Pages. The API sends `Access-Control-Allow-Origin: *`, which allows this public GitHub Pages site and local development origins to call it. The API uses no credentials.
4. Verify a batch on the deployed site, then record the URLs below.

**Deployed frontend URL:** Not deployed yet.

**Deployed backend URL:** https://randomized-quicksort-backend.onrender.com





## Interaction between frontend and backend
The backend basically sets up and API and has all the functions for dealing with requests and sending out the responses.

The frontend uses a API request function to send requests and then deals with possible errors.

After receiving a valid response, the frontend process the data, display the sorting tree and the current counter. Also, it organizes the subarrays to make a sorting tree.


## Secret:
No private API key used !!! Therefore, no secrets, but the lock preventing data races on global variable is crucial for this backend to run (like I mentioned before). 


## Limitation: 
Ideally, if render does not pause the backend python program, after lots of runs, we will get a really beautiful outcome.
However, when the code restarts, the counters will be reset to 0.

