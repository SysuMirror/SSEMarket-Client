#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Never consume the platform's PORT (usually 8080), production env files, or URLs.
command -v python3 >/dev/null 2>&1 || { echo 'python3 is required' >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo 'git is required' >&2; exit 1; }
SHA=$(git rev-parse --verify HEAD)
BRANCH=$(git symbolic-ref --quiet --short HEAD || true)
if [ -n "$BRANCH" ] && [ "$BRANCH" != dev ]; then
  echo 'Refusing non-dev checked-out branch' >&2; exit 1
fi
# A detached checkout is normal on deployment platforms; exact dev binding is
# verified in the platform configuration, not inferred from detached HEAD.
if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  echo 'Refusing dirty checkout: version must describe exact committed source' >&2; exit 1
fi
exec python3 -B - --sha "$SHA" --port "${SMOKE_PORT:-8182}" <<'SSE_DEV_SMOKE_PY'
"""Loopback-only deployment proof. No application routes, stores or outbound IO."""
import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

ALLOWED_PORTS = {8182, 18182}


def settings(sha, port):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("exact 40-character Git SHA required")
    if port not in ALLOWED_PORTS:
        raise ValueError("SMOKE_PORT must be 8182 or 18182; never platform PORT/8080")
    return sha, port


def handler(sha):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/health", "/version", "/api/version"):
                self.send_error(404)
                return
            payload = json.dumps({"status": "ok", "service": "sse-native-smoke",
                                  "git_sha": sha, "scope": "loopback-infra-only"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass  # No request paths, credentials or query strings in logs.
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sha", required=True)
    parser.add_argument("--port", type=int, default=8182)
    args = parser.parse_args()
    sha, port = settings(args.sha, args.port)
    # No reuse/kill of occupied ports. Binding failure must fail the deployment.
    server = HTTPServer(("127.0.0.1", port), handler(sha))
    print(json.dumps({"event": "listening", "host": "127.0.0.1", "port": port,
                      "git_sha": sha, "scope": "loopback-infra-only"}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
SSE_DEV_SMOKE_PY
