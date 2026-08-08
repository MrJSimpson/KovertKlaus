#!/usr/bin/env bash
# ==============================================================================
# KovertKlaus 🕵️‍♂️🎄 — Linux Shutdown Script
# ==============================================================================
# Usage:
#   ./stop-kovertklaus.sh
#   ./stop.sh
# ==============================================================================

set -e

# Resolve project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}🛑 Stopping KovertKlaus Services...${NC}\n"

# 1. Stop background Next.js dev process if PID exists
if [ -f .kovertklaus.pid ]; then
  PID=$(cat .kovertklaus.pid)
  if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}[-] Terminating background Next.js server (PID: ${PID})...${NC}"
    kill -15 "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f .kovertklaus.pid
fi

# 2. Terminate any remaining process running on port 3000
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp >/dev/null 2>&1 || true
elif command -v lsof >/dev/null 2>&1; then
  LSOF_PID=$(lsof -ti:3000 || true)
  if [ -n "$LSOF_PID" ]; then
    echo -e "${YELLOW}[-] Terminating process on port 3000 (PID: ${LSOF_PID})...${NC}"
    kill -9 $LSOF_PID 2>/dev/null || true
  fi
fi

# 3. Stop Docker Containers
echo -e "${YELLOW}[-] Stopping Docker containers...${NC}"
docker compose stop

echo -e "${GREEN}${BOLD}[✔] All KovertKlaus services stopped cleanly.${NC}\n"
