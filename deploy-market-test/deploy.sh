#!/bin/sh
set -eu
umask 077
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo"
sha=$(git rev-parse --verify HEAD)
branch=$(git symbolic-ref --quiet --short HEAD || true)
expected=${DEPLOY_BRANCH:-develop}
test -z "$branch" || test "$branch" = "$expected"
test "$(git rev-parse --verify "refs/remotes/origin/$expected")" = "$sha"
helper=/home/cloud/market/frontend-operator-20261120/build_guard.py
python3 -B -c 'import hashlib,sys;from pathlib import Path;assert hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()=="aeabce952bf5b16f761966cec78bf315108a11e3a98ce60727c9a80053b0b8ee"' "$helper"
exec python3 -B "$helper" "$sha" "$repo"
