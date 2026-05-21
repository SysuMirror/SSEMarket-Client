import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

fake_pymysql = types.ModuleType("pymysql")
fake_pymysql.cursors = types.SimpleNamespace(DictCursor=object)
sys.modules.setdefault("pymysql", fake_pymysql)

import rag_public_proxy


def rag_payload(query="canonical query"):
    return {
        "ok": True,
        "data": {
            "query": query,
            "keywords": [query],
            "analysis_source": "rules",
            "mysql_hits": 1,
            "qdrant_hits": 1,
            "results": [{"post_id": 1, "title": "cached title"}],
        },
    }


class RagPublicProxyHotCacheTest(unittest.TestCase):
    def setUp(self):
        rag_public_proxy.RAG_RESULT_CACHE.clear()
        rag_public_proxy.HOT_QUERY_RESULT_CACHE.clear()

    def test_hot_source_uses_dedicated_cache_for_canonical_hot_query(self):
        with (
            patch.object(rag_public_proxy, "is_canonical_hot_query", return_value=True),
            patch.object(rag_public_proxy, "rag_search", return_value=rag_payload()) as rag_search,
            patch.object(rag_public_proxy, "fetch_posts", return_value={1: {"PostID": 1, "Title": "fresh"}}),
            patch.object(rag_public_proxy, "record_search_event"),
            patch.object(rag_public_proxy, "observe_hot_query_cluster"),
        ):
            first = rag_public_proxy.cached_remote_search("canonical query", 5, source="hot")
            second = rag_public_proxy.cached_remote_search("canonical query", 5, source="hot")

        self.assertFalse(first["cache_hit"])
        self.assertEqual(first["cache_scope"], "hot_query")
        self.assertTrue(second["cache_hit"])
        self.assertEqual(second["cache_scope"], "hot_query")
        self.assertEqual(rag_search.call_count, 1)

    def test_manual_source_does_not_reuse_hot_query_cache(self):
        with (
            patch.object(rag_public_proxy, "is_canonical_hot_query", return_value=True),
            patch.object(rag_public_proxy, "rag_search", return_value=rag_payload()) as rag_search,
            patch.object(rag_public_proxy, "fetch_posts", return_value={1: {"PostID": 1}}),
            patch.object(rag_public_proxy, "record_search_event"),
            patch.object(rag_public_proxy, "observe_hot_query_cluster"),
        ):
            hot_response = rag_public_proxy.cached_remote_search("canonical query", 5, source="hot")
            manual_response = rag_public_proxy.cached_remote_search("canonical query", 5, source="manual")

        self.assertEqual(hot_response["cache_scope"], "hot_query")
        self.assertFalse(manual_response["cache_hit"])
        self.assertEqual(manual_response["cache_scope"], "standard")
        self.assertEqual(rag_search.call_count, 2)

    def test_ineligible_hot_source_falls_back_to_standard_cache(self):
        with (
            patch.object(rag_public_proxy, "is_canonical_hot_query", return_value=False),
            patch.object(rag_public_proxy, "rag_search", return_value=rag_payload()) as rag_search,
            patch.object(rag_public_proxy, "fetch_posts", return_value={1: {"PostID": 1}}),
            patch.object(rag_public_proxy, "record_search_event"),
            patch.object(rag_public_proxy, "observe_hot_query_cluster"),
        ):
            first = rag_public_proxy.cached_remote_search("not hot", 5, source="hot")
            second = rag_public_proxy.cached_remote_search("not hot", 5, source="hot")

        self.assertFalse(first["cache_hit"])
        self.assertEqual(first["cache_scope"], "standard")
        self.assertTrue(second["cache_hit"])
        self.assertEqual(second["cache_scope"], "standard")
        self.assertEqual(rag_search.call_count, 1)

    def test_meaningless_queries_are_not_hot_query_candidates(self):
        for query in ["123", "1", "a", "aa", "aaa", "。。。", "测试", "test"]:
            with self.subTest(query=query):
                self.assertFalse(rag_public_proxy.is_hot_query_candidate(query))

    def test_meaningful_queries_are_hot_query_candidates(self):
        for query in ["保研", "保研怎么准备", "简历怎么写", "course review"]:
            with self.subTest(query=query):
                self.assertTrue(rag_public_proxy.is_hot_query_candidate(query))

    def test_hot_queries_from_events_excludes_meaningless_queries(self):
        hot_queries = rag_public_proxy.hot_queries_from_events(
            [
                {"query": "123", "result_count": 10, "timestamp": 100},
                {"query": "保研", "result_count": 10, "timestamp": 101},
            ],
            limit=2,
        )

        self.assertEqual(hot_queries[0]["query"], "保研")
        self.assertNotIn("123", [item["query"] for item in hot_queries])


if __name__ == "__main__":
    unittest.main()
