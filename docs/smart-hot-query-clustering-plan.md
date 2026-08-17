# Smart Hot Query Clustering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build conservative semantic hot-query clustering for SSEMarket smart search, then use canonical hot queries for safer statistics and cache reuse.

**Architecture:** Keep the feature inside the RAG public proxy first, because this proxy already owns RAG search, result caching, search-event logging, and `/hot-queries`. Add a focused clustering module plus SQLite persistence, then wire it into the existing `/search` and `/hot-queries` flow behind observation-mode defaults.

**Tech Stack:** Python 3 standard library, SQLite, existing RAG proxy, existing RAG lab `/search` response metadata, Vue frontend only if response fields need display changes.

---

## File Map

- Create `scripts/rag_hot_query_clusters.py`: clustering rules, SQLite schema, merge decision logic, and ranking.
- Modify `scripts/rag_public_proxy.py`: call the clustering module after RAG search and read canonical hot queries from SQLite.
- Create `tests/test_rag_hot_query_clusters.py`: unit coverage for merge/reject/candidate decisions and ranking.
- Create or update `docs/smart-hot-query-clustering-design.md`: keep the design aligned with implementation decisions.

## Task 1: Add Pure Clustering Rules

**Files:**

- Create: `scripts/rag_hot_query_clusters.py`
- Test: `tests/test_rag_hot_query_clusters.py`

- [ ] **Step 1: Write tests for hard reject and similarity bands**

```python
from scripts.rag_hot_query_clusters import decide_merge

def test_auto_merges_equivalent_queries():
    decision = decide_merge(
        query="保研怎么准备",
        candidate_query="保研要准备什么",
        semantic_similarity=0.96,
        query_terms={"保研", "准备"},
        candidate_terms={"保研", "准备"},
        query_post_ids=[784, 356, 100, 101, 102],
        candidate_post_ids=[784, 356, 200, 201, 202],
    )
    assert decision.kind == "merged"

def test_candidate_when_similarity_high_but_results_weak():
    decision = decide_merge(
        query="保研怎么准备",
        candidate_query="保研要准备什么",
        semantic_similarity=0.91,
        query_terms={"保研", "准备"},
        candidate_terms={"保研", "准备"},
        query_post_ids=[1, 2, 3, 4, 5],
        candidate_post_ids=[9, 8, 7, 6, 5],
    )
    assert decision.kind == "candidate"

def test_rejects_different_primary_subjects():
    decision = decide_merge(
        query="考研怎么准备",
        candidate_query="保研要准备什么",
        semantic_similarity=0.97,
        query_terms={"考研", "准备"},
        candidate_terms={"保研", "准备"},
        query_post_ids=[784, 356, 100],
        candidate_post_ids=[784, 356, 200],
    )
    assert decision.kind == "rejected"
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run:

```bash
python -m pytest tests/test_rag_hot_query_clusters.py -q
```

Expected: import failure because `scripts/rag_hot_query_clusters.py` does not exist yet.

- [ ] **Step 3: Implement minimal pure decision logic**

Add `scripts/rag_hot_query_clusters.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

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
    if semantic_similarity >= AUTO_MERGE_SIMILARITY and shared_terms >= MIN_SHARED_TERMS and result_overlap >= MIN_AUTO_OVERLAP:
        return MergeDecision("merged", semantic_similarity, shared_terms, result_overlap, "high_confidence")
    if semantic_similarity >= CANDIDATE_SIMILARITY:
        return MergeDecision("candidate", semantic_similarity, shared_terms, result_overlap, "needs_review")
    return MergeDecision("new", semantic_similarity, shared_terms, result_overlap, "low_similarity")
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
python -m pytest tests/test_rag_hot_query_clusters.py -q
```

Expected: all tests pass.

Commit:

```bash
git add scripts/rag_hot_query_clusters.py tests/test_rag_hot_query_clusters.py
git commit -m "feat: add smart hot query merge rules"
```

## Task 2: Add SQLite Cluster Store

**Files:**

- Modify: `scripts/rag_hot_query_clusters.py`
- Modify: `tests/test_rag_hot_query_clusters.py`

- [ ] **Step 1: Add tests for cluster creation and ranking**

Append tests:

```python
from scripts.rag_hot_query_clusters import HotQueryClusterStore

