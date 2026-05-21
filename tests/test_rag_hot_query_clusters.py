import unittest

from scripts.rag_hot_query_clusters import (
    HotQueryClusterStore,
    best_candidate_match,
    canonical_hot_queries_from_observations,
    merge_hot_query_fallbacks,
    cosine_similarity,
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

    def test_cosine_similarity_handles_basic_vectors(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [1.0, 0.0]), 1.0)
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0)
        self.assertAlmostEqual(cosine_similarity([], [1.0, 0.0]), 0.0)

    def test_best_candidate_match_uses_embeddings_terms_and_posts(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path

        with TemporaryDirectory() as temp_dir:
            store = HotQueryClusterStore(Path(temp_dir) / "hot_queries.sqlite3")
            store.record_observation(
                raw_query="保研要准备什么",
                normalized_query="保研要准备什么",
                decision_kind="new",
                decision_reason="observation_only",
                semantic_similarity=0.0,
                result_overlap=0,
                result_count=2,
                cache_hit=False,
                terms=["保研", "准备"],
                top_post_ids=[784, 356],
            )

            match = best_candidate_match(
                store=store,
                query="保研怎么准备",
                query_embedding=[1.0, 0.0],
                query_terms={"保研", "准备"},
                query_post_ids=[784, 356, 100],
                candidate_embeddings={"保研要准备什么": [0.99, 0.01]},
            )

        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual(match.candidate_query, "保研要准备什么")
        self.assertEqual(match.decision.kind, "merged")

    def test_recent_candidate_queries_are_distinct_and_exclude_current_query(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path

        with TemporaryDirectory() as temp_dir:
            store = HotQueryClusterStore(Path(temp_dir) / "hot_queries.sqlite3")
            for query in ["保研要准备什么", "保研要准备什么", "考研怎么准备", "保研怎么准备"]:
                store.record_observation(
                    raw_query=query,
                    normalized_query=query,
                    decision_kind="new",
                    decision_reason="observation_only",
                    semantic_similarity=0.0,
                    result_overlap=0,
                    result_count=2,
                    cache_hit=False,
                    terms=["准备"],
                    top_post_ids=[1, 2],
                )

            candidates = store.recent_candidate_queries("保研怎么准备", limit=5)

        self.assertEqual(candidates, ["考研怎么准备", "保研要准备什么"])

    def test_canonical_hot_queries_merge_only_high_confidence_observations(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path

        with TemporaryDirectory() as temp_dir:
            store = HotQueryClusterStore(Path(temp_dir) / "hot_queries.sqlite3")
            store.record_observation(
                raw_query="保研要准备什么",
                normalized_query="保研要准备什么",
                candidate_query="保研怎么准备",
                decision_kind="merged",
                decision_reason="high_confidence",
                semantic_similarity=0.9687,
                result_overlap=2,
                result_count=2,
                cache_hit=False,
                terms=["保研", "准备"],
                top_post_ids=[784, 356],
            )
            store.record_observation(
                raw_query="保研怎么准备",
                normalized_query="保研怎么准备",
                candidate_query="保研要准备什么",
                decision_kind="merged",
                decision_reason="high_confidence",
                semantic_similarity=0.9687,
                result_overlap=2,
                result_count=2,
                cache_hit=False,
                terms=["保研", "准备"],
                top_post_ids=[784, 356],
            )
            store.record_observation(
                raw_query="考研怎么准备",
                normalized_query="考研怎么准备",
                candidate_query="保研要准备什么",
                decision_kind="rejected",
                decision_reason="conflicting_subject",
                semantic_similarity=0.97,
                result_overlap=2,
                result_count=2,
                cache_hit=False,
                terms=["考研", "准备"],
                top_post_ids=[784, 356],
            )

            hot_queries = canonical_hot_queries_from_observations(store, limit=5)

        self.assertEqual(hot_queries[0]["query"], "保研要准备什么")
        self.assertEqual(hot_queries[0]["count"], 2)
        returned_queries = [item["query"] for item in hot_queries]
        self.assertIn("考研怎么准备", returned_queries)
        self.assertNotIn("保研怎么准备", returned_queries)

    def test_merge_hot_query_fallbacks_fills_without_duplicates(self):
        canonical = [{"query": "保研要准备什么", "count": 2, "last_seen": 10, "recommend_score": 23}]
        fallback = [
            {"query": "保研要准备什么", "count": 1, "last_seen": 9, "recommend_score": 13},
            {"query": "实习怎么找", "count": 1, "last_seen": 8, "recommend_score": 12},
        ]

        merged = merge_hot_query_fallbacks(canonical, fallback, limit=2)

        self.assertEqual([item["query"] for item in merged], ["保研要准备什么", "实习怎么找"])


    def test_merge_hot_query_fallbacks_suppresses_canonical_aliases(self):
        canonical = [
            {
                "query": "canonical query",
                "count": 2,
                "last_seen": 10,
                "recommend_score": 23,
                "_aliases": ["canonical query", "alias query"],
            }
        ]
        fallback = [
            {"query": "alias query", "count": 1, "last_seen": 9, "recommend_score": 13},
            {"query": "separate query", "count": 1, "last_seen": 8, "recommend_score": 12},
        ]

        merged = merge_hot_query_fallbacks(canonical, fallback, limit=3)

        self.assertEqual([item["query"] for item in merged], ["canonical query", "separate query"])
        self.assertNotIn("_aliases", merged[0])

    def test_merge_hot_query_fallbacks_fills_limit_after_alias_suppression(self):
        canonical = [
            {
                "query": "canonical query",
                "count": 2,
                "last_seen": 10,
                "recommend_score": 23,
                "_aliases": ["canonical query", "alias query"],
            }
        ]
        fallback = [
            {"query": "alias query", "count": 1, "last_seen": 9, "recommend_score": 13},
            {"query": "fallback 1", "count": 1, "last_seen": 8, "recommend_score": 12},
            {"query": "fallback 2", "count": 1, "last_seen": 7, "recommend_score": 11},
        ]

        merged = merge_hot_query_fallbacks(canonical, fallback, limit=3)

        self.assertEqual([item["query"] for item in merged], ["canonical query", "fallback 1", "fallback 2"])


if __name__ == "__main__":
    unittest.main()
