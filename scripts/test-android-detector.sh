#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
classes_dir="${TMPDIR:-/tmp}/novablock-detector-classes"
mkdir -p "$classes_dir"

if ! command -v javac >/dev/null 2>&1; then
  echo "Android ShortsDetector: skipped locally (javac unavailable; compiled in CI)"
  exit 0
fi

javac -d "$classes_dir" \
  "$project_dir/android/app/src/main/java/com/novatik/novablock/ShortsDetector.java" \
  "$project_dir/tests/java/com/novatik/novablock/ShortsDetectorSelfTest.java"

java -ea -cp "$classes_dir" com.novatik.novablock.ShortsDetectorSelfTest
