#!/usr/bin/env bash
# NAS swap helper for the cheese-portfolio deploy.
# Run on the NAS as root: sudo bash deploy/nas-swap.sh <command> <deploy-dir> <stamp>
# The deploy directory contains a space, so every path below is quoted.

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: sudo bash deploy/nas-swap.sh <command> <deploy-dir> <stamp>

Commands:
  backup     Copy dist/client, compose.truenas.yaml and deploy/nginx.conf to
             *.bak-<stamp> siblings. Does not touch the container.
  swap       Replace dist/client with dist/client.new-<stamp> and recreate the
             container. Checks every precondition before moving anything.
  rollback   Restore dist/client.prev-<stamp> and the *.bak-<stamp> configs,
             then recreate the container.

<deploy-dir> is the NAS deployment directory (it must contain
compose.truenas.yaml), e.g. "/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio".
<stamp> is created once per release on the Mac with STAMP=$(date +%Y%m%d-%H%M%S)
and reused for every step of that release.
USAGE
}

die() {
  echo "nas-swap: $*" >&2
  exit 1
}

cmd="${1:-}"
deploy_dir="${2:-}"
stamp="${3:-}"

case "$cmd" in
  backup | swap | rollback) ;;
  "")
    echo "nas-swap: missing command" >&2
    usage
    exit 2
    ;;
  *)
    echo "nas-swap: unknown command '$cmd'" >&2
    usage
    exit 2
    ;;
esac

if [ -z "$deploy_dir" ]; then
  echo "nas-swap: missing deploy dir argument" >&2
  usage
  exit 2
fi

if ! [[ "$stamp" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
  echo "nas-swap: stamp '$stamp' does not match YYYYMMDD-HHMMSS; create it once with STAMP=\$(date +%Y%m%d-%H%M%S) on the Mac and reuse that exact value" >&2
  usage
  exit 2
fi

DOCKER="${DOCKER:-/usr/bin/docker}"
compose_up() {
  "$DOCKER" compose -f compose.truenas.yaml up -d --force-recreate
}

[ -d "$deploy_dir" ] || die "deploy dir '$deploy_dir' does not exist"
cd "$deploy_dir"
[ -f compose.truenas.yaml ] || die "no compose.truenas.yaml in '$deploy_dir'; is that the deploy dir?"

case "$cmd" in
  backup)
    [ -d dist/client ] || die "dist/client/ not found; nothing to back up"
    [ ! -e "dist/client.bak-$stamp" ] || die "dist/client.bak-$stamp already exists; use a new stamp"
    cp -a dist/client "dist/client.bak-$stamp"
    cp -a compose.truenas.yaml "compose.truenas.yaml.bak-$stamp"
    if [ -f deploy/nginx.conf ]; then
      cp -a deploy/nginx.conf "deploy/nginx.conf.bak-$stamp"
    fi
    echo "Backed up dist/client, compose.truenas.yaml and deploy/nginx.conf to *.bak-$stamp."
    ;;

  swap)
    new_dir="dist/client.new-$stamp"
    prev_dir="dist/client.prev-$stamp"
    [ -f "$new_dir/index.html" ] || die "$new_dir/index.html is missing; upload the new export first"
    [ -f "$new_dir/404.html" ] || die "$new_dir/404.html is missing; upload the new export first"
    [ -d dist/client ] || die "dist/client/ not found; run backup first"
    [ ! -e "$prev_dir" ] || die "$prev_dir already exists; roll back or remove it before swapping again"
    if [ -d deploy/nginx.conf ]; then
      die "deploy/nginx.conf is a directory (docker created it because the real file was missing); remove it and upload deploy/nginx.conf first"
    fi
    [ -f deploy/nginx.conf ] || die "deploy/nginx.conf is missing; upload deploy/ before swapping"

    mv dist/client "$prev_dir"
    if ! mv "$new_dir" dist/client; then
      mv "$prev_dir" dist/client
      die "moving $new_dir into place failed; restored the previous dist/client"
    fi
    if ! compose_up; then
      echo "nas-swap: docker compose failed; the new export is in dist/client but the container is not recreated." >&2
      echo "Roll back with:" >&2
      echo "  sudo bash deploy/nas-swap.sh rollback \"$deploy_dir\" $stamp" >&2
      exit 1
    fi
    echo "Swapped in $new_dir; the previous export is kept at $prev_dir."
    ;;

  rollback)
    prev_dir="dist/client.prev-$stamp"
    [ -d "$prev_dir" ] || die "$prev_dir not found; nothing to roll back to"
    if [ -e dist/client ]; then
      [ ! -e "dist/client.failed-$stamp" ] || die "dist/client.failed-$stamp already exists; remove it first"
      mv dist/client "dist/client.failed-$stamp"
    fi
    mv "$prev_dir" dist/client
    if [ -f "compose.truenas.yaml.bak-$stamp" ]; then
      cp -a "compose.truenas.yaml.bak-$stamp" compose.truenas.yaml
    fi
    if [ -f "deploy/nginx.conf.bak-$stamp" ]; then
      cp -a "deploy/nginx.conf.bak-$stamp" deploy/nginx.conf
    fi
    compose_up
    echo "Rolled back dist/client and configs to the $stamp backups."
    ;;
esac
