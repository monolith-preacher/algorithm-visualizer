#!/usr/bin/env bash
# Manages the Docker image used to compile, run and debug Playground programs.
#
#   scripts/sandbox.sh build     build the image (uses the layer cache)
#   scripts/sandbox.sh rebuild   rebuild from scratch (--no-cache --pull)
#   scripts/sandbox.sh status    show the image and any running sandbox containers
#   scripts/sandbox.sh clean     remove sandbox containers left behind
#   scripts/sandbox.sh remove    remove the image
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE="${AV_SANDBOX_IMAGE:-algoviz-sandbox:latest}"
LABEL="algoviz.sandbox=1"

case "${1:-build}" in
  build) docker build -t "$IMAGE" sandbox ;;
  rebuild) docker build --no-cache --pull -t "$IMAGE" sandbox ;;
  status)
    docker image inspect --format '{{.RepoTags}} {{.Created}} {{.Size}} bytes' "$IMAGE" || echo "image $IMAGE not built"
    docker ps --filter "label=$LABEL" --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
    ;;
  clean)
    ids=$(docker ps -aq --filter "label=$LABEL")
    if [[ -n "$ids" ]]; then docker rm -f $ids; else echo "no sandbox containers"; fi
    ;;
  remove) docker image rm "$IMAGE" ;;
  *) echo "usage: $0 {build|rebuild|status|clean|remove}" >&2; exit 2 ;;
esac
