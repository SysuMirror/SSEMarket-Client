# Smart Hot Query Clustering Design

## Goal

Improve the RAG smart-search hot-query mechanism so equivalent user questions are counted as one canonical hot query, while avoiding unsafe merges between related but different intents.

## Current Behavior

The proxy records each search event with the normalized raw query string and builds hot queries by exact query text. This is simple, but it splits equivalent questions such as:

- `保研要准备什么`
- `保研怎么准备`
- `保研需要提前做什么`

The result is diluted hot-query counts and weaker cache reuse.

## Proposed Behavior

Introduce conservative query clustering:

1. Keep every raw query for audit.
2. Assign high-confidence equivalent questions to a `cluster_id`.
3. Count hot queries by `canonical_query`, not by raw query.
4. Cache expensive RAG/ranking results by canonical query when the merge is high-confidence.
5. Leave medium-confidence matches as candidates only, so they can be reviewed without polluting user-facing hot queries.

## Merge Decision

A query can be auto-merged only when all three signals agree:

- Semantic similarity is high.
- Intent terms overlap.
- Search results overlap.

Recommended first thresholds:

- Auto merge: semantic similarity `>= 0.94`, at least one shared intent term, and at least two overlapping top-5 post IDs.
- Candidate only: semantic similarity `>= 0.88` but one of the other signals is weak.
- New cluster: below candidate threshold.

Hard reject rules override similarity:

- Different negation or risk words, such as `不要`, `失败`, `避坑`, `不能`, `能不能`.
- Different primary subjects, such as `保研` vs `考研`, `转专业` vs `辅修`.
- Important time or audience qualifiers differ, such as `大一`, `大三`, `新生`, `毕业`.
- Very short generic queries should not be merged into specific questions unless result overlap is very strong.

## Data Model

Use SQLite for the first production version. It is safer than recomputing from JSONL and simpler than adding a new backend service.

`hot_query_clusters`:

- `cluster_id`
- `canonical_query`
- `canonical_embedding`
- `count`
- `last_seen`
- `confidence`
- `sample_queries`
- `top_post_ids`
- `keywords`
- `created_at`
- `updated_at`

`search_events`:

- `event_id`
- `raw_query`
- `normalized_query`
- `cluster_id`
- `merge_decision`: `merged`, `candidate`, `new`, `rejected`
- `semantic_similarity`
- `result_overlap`
- `cache_hit`
- `result_count`
- `created_at`

## Runtime Flow

On `/search`:

1. Normalize the user query.
2. Run or reuse the existing RAG search pipeline.
3. Extract query metadata from the RAG payload: `keywords`, `slices`, `rewritten_query`, and top post IDs.
4. Compare the query with recent/high-count clusters.
5. Apply hard reject rules.
6. Apply the merge thresholds.
7. Record the event and update the cluster only when the decision is `merged` or `new`.
8. Use canonical-query cache only for high-confidence merged clusters.

On `/hot-queries`:

1. Read ranked clusters from SQLite.
2. Return `canonical_query`, `count`, `last_seen`, and `recommend_score`.
3. Include `sample_queries` only for debug/admin output, not the normal user-facing response.

## Cache Policy

Keep the existing safe cache boundary:

- Cache RAG analysis and ranking by canonical query.
- Do not cache mutable post display fields.
- Fetch or join post detail fields on every response.

This keeps hot questions cheaper without freezing likes, comments, browse counts, or post status.

## Rollout Plan

Phase 1: observation mode.

- Compute merge decisions.
- Store `candidate` and `merged` decisions.
- Keep user-facing hot query output unchanged.

Phase 2: conservative auto-merge.

- Enable auto-merge only for the high-confidence path.
- Keep medium-confidence matches as candidates.
- Add debug counters for merge decisions.

Phase 3: canonical cache.

- Use canonical cache keys for high-confidence clusters.
- Add cache-hit metrics by canonical query.

## Verification

Unit tests should cover:

- Equivalent questions merge.
- Related but different questions do not merge.
- Hard reject rules override high vector similarity.
- Medium-confidence matches are candidates, not user-facing merges.
- Canonical cache keys are used only for high-confidence merged clusters.

Smoke tests should verify:

- `/api/rag-local/search` still returns normal results.
- `/api/rag-local/hot-queries` returns canonical hot queries.
- Existing same-origin Nginx route still works.
- Public raw port `19082` remains inaccessible from outside the server.
