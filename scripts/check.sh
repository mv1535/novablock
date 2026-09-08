#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

for script in extension/*.js; do
  node --check "$script"
done

node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json', 'utf8'))"
npm test
