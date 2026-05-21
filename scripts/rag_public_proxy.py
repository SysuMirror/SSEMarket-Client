from __future__ import annotations

import copy
import json
import os
import re
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pymysql

from rag_hot_query_clusters import HotQueryClusterStore, metadata_from_rag_payload


RAG_API_BASE = os.getenv("SSEMARKET_RAG_API_BASE", "http://127.0.0.1:19081")
RAG_LAB_DIR = Path(os.getenv("SSEMARKET_RAG_LAB_DIR", "/root/SSE_Market/ssemarket-rag-lab"))
HOST = os.getenv("SSEMARKET_RAG_PUBLIC_HOST", "127.0.0.1")
PORT = int(os.getenv("SSEMARKET_RAG_PUBLIC_PORT", "19082"))
SEARCH_CACHE_TTL_SECONDS = 10 * 60
RAG_RESULT_CACHE: dict[tuple[str, int], tuple[float, dict]] = {}
SEARCH_LOG_PATH = Path(__file__).resolve().parent.parent / "logs" / "rag-search-events.jsonl"
HOT_QUERY_CLUSTER_DB_PATH = Path(__file__).resolve().parent.parent / "logs" / "hot-query-observations.sqlite3"
HOT_QUERY_EVENT_LIMIT = 300
HOT_QUERY_WORD_RE = re.compile(r"[A-Za-z0-9\u4e00-\u9fff]")
HOT_QUERY_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
HOT_QUERY_HANGUL_RE = re.compile(r"[\u3130-\u318f\uac00-\ud7af]")
HOT_QUERY_LONG_ASCII_TOKEN_RE = re.compile(r"[A-Za-z0-9]{12,}")
SEED_HOT_QUERIES = [
    ("保研要准备什么", 28),
    ("实习怎么找", 25),
    ("考研经验", 23),
    ("转专业经验", 21),
    ("软件工程实训组队", 19),
    ("大创值得做吗", 17),
    ("简历怎么写", 16),
    ("选课避坑", 15),
    ("绩点不高还能保研吗", 14),
    ("找导师怎么联系", 13),
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(RAG_LAB_DIR / ".env")


def normalize_query(query: str) -> str:
    return " ".join(query.strip().split())


def cache_key(query: str, limit: int) -> tuple[str, int]:
    return normalize_query(query), min(max(int(limit), 1), 10)


def clone_payload(payload: dict) -> dict:
    return copy.deepcopy(payload)


def now_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def post_ids_from_payload(payload: dict) -> list[int]:
    results = payload.get("data", {}).get("results", [])
    post_ids: list[int] = []
    for item in results:
        try:
            post_id = int(item.get("post_id"))
        except (TypeError, ValueError):
            continue
        if post_id not in post_ids:
            post_ids.append(post_id)
    return post_ids


def attach_posts(payload: dict, posts_by_id: dict[int, dict]) -> None:
    results = payload.get("data", {}).get("results", [])
    for item in results:
        try:
            post_id = int(item.get("post_id"))
        except (TypeError, ValueError):
            continue
        post = posts_by_id.get(post_id)
        if post:
            item["post"] = post


def build_rewrite_suggestions(query: str) -> list[str]:
    base = normalize_query(query)
    if not base:
        return []
    return [
        f"{base} 经验",
        f"{base} 流程",
        f"{base} 避坑",
    ]


def attach_empty_result_suggestions(payload: dict, query: str) -> None:
    data = payload.get("data")
    if not isinstance(data, dict):
        return
    if data.get("results"):
        return
    data["suggestions"] = build_rewrite_suggestions(query)


def add_metrics(payload: dict, *, cache_hit: bool, cache_age_ms: int, timings: dict[str, int]) -> dict:
    response = clone_payload(payload)
    response["cache_hit"] = cache_hit
    response["cache_age_ms"] = cache_age_ms
    response["timings"] = timings
    response["elapsed_ms"] = timings["total_ms"]
    return response


def result_count(payload: dict) -> int:
    return len(payload.get("data", {}).get("results", []))


def record_search_event(response: dict, query: str, limit: int) -> None:
    event = {
        "timestamp": int(time.time()),
        "query": normalize_query(query),
        "limit": cache_key(query, limit)[1],
        "result_count": result_count(response),
        "cache_hit": bool(response.get("cache_hit")),
        "elapsed_ms": response.get("elapsed_ms", 0),
    }
    try:
        SEARCH_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SEARCH_LOG_PATH.open("a", encoding="utf-8") as file:
            file.write(json.dumps(event, ensure_ascii=False) + "\n")
    except OSError:
        return


def observe_hot_query_cluster(response: dict, query: str) -> None:
    if result_count(response) <= 0:
        return
    normalized_query = normalize_query(query)
    if not normalized_query or not is_hot_query_candidate(normalized_query):
        return
    try:
        metadata = metadata_from_rag_payload(response)
        store = HotQueryClusterStore(HOT_QUERY_CLUSTER_DB_PATH)
        store.record_observation(
            raw_query=query,
            normalized_query=normalized_query,
            candidate_query="",
            decision_kind="new",
            decision_reason="observation_only",
            semantic_similarity=0.0,
            result_overlap=0,
            result_count=result_count(response),
            cache_hit=bool(response.get("cache_hit")),
            terms=sorted(metadata.terms),
            top_post_ids=metadata.top_post_ids,
        )
        print(
            json.dumps(
                {
                    "hot_query_observation": True,
                    "query": normalized_query,
                    "decision": "new",
                    "terms": sorted(metadata.terms),
                    "top_post_ids": metadata.top_post_ids,
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "hot_query_observation": False,
                    "query": normalized_query,
                    "error": str(exc),
                },
                ensure_ascii=False,
            ),
            flush=True,
        )


def read_search_events() -> list[dict]:
    if not SEARCH_LOG_PATH.exists():
        return []
    events: list[dict] = []
    try:
        for line in SEARCH_LOG_PATH.read_text(encoding="utf-8").splitlines()[-HOT_QUERY_EVENT_LIMIT:]:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict):
                events.append(event)
    except OSError:
        return []
    return events


