#!/usr/bin/env bash
# Installs dependencies and builds everything needed to run Algorithm Visualizer
# locally on Ubuntu (22.04/24.04). Safe to run repeatedly.
#
#   scripts/setup.sh                 check prerequisites, install npm deps, build
#   scripts/setup.sh --system-deps   also apt-get install build-essential, gdb, make
set -euo pipefail

cd "$(dirname "$0")/.."

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*"; }
fail() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "${1:-}" == "--system-deps" ]]; then
  info "Installing system packages (sudo)"
  sudo apt-get update
  sudo apt-get install -y build-essential gdb make curl ca-certificates
fi

info "Checking prerequisites"
command -v gcc >/dev/null || fail "gcc not found. Run: sudo apt-get install build-essential (or scripts/setup.sh --system-deps)"
command -v make >/dev/null || fail "make not found. Run: sudo apt-get install make"
command -v node >/dev/null || fail "Node.js not found. Install Node 22 LTS, e.g. with nvm: nvm install 22"
node_major=$(node -p 'process.versions.node.split(".")[0]')
(( node_major >= 20 )) || fail "Node.js >= 20.19 required (found $(node -v))"

info "Installing npm dependencies"
npm install

info "Building the instrumented C library (clib/build/avlab, clib/build/avbench)"
make -C clib

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  info "Building the sandbox image (algoviz-sandbox:latest)"
  docker build -t algoviz-sandbox:latest sandbox
else
  warn "Docker is not available to this user. The Algorithm Lab works without it,"
  warn "but the C Playground needs Docker Engine. See README.md#docker."
fi

info "Done. Start the development servers with: npm run dev"
