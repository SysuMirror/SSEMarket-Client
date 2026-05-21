from __future__ import annotations

import sqlite3
import time
import json
from dataclasses import dataclass
from pathlib import Path

AUTO_MERGE_SIMILARITY = 0.94
CANDIDATE_SIMILARITY = 0.88
MIN_SHARED_TERMS = 1
MIN_AUTO_OVERLAP = 2

PRIMARY_SUBJECTS = ("保研", "考研", "转专业", "辅修")
HARD_QUALIFIERS = ("不要", "失败", "避坑", "不能", "能不能", "大一", "大三", "新生", "毕业")


@dataclass(frozen=True)
class MergeDecision:
    kind: str
    semantic_similarity: float
    shared_terms: int
    result_overlap: int
    reason: str


@dataclass(frozen=True)
class QueryMetadata:
    terms: set[str]
    top_post_ids: list[int]
    rewritten_query: str


def primary_subject(text: str) -> str:
    for subject in PRIMARY_SUBJECTS:
        if subject in text:
            return subject
    return ""


def has_conflicting_subject(query: str, candidate_query: str) -> bool:
    left = primary_subject(query)
    right = primary_subject(candidate_query)
    return bool(left and right and left != right)


def has_conflicting_qualifier(query: str, candidate_query: str) -> bool:
    return any((word in query) != (word in candidate_query) for word in HARD_QUALIFIERS)


def overlap_count(left_ids: list[int], right_ids: list[int], limit: int = 5) -> int:
    return len(set(left_ids[:limit]) & set(right_ids[:limit]))


def decide_merge(
    *,
    query: str,
    candidate_query: str,
    semantic_similarity: float,
    query_terms: set[str],
    candidate_terms: set[str],
    query_post_ids: list[int],
    candidate_post_ids: list[int],
) -> MergeDecision:
    shared_terms = len(query_terms & candidate_terms)
    result_overlap = overlap_count(query_post_ids, candidate_post_ids)

    if has_conflicting_subject(query, candidate_query):
        return MergeDecision("rejected", semantic_similarity, shared_terms, result_overlap, "conflicting_subject")
    if has_conflicting_qualifier(query, candidate_query):
        return MergeDecision("rejected", semantic_similarity, shared_terms, result_overlap, "conflicting_qualifier")
    if (
        semantic_similarity >= AUTO_MERGE_SIMILARITY
        and shared_terms >= MIN_SHARED_TERMS
        and result_overlap >= MIN_AUTO_OVERLAP
    ):
        return MergeDecision("merged", semantic_similarity, shared_terms, result_overlap, "high_confidence")
    if semantic_similarity >= CANDIDATE_SIMILARITY:
        return MergeDecision("candidate", semantic_similarity, shared_terms, result_overlap, "needs_review")
    return MergeDecision("new", semantic_similarity, shared_terms, result_overlap, "low_similarity")


def metadata_from_rag_payload(payload: dict) -> QueryMetadata:
    data = payload.get("data") or {}
    terms: set[str] = set()
    for key in ("keywords", "slices"):
        values = data.get(key) or []
        if isinstance(values, list):
            terms.update(str(value).strip() for value in values if str(value).strip())

    post_ids: list[int] = []
    for item in (data.get("results") or [])[:5]:
        try:
            post_id = int(item.get("post_id"))
        except (AttributeError, TypeError, ValueError):
            continue
        if post_id not in post_ids:
            post_ids.append(post_id)

    return QueryMetadata(
        terms=terms,
        top_post_ids=post_ids,
        rewritten_query=str(data.get("rewritten_query") or ""),
    )


class HotQueryClusterStore:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        conn = self.connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS hot_query_observations (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    raw_query TEXT NOT NULL,
                    normalized_query TEXT NOT NULL,
                    candidate_query TEXT NOT NULL DEFAULT '',
                    merge_decision TEXT NOT NULL,
                    decision_reason TEXT NOT NULL,
                    semantic_similarity REAL NOT NULL,
                    result_overlap INTEGER NOT NULL,
                    result_count INTEGER NOT NULL,
                    cache_hit INTEGER NOT NULL,
                    terms_json TEXT NOT NULL DEFAULT '[]',
                    top_post_ids_json TEXT NOT NULL DEFAULT '[]',
                    created_at INTEGER NOT NULL
                )
                """
            )
            columns = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(hot_query_observations)").fetchall()
            }
            if "terms_json" not in columns:
                conn.execute("ALTER TABLE hot_query_observations ADD COLUMN terms_json TEXT NOT NULL DEFAULT '[]'")
            if "top_post_ids_json" not in columns:
                conn.execute("ALTER TABLE hot_query_observations ADD COLUMN top_post_ids_json TEXT NOT NULL DEFAULT '[]'")
            conn.commit()
        finally:
            conn.close()

    def record_observation(
        self,
        *,
        raw_query: str,
        normalized_query: str,
        decision_kind: str,
        decision_reason: str,
        semantic_similarity: float,
        result_overlap: int,
        result_count: int,
        cache_hit: bool,
        candidate_query: str = "",
        terms: list[str] | None = None,
        top_post_ids: list[int] | None = None,
    ) -> None:
        conn = self.connect()
        try:
            conn.execute(
                """
                INSERT INTO hot_query_observations
                (
                    raw_query,
                    normalized_query,
                    candidate_query,
                    merge_decision,
                    decision_reason,
                    semantic_similarity,
                    result_overlap,
                    result_count,
                    cache_hit,
                    terms_json,
                    top_post_ids_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    raw_query,
                    normalized_query,
                    candidate_query,
                    decision_kind,
                    decision_reason,
                    float(semantic_similarity),
                    int(result_overlap),
                    int(result_count),
                    1 if cache_hit else 0,
                    json.dumps(terms or [], ensure_ascii=False),
                    json.dumps(top_post_ids or [], ensure_ascii=False),
                    int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def recent_observations(self, limit: int = 20) -> list[dict]:
        safe_limit = min(max(int(limit), 1), 100)
        conn = self.connect()
        try:
            rows = conn.execute(
                """
                SELECT
                    raw_query,
                    normalized_query,
                    candidate_query,
                    merge_decision,
                    decision_reason,
                    semantic_similarity,
                    result_overlap,
                    result_count,
                    cache_hit,
                    terms_json,
                    top_post_ids_json,
                    created_at
                FROM hot_query_observations
                ORDER BY event_id DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        finally:
            conn.close()
        return [
            {
                "raw_query": row["raw_query"],
                "normalized_query": row["normalized_query"],
                "candidate_query": row["candidate_query"],
                "merge_decision": row["merge_decision"],
                "decision_reason": row["decision_reason"],
                "semantic_similarity": float(row["semantic_similarity"]),
                "result_overlap": int(row["result_overlap"]),
                "result_count": int(row["result_count"]),
                "cache_hit": bool(row["cache_hit"]),
                "terms": json.loads(row["terms_json"]),
                "top_post_ids": json.loads(row["top_post_ids_json"]),
                "created_at": int(row["created_at"]),
            }
            for row in rows
        ]
