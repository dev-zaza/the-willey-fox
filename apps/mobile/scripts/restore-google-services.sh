#!/usr/bin/env bash
# Writes apps/mobile/google-services.json from GOOGLE_SERVICES_JSON_BASE64 (set in .env.local).
# The file itself stays gitignored/untracked; run this before `eas build --local` for Android.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${GOOGLE_SERVICES_JSON_BASE64:-}" ]; then
  if [ -f .env.local ]; then
    GOOGLE_SERVICES_JSON_BASE64=$(grep '^GOOGLE_SERVICES_JSON_BASE64=' .env.local | cut -d= -f2-)
  fi
fi

if [ -z "${GOOGLE_SERVICES_JSON_BASE64:-}" ]; then
  echo "GOOGLE_SERVICES_JSON_BASE64 not set (checked env and .env.local)." >&2
  exit 1
fi

echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 --decode > google-services.json
echo "Wrote google-services.json"
