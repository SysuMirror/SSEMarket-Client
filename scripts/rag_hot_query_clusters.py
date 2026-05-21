from __future__ import annotations

import math
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


@dataclass(frozen=True)
class CandidateMatch:
    candidate_query: str
    decision: MergeDecision


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = math.sqrt(sum(item * item for item in left))
    right_norm = math.sqrt(sum(item * item for item in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)


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
                    event_id,
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
                "event_id": int(row["event_id"]),
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

    def recent_candidate_queries(self, current_query: str, limit: int = 20) -> list[str]:
        safe_limit = min(max(int(limit), 1), 100)
        conn = self.connect()
        try:
            rows = conn.execute(
                """
                SELECT normalized_query
                FROM hot_query_observations
                WHERE normalized_query != ?
                  AND result_count > 0
                ORDER BY event_id DESC
                LIMIT ?
                """,
                (current_query, safe_limit * 4),
            ).fetchall()
        finally:
            conn.close()

        candidates: list[str] = []
        for row in rows:
            query = str(row["normalized_query"] or "")
            if query and query not in candidates:
                candidates.append(query)
            if len(candidates) >= safe_limit:
                break
        return candidates


def best_candidate_match(
    *,
    store: HotQueryClusterStore,
    query: str,
    query_embedding: list[float],
    query_terms: set[str],
    query_post_ids: list[int],
    candidate_embeddings: dict[str, list[float]],
    limit: int = 50,
) -> CandidateMatch | None:
    best: CandidateMatch | None = None
    for event in store.recent_observations(limit=limit):
        candidate_query = str(event.get("normalized_query") or "")
        if not candidate_query or candidate_query == query:
            continue
        candidate_embedding = candidate_embeddings.get(candidate_query)
        if candidate_embedding is None:
            continue
        decision = decide_merge(
            query=query,
            candidate_query=candidate_query,
            semantic_similarity=cosine_similarity(query_embedding, candidate_embedding),
            query_terms=query_terms,
            candidate_terms=set(event.get("terms") or []),
            query_post_ids=query_post_ids,
            candidate_post_ids=[int(item) for item in event.get("top_post_ids") or []],
        )
        if best is None or decision.semantic_similarity > best.decision.semantic_similarity:
            best = CandidateMatch(candidate_query=candidate_query, decision=decision)
    return best


def canonical_hot_queries_from_observations(store: HotQueryClusterStore, limit: int = 8) -> list[dict]:
    events = store.recent_observations(limit=100)
    parent: dict[str, str] = {}

    def find(query: str) -> str:
        parent.setdefault(query, query)
        if parent[query] != query:
            parent[query] = find(parent[query])
        return parent[query]

    def union(left: str, right: str) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for event in events:
        query = str(event.get("normalized_query") or "")
        candidate = str(event.get("candidate_query") or "")
        if query:
            find(query)
        if candidate:
            find(candidate)
        if (
            query
            and candidate
            and event.get("merge_decision") == "merged"
            and event.get("decision_reason") == "high_confidence"
        ):
            union(query, candidate)

    groups: dict[str, dict[str, dict]] = {}
    for event in events:
        query = str(event.get("normalized_query") or "")
        if not query or int(event.get("result_count") or 0) <= 0:
            continue
        root = find(query)
        group = groups.setdefault(root, {})
        item = group.setdefault(query, {"query": query, "count": 0, "first_event_id": 0, "first_seen": 0, "last_seen": 0})
        item["count"] += 1
        created_at = int(event.get("created_at") or 0)
        event_id = int(event.get("event_id") or 0)
        if not item["first_event_id"] or event_id < int(item["first_event_id"]):
            item["first_event_id"] = event_id
        if not item["first_seen"] or created_at < int(item["first_seen"]):
            item["first_seen"] = created_at
        item["last_seen"] = max(int(item["last_seen"]), created_at)

    ranked: list[dict] = []
    for group in groups.values():
        canonical = sorted(
            group.values(),
            key=lambda item: (-int(item["count"]), int(item["first_event_id"]), len(str(item["query"])), str(item["query"])),
        )[0]
        count = sum(int(item["count"]) for item in group.values())
        last_seen = max(int(item["last_seen"]) for item in group.values())
        ranked.append(
            {
                "query": canonical["query"],
                "count": count,
                "last_seen": last_seen,
                "recommend_score": count * 10 + min(last_seen // 100, 3),
                "_aliases": sorted(group.keys()),
            }
        )

    ranked.sort(key=lambda item: (-int(item["recommend_score"]), -int(item["count"]), -int(item["last_seen"]), str(item["query"])))
    return ranked[:min(max(int(limit), 1), 12)]


def merge_hot_query_fallbacks(canonical: list[dict], fallback: list[dict], limit: int = 8) -> list[dict]:
    safe_limit = min(max(int(limit), 1), 12)
    merged: list[dict] = []
    seen: set[str] = set()
    for item in canonical + fallback:
        query = str(item.get("query") or "")
        if not query or query in seen:
            continue
        aliases = {str(alias) for alias in item.get("_aliases", []) if str(alias)}
        if aliases & seen:
            continue
        public_item = dict(item)
        public_item.pop("_aliases", None)
        merged.append(public_item)
        seen.add(query)
        seen.update(aliases)
        if len(merged) >= safe_limit:
            break
    return merged
