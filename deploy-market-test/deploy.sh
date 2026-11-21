#!/bin/sh
set -eu
umask 077
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo"
sha=$(git rev-parse --verify HEAD)
branch=$(git symbolic-ref --quiet --short HEAD || true)
test -z "$branch" || test "$branch" = dev
test "$(git rev-parse --verify refs/remotes/origin/dev)" = "$sha"
helper=/home/cloud/market/frontend-operator-20261120/build_guard.py
python3 -B -c 'import hashlib,sys;from pathlib import Path;assert hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()=="a8908d1cdfa25008560b754d23bcdb1bd1bf074db91c88d4d15b85fbae8e4c06"' "$helper"
exec python3 -B "$helper" "$sha" "$repo"