def test_store_creates_and_ranks_clusters(tmp_path):
    store = HotQueryClusterStore(tmp_path / "hot_queries.sqlite3")
    store.record_new_cluster(
        canonical_query="保研要准备什么",
        keywords=["保研", "准备"],
        top_post_ids=[784, 356],
        sample_query="保研怎么准备",
    )
    store.increment_cluster("保研要准备什么", sample_query="保研需要提前做什么")

    ranked = store.hot_queries(limit=3)
    assert ranked[0]["query"] == "保研要准备什么"
    assert ranked[0]["count"] == 2
    assert "保研怎么准备" in ranked[0]["sample_queries"]
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
python -m pytest tests/test_rag_hot_query_clusters.py -q
```

Expected: failure because `HotQueryClusterStore` is not defined.

- [ ] **Step 3: Implement SQLite schema and ranking**

Add to `scripts/rag_hot_query_clusters.py`:

```python
import json
import sqlite3
import time
from pathlib import Path

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
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS hot_query_clusters (
                    cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    canonical_query TEXT NOT NULL UNIQUE,
                    count INTEGER NOT NULL,
                    last_seen INTEGER NOT NULL,
                    keywords_json TEXT NOT NULL,
                    top_post_ids_json TEXT NOT NULL,
                    sample_queries_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )

    def record_new_cluster(self, *, canonical_query: str, keywords: list[str], top_post_ids: list[int], sample_query: str) -> None:
        now = int(time.time())
        samples = [sample_query] if sample_query else [canonical_query]
        with self.connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO hot_query_clusters
                (canonical_query, count, last_seen, keywords_json, top_post_ids_json, sample_queries_json, created_at, updated_at)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?)
                """,
                (
                    canonical_query,
                    now,
                    json.dumps(keywords, ensure_ascii=False),
                    json.dumps(top_post_ids, ensure_ascii=False),
                    json.dumps(samples, ensure_ascii=False),
                    now,
                    now,
                ),
            )

    def increment_cluster(self, canonical_query: str, *, sample_query: str) -> None:
        now = int(time.time())
        with self.connect() as conn:
            row = conn.execute(
                "SELECT sample_queries_json FROM hot_query_clusters WHERE canonical_query = ?",
                (canonical_query,),
            ).fetchone()
            if row is None:
                return
            samples = json.loads(row["sample_queries_json"])
            if sample_query and sample_query not in samples:
                samples = (samples + [sample_query])[-8:]
            conn.execute(
                """
                UPDATE hot_query_clusters
                SET count = count + 1, last_seen = ?, sample_queries_json = ?, updated_at = ?
                WHERE canonical_query = ?
                """,
                (now, json.dumps(samples, ensure_ascii=False), now, canonical_query),
            )

    def hot_queries(self, limit: int = 8) -> list[dict]:
        safe_limit = min(max(int(limit), 1), 12)
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT canonical_query, count, last_seen, sample_queries_json
                FROM hot_query_clusters
                ORDER BY count DESC, last_seen DESC, canonical_query ASC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        return [
            {
                "query": row["canonical_query"],
                "count": int(row["count"]),
                "last_seen": int(row["last_seen"]),
                "recommend_score": int(row["count"]) * 10 + min(int(row["last_seen"]) // 100, 3),
                "sample_queries": json.loads(row["sample_queries_json"]),
            }
            for row in rows
        ]
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
python -m pytest tests/test_rag_hot_query_clusters.py -q
```

Expected: all tests pass.

Commit:

```bash
git add scripts/rag_hot_query_clusters.py tests/test_rag_hot_query_clusters.py
git commit -m "feat: persist smart hot query clusters"
```

## Task 3: Wire Observation Mode Into Proxy

**Files:**

- Modify: `scripts/rag_public_proxy.py`
- Modify: `tests/test_rag_hot_query_clusters.py`

- [ ] **Step 1: Add extraction tests**

Add tests for extracting cluster metadata from a RAG payload:

```python
from scripts.rag_hot_query_clusters import metadata_from_rag_payload

def test_metadata_from_rag_payload_extracts_terms_and_posts():
    payload = {
        "data": {
            "keywords": ["保研", "准备"],
            "slices": ["保研申请条件"],
            "rewritten_query": "保研需要做哪些准备？",
            "results": [{"post_id": 784}, {"post_id": 356}],
        }
    }

    metadata = metadata_from_rag_payload(payload)

    assert metadata.terms == {"保研", "准备", "保研申请条件"}
    assert metadata.top_post_ids == [784, 356]
```

- [ ] **Step 2: Implement metadata extraction**

Add:

```python
@dataclass(frozen=True)
class QueryMetadata:
    terms: set[str]
    top_post_ids: list[int]
    rewritten_query: str

def metadata_from_rag_payload(payload: dict) -> QueryMetadata:
    data = payload.get("data") or {}
    terms = set()
    for key in ("keywords", "slices"):
        values = data.get(key) or []
        if isinstance(values, list):
            terms.update(str(value).strip() for value in values if str(value).strip())
    results = data.get("results") or []
    post_ids = []
    for item in results[:5]:
        try:
            post_ids.append(int(item.get("post_id")))
        except (TypeError, ValueError, AttributeError):
            continue
    return QueryMetadata(terms=terms, top_post_ids=post_ids, rewritten_query=str(data.get("rewritten_query") or ""))
```

- [ ] **Step 3: Wire proxy in observation mode**

In `scripts/rag_public_proxy.py`:

- Create a store path under the existing proxy log/cache directory.
- After a successful non-empty search response, call the clustering code.
- Keep existing `/hot-queries` behavior unchanged in this task.
- Log merge decisions to the existing search event log or SQLite event table.

- [ ] **Step 4: Verify no user-facing behavior changed**

Run:

```bash
python -m pytest tests/test_rag_hot_query_clusters.py -q
npm run type-check
npm run build
```

Expected: tests, type-check, and build pass.

Commit:

```bash
git add scripts/rag_public_proxy.py scripts/rag_hot_query_clusters.py tests/test_rag_hot_query_clusters.py
git commit -m "feat: observe smart hot query clustering"
```

## Task 4: Enable Conservative Hot Query Output

**Files:**

- Modify: `scripts/rag_public_proxy.py`
- Modify: `scripts/rag_hot_query_clusters.py`
- Test: `tests/test_rag_hot_query_clusters.py`

- [ ] **Step 1: Add tests for public response shape**

Add a test that `sample_queries` is removed from public hot-query output unless explicitly requested by a debug path.

- [ ] **Step 2: Switch `/hot-queries` to ranked clusters with fallback**

Behavior:

- If SQLite has clusters, return canonical ranked clusters.
- If SQLite is empty, return the existing event-derived hot queries and seed fallbacks.
- Do not expose `sample_queries` in the normal public response.

- [ ] **Step 3: Verify endpoint behavior on server**

Run on server:

```bash
curl -kfsS 'https://ssemarket.cn/api/rag-local/hot-queries?limit=8'
curl -kfsS 'https://ssemarket.cn/api/rag-local/search?q=%E4%BF%9D%E7%A0%94%E6%80%8E%E4%B9%88%E5%87%86%E5%A4%87&limit=2'
curl -kfsS 'https://ssemarket.cn/api/rag-local/search?q=%E4%BF%9D%E7%A0%94%E8%A6%81%E5%87%86%E5%A4%87%E4%BB%80%E4%B9%88&limit=2'
curl -kfsS 'https://ssemarket.cn/api/rag-local/hot-queries?limit=8'
```

Expected: equivalent searches contribute to one canonical hot query when high-confidence checks pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/rag_public_proxy.py scripts/rag_hot_query_clusters.py tests/test_rag_hot_query_clusters.py
git commit -m "feat: show canonical smart hot queries"
```

## Task 5: Use Canonical Cache Keys

**Files:**

- Modify: `scripts/rag_public_proxy.py`
- Modify: `scripts/rag_hot_query_clusters.py`

- [ ] **Step 1: Add tests for canonical cache eligibility**

Test that only `merged` decisions use the canonical cache key, while `candidate`, `new`, and `rejected` use raw normalized query keys.

- [ ] **Step 2: Modify cache key selection**

In the search flow:

- Run the initial clustering decision before checking the RAG cache if a matching cluster already exists.
- Use canonical query as the RAG cache key only when the decision is `merged`.
- Keep post-field enrichment uncached.

- [ ] **Step 3: Verify cache behavior**

Run repeated same-cluster searches and confirm the second equivalent query shows `cache_hit: true` while still refreshing post fields.

Commands:

```bash
curl -kfsS 'https://ssemarket.cn/api/rag-local/search?q=%E4%BF%9D%E7%A0%94%E8%A6%81%E5%87%86%E5%A4%87%E4%BB%80%E4%B9%88&limit=2'
curl -kfsS 'https://ssemarket.cn/api/rag-local/search?q=%E4%BF%9D%E7%A0%94%E6%80%8E%E4%B9%88%E5%87%86%E5%A4%87&limit=2'
```

Expected: the second response can hit canonical cache only after high-confidence merge.

- [ ] **Step 4: Commit**

```bash
git add scripts/rag_public_proxy.py scripts/rag_hot_query_clusters.py tests/test_rag_hot_query_clusters.py
git commit -m "feat: cache smart search by canonical hot query"
```

## Final Verification

Run on server:

```bash
cd /root/SSE_Market/sse_market_new_client/newSSE
python3 -m pytest tests/test_rag_hot_query_clusters.py -q
npm run type-check
npm run build
systemctl restart ssemarket-rag-public-proxy.service
systemctl is-active ssemarket-rag-public-proxy.service
curl -kfsS https://ssemarket.cn/api/rag-local/health
curl -kfsS 'https://ssemarket.cn/api/rag-local/search?q=%E4%BF%9D%E7%A0%94%E8%A6%81%E5%87%86%E5%A4%87%E4%BB%80%E4%B9%88&limit=2'
curl -kfsS 'https://ssemarket.cn/api/rag-local/hot-queries?limit=8'
curl -fsS --connect-timeout 5 http://175.178.90.215:19082/health
```

Expected:

- Python tests pass.
- Type-check and build pass.
- Service is active.
- Public domain health/search/hot-query endpoints work.
- Direct public IP access to port `19082` times out or fails.

## Rollback

Code rollback:

```bash
git -C /root/SSE_Market/sse_market_new_client/newSSE reset --hard cff0e90
systemctl restart ssemarket-rag-public-proxy.service
```

Data rollback:

```bash
systemctl stop ssemarket-rag-public-proxy.service
mv /root/SSE_Market/sse_market_new_client/newSSE/logs/hot_query_clusters.sqlite3 /root/SSE_Market/sse_market_new_client/newSSE/logs/hot_query_clusters.sqlite3.bak.$(date +%Y%m%d%H%M%S)
systemctl start ssemarket-rag-public-proxy.service
```
