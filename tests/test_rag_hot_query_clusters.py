import unittest

from scripts.rag_hot_query_clusters import (
    HotQueryClusterStore,
    decide_merge,
    metadata_from_rag_payload,
)


class HotQueryClusterTests(unittest.TestCase):
    def test_auto_merges_equivalent_queries(self):
        decision = decide_merge(
            query="保研怎么准备",
            candidate_query="保研要准备什么",
            semantic_similarity=0.96,
            query_terms={"保研", "准备"},
            candidate_terms={"保研", "准备"},
            query_post_ids=[784, 356, 100, 101, 102],
            candidate_post_ids=[784, 356, 200, 201, 202],
        )

        self.assertEqual(decision.kind, "merged")
        self.assertEqual(decision.reason, "high_confidence")

    def test_candidate_when_similarity_high_but_results_weak(self):
        decision = decide_merge(
            query="保研怎么准备",
            candidate_query="保研要准备什么",
            semantic_similarity=0.91,
            query_terms={"保研", "准备"},
            candidate_terms={"保研", "准备"},
            query_post_ids=[1, 2, 3, 4, 5],
            candidate_post_ids=[9, 8, 7, 6, 5],
        )

        self.assertEqual(decision.kind, "candidate")

    def test_rejects_different_primary_subjects(self):
        decision = decide_merge(
            query="考研怎么准备",
            candidate_query="保研要准备什么",
            semantic_similarity=0.97,
            query_terms={"考研", "准备"},
            candidate_terms={"保研", "准备"},
            query_post_ids=[784, 356, 100],
            candidate_post_ids=[784, 356, 200],
        )

        self.assertEqual(decision.kind, "rejected")
        self.assertEqual(decision.reason, "conflicting_subject")

    def test_rejects_conflicting_qualifiers(self):
        decision = decide_merge(
            query="选课避坑",
            candidate_query="选课推荐",
            semantic_similarity=0.97,
            query_terms={"选课"},
            candidate_terms={"选课"},
            query_post_ids=[1, 2, 3],
            candidate_post_ids=[1, 2, 4],
        )

        self.assertEqual(decision.kind, "rejected")
        self.assertEqual(decision.reason, "conflicting_qualifier")

    def test_metadata_from_rag_payload_extracts_terms_and_posts(self):
        payload = {
            "data": {
                "keywords": ["保研", "准备"],
                "slices": ["保研申请条件"],
                "rewritten_query": "保研需要做哪些准备？",
                "results": [{"post_id": 784}, {"post_id": "356"}, {"post_id": None}],
            }
        }

        metadata = metadata_from_rag_payload(payload)

        self.assertEqual(metadata.terms, {"保研", "准备", "保研申请条件"})
        self.assertEqual(metadata.top_post_ids, [784, 356])
        self.assertEqual(metadata.rewritten_query, "保研需要做哪些准备？")

    def test_store_records_observation_events_without_changing_public_hot_queries(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path

        with TemporaryDirectory() as temp_dir:
            store = HotQueryClusterStore(Path(temp_dir) / "hot_queries.sqlite3")
            store.record_observation(
                raw_query="保研怎么准备",
                normalized_query="保研怎么准备",
                decision_kind="candidate",
                decision_reason="needs_review",
                semantic_similarity=0.91,
                result_overlap=1,
                result_count=2,
                cache_hit=False,
                candidate_query="保研要准备什么",
                terms=["保研", "准备"],
                top_post_ids=[784, 356],
            )

            events = store.recent_observations(limit=5)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["raw_query"], "保研怎么准备")
        self.assertEqual(events[0]["merge_decision"], "candidate")
        self.assertEqual(events[0]["candidate_query"], "保研要准备什么")
        self.assertEqual(events[0]["terms"], ["保研", "准备"])
        self.assertEqual(events[0]["top_post_ids"], [784, 356])


if __name__ == "__main__":
    unittest.main()
