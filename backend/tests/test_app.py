"""Behavioral tests for the API and the data in each recursion tree."""

import unittest

import app as quicksort_app


SEQUENCE = [42, 7, 91, 3, 65, 24, 88, 12, 56, 1, 73, 38, 99, 17, 50, 81]


def verify_tree(tree, expected_subarray):
    if not expected_subarray:
        assert tree is None
        return 0

    assert tree["subarray"] == expected_subarray
    pivot = tree["pivot"]
    assert pivot in expected_subarray
    left = [value for value in expected_subarray if value < pivot]
    right = [value for value in expected_subarray if value > pivot]
    return (
        len(expected_subarray) - 1
        + verify_tree(tree["left"], left)
        + verify_tree(tree["right"], right)
    )


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = quicksort_app.app.test_client()
        with quicksort_app._stats_lock:
            quicksort_app._total_runs = 0
            quicksort_app._total_comparisons = 0

    def stats(self):
        return self.client.get("/api/stats").get_json()

    def test_batch_returns_ten_correct_runs_and_updates_statistics(self):
        response = self.client.post("/api/sort-batch", json={"sequence": SEQUENCE})
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(len(body["runs"]), 10)
        for run in body["runs"]:
            self.assertEqual(run["sorted_sequence"], sorted(SEQUENCE))
            self.assertEqual(run["comparisons"], verify_tree(run["tree"], SEQUENCE))

        total = sum(run["comparisons"] for run in body["runs"])
        self.assertEqual(body["stats"], {
            "total_runs": 10,
            "total_comparisons": total,
            "average_comparisons": total / 10,
        })
        self.assertEqual(self.stats(), body["stats"])

        again = self.client.post("/api/sort-batch", json={"sequence": SEQUENCE})
        self.assertEqual(again.get_json()["stats"]["total_runs"], 20)

    def test_random_sequence_and_stats_reads_do_not_change_counters(self):
        self.assertEqual(self.stats()["average_comparisons"], None)
        response = self.client.get("/api/random-sequence")
        self.assertEqual(response.status_code, 200)
        values = response.get_json()["sequence"]
        self.assertEqual(len(values), 16)
        self.assertEqual(len(set(values)), 16)
        self.assertTrue(all(1 <= value <= 99 for value in values))
        self.assertEqual(self.stats()["total_runs"], 0)

    def test_invalid_requests_leave_statistics_unchanged(self):
        invalid = [
            None,
            {},
            {"sequence": []},
            {"sequence": SEQUENCE[:-1]},
            {"sequence": SEQUENCE[:-1] + [SEQUENCE[0]]},
            {"sequence": SEQUENCE[:-1] + [0]},
            {"sequence": SEQUENCE[:-1] + [100]},
            {"sequence": SEQUENCE[:-1] + [1.5]},
            {"sequence": SEQUENCE[:-1] + ["2"]},
            {"sequence": SEQUENCE[:-1] + [True]},
            {"sequence": "1, 2, 3"},
        ]
        for payload in invalid:
            with self.subTest(payload=payload):
                response = self.client.post("/api/sort-batch", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertTrue(response.get_json()["error"])
                self.assertEqual(self.stats()["total_runs"], 0)

        malformed = self.client.post(
            "/api/sort-batch", data="{oops", content_type="application/json"
        )
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(self.stats()["total_comparisons"], 0)

    def test_cors_allows_local_and_pages_frontends(self):
        response = self.client.options(
            "/api/sort-batch",
            headers={"Origin": "http://localhost:8000", "Access-Control-Request-Method": "POST"},
        )
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "*")
        self.assertIn("POST", response.headers["Access-Control-Allow-Methods"])


if __name__ == "__main__":
    unittest.main()