def is_hot_query_candidate(query: str) -> bool:
    query = normalize_query(query)
    if not query:
        return False
    if HOT_QUERY_HANGUL_RE.search(query) and not HOT_QUERY_CJK_RE.search(query):
        return False
    word_chars = HOT_QUERY_WORD_RE.findall(query)
    if not word_chars:
        return False
    if len(word_chars) / max(len(query), 1) < 0.45:
        return False
    if HOT_QUERY_LONG_ASCII_TOKEN_RE.search(query):
        return False
    return True


def hot_queries_from_events(events: list[dict], limit: int = 8) -> list[dict]:
    seed_scores = dict(SEED_HOT_QUERIES)
    stats: dict[str, dict] = {}
    for event in events:
        query = normalize_query(str(event.get("query", "")))
        if not query or not is_hot_query_candidate(query):
            continue
        if int(event.get("result_count") or 0) <= 0:
            continue
        current = stats.setdefault(query, {"query": query, "count": 0, "last_seen": 0, "seed_score": 0})
        current["count"] += 1
        current["last_seen"] = max(current["last_seen"], int(event.get("timestamp") or 0))
    for item in stats.values():
        affinity_score = max(
            (score // 2 for seed, score in seed_scores.items() if item["query"] in seed or seed in item["query"]),
            default=0,
        )
        item["recommend_score"] = max(int(item.get("seed_score", 0)), affinity_score) + item["count"] * 10 + min(item["last_seen"] // 100, 3)
        item.pop("seed_score", None)
    ranked = sorted(stats.values(), key=lambda item: (-item["recommend_score"], -item["count"], -item["last_seen"], item["query"]))
    for query, seed_score in SEED_HOT_QUERIES:
        if len(ranked) >= min(max(int(limit), 1), 12):
            break
        if any(item["query"] == query for item in ranked):
            continue
        ranked.append({"query": query, "count": 0, "last_seen": 0, "recommend_score": seed_score})
    return ranked[:min(max(int(limit), 1), 12)]


def cached_remote_search(query: str, limit: int) -> dict:
    request_start = time.perf_counter()
    key = cache_key(query, limit)
    now = time.time()
    cached = RAG_RESULT_CACHE.get(key)

    if cached and now - cached[0] <= SEARCH_CACHE_TTL_SECONDS:
        post_start = time.perf_counter()
        payload = clone_payload(cached[1])
        posts_by_id = fetch_posts(post_ids_from_payload(payload))
        attach_posts(payload, posts_by_id)
        attach_empty_result_suggestions(payload, key[0])
        timings = {
            "rag_ms": 0,
            "post_join_ms": now_ms(post_start),
            "total_ms": now_ms(request_start),
        }
        response = add_metrics(payload, cache_hit=True, cache_age_ms=int((now - cached[0]) * 1000), timings=timings)
        record_search_event(response, key[0], key[1])
        observe_hot_query_cluster(response, key[0])
        return response

    rag_start = time.perf_counter()
    payload = rag_search(query, key[1])
    rag_ms = now_ms(rag_start)
    RAG_RESULT_CACHE[key] = (now, strip_post_fields(payload))

    post_start = time.perf_counter()
    payload = clone_payload(payload)
    posts_by_id = fetch_posts(post_ids_from_payload(payload))
    attach_posts(payload, posts_by_id)
    attach_empty_result_suggestions(payload, key[0])
    timings = {
        "rag_ms": rag_ms,
        "post_join_ms": now_ms(post_start),
        "total_ms": now_ms(request_start),
    }
    response = add_metrics(payload, cache_hit=False, cache_age_ms=0, timings=timings)
    record_search_event(response, key[0], key[1])
    observe_hot_query_cluster(response, key[0])
    return response


def strip_post_fields(payload: dict) -> dict:
    cached = clone_payload(payload)
    for item in cached.get("data", {}).get("results", []):
        item.pop("post", None)
    return cached


def rag_search(query: str, limit: int) -> dict:
    encoded_query = urllib.parse.quote(query, safe="")
    safe_limit = min(max(int(limit), 1), 10)
    url = f"{RAG_API_BASE}/search?q={encoded_query}&limit={safe_limit}"
    with urllib.request.urlopen(url, timeout=35) as response:
        return json.loads(response.read().decode("utf-8"))


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    return int(raw)


def fetch_posts(post_ids: list[int]) -> dict[int, dict]:
    if not post_ids:
        return {}
    posts_by_id: dict[int, dict] = {}
    conn = pymysql.connect(
        host=require_env("MYSQL_HOST"),
        port=env_int("MYSQL_PORT", 3506),
        user=require_env("MYSQL_USER"),
        password=require_env("MYSQL_PASSWORD"),
        database=require_env("MYSQL_DATABASE"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        read_timeout=10,
        write_timeout=10,
        connect_timeout=10,
        autocommit=True,
    )
    try:
        placeholders = ",".join(["%s"] * len(post_ids))
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                  p.postID AS PostID,
                  p.userID AS UserID,
                  COALESCE(u.name, '') AS UserName,
                  COALESCE(u.score, 0) AS UserScore,
                  COALESCE(u.phone, '') AS UserTelephone,
                  COALESCE(u.avatar_url, '') AS UserAvatar,
                  COALESCE(u.identity, '') AS UserIdentity,
                  p.title AS Title,
                  p.ptext AS Content,
                  COALESCE(p.like_num, 0) AS `Like`,
                  COALESCE(p.comment_num, 0) AS Comment,
                  COALESCE(p.browse_num, 0) AS Browse,
                  COALESCE(p.heat, 0) AS Heat,
                  DATE_FORMAT(p.post_time, '%%Y-%%m-%%dT%%H:%%i:%%s') AS PostTime,
                  COALESCE(p.photos, '') AS Photos,
                  COALESCE(p.tag, '') AS Tag
                FROM posts p
                LEFT JOIN users u ON u.userID = p.userID
                WHERE p.postID IN ({placeholders})
                """,
                post_ids,
            )
            for row in cur.fetchall():
                row["IsSaved"] = False
                row["IsLiked"] = False
                posts_by_id[int(row["PostID"])] = row
    finally:
        conn.close()
    return posts_by_id


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.write_json({"ok": True, "service": "ssemarket-rag-public-proxy"})
            return
        if parsed.path == "/hot-queries":
            params = parse_qs(parsed.query)
            limit = params.get("limit", ["8"])[0]
            self.write_json({"ok": True, "data": hot_queries_from_events(read_search_events(), int(limit))})
            return
        if parsed.path != "/search":
            self.write_json({"ok": False, "error": "not found"}, 404)
            return

        params = parse_qs(parsed.query)
        query = params.get("q", [""])[0].strip()
        limit = params.get("limit", ["5"])[0]
        if not query:
            self.write_json({"ok": False, "error": "query is required"}, 400)
            return
        try:
            response = cached_remote_search(query, int(limit))
            print(
                json.dumps(
                    {
                        "query": normalize_query(query),
                        "limit": cache_key(query, int(limit))[1],
                        "cache_hit": response.get("cache_hit"),
                        "timings": response.get("timings"),
                        "result_count": len(response.get("data", {}).get("results", [])),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
            self.write_json(response)
        except Exception as exc:
            self.write_json({"ok": False, "error": str(exc)}, 502)

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"SSEMarket RAG public proxy running at http://{HOST}:{PORT}", flush=True)
    server.serve_forever()
