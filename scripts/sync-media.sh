#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: bash scripts/sync-media.sh <media-dir> [--dry-run]" >&2
}

MEDIA_DIR="${1:-}"
MODE="${2:-}"

if [ -z "$MEDIA_DIR" ] || { [ -n "$MODE" ] && [ "$MODE" != "--dry-run" ]; }; then
  usage
  exit 2
fi

if [ ! -d "$MEDIA_DIR" ]; then
  echo "not a directory: $MEDIA_DIR" >&2
  usage
  exit 2
fi

if [ ! -f package.json ] || [ ! -d public ]; then
  echo "run this from the project root: package.json and public/ not found" >&2
  usage
  exit 2
fi

if [ "$MODE" = "--dry-run" ]; then
  rsync -av --dry-run --include='*/' --include='*.mp4' --exclude='*' "$MEDIA_DIR/" public/
  exit 0
fi

rsync -av --include='*/' --include='*.mp4' --exclude='*' "$MEDIA_DIR/" public/

MISSING=0
for POSTER in public/shorts/*/poster.jpg; do
  [ -f "$POSTER" ] || continue
  SLUG_DIR="$(dirname "$POSTER")"
  for NAME in preview.mp4 full.mp4; do
    if [ ! -f "$SLUG_DIR/$NAME" ]; then
      echo "missing: $SLUG_DIR/$NAME"
      MISSING=1
    fi
  done
done

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo "short-form videos: all present"
