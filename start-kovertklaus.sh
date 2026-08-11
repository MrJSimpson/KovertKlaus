#!/usr/bin/env bash
# ==============================================================================
# KovertKlaus 🕵️‍♂️🎄 — Linux Startup Script
# ==============================================================================
# Usage:
#   ./start-kovertklaus.sh [OPTIONS]
#   ./start.sh [OPTIONS]
#
# Options:
#   --dev        Start DB container & run Next.js dev server (Default)
#   --prod       Start full stack (DB + App) via Docker Compose
#   --detach,-d  Run dev server in background (logs to kovertklaus.log)
#   --open,-o    Open http://localhost:3000 in default browser upon startup
#   --help,-h    Show help message
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

# Parse flags
MODE="dev"
DETACH=false
OPEN_BROWSER=false

for arg in "$@"; do
  case $arg in
    --prod|--docker)
      MODE="prod"
      shift
      ;;
    --dev)
      MODE="dev"
      shift
      ;;
    --detach|-d)
      DETACH=true
      shift
      ;;
    --open|-o)
      OPEN_BROWSER=true
      shift
      ;;
    --help|-h)
      echo -e "${CYAN}${BOLD}KovertKlaus Startup Script${NC}"
      echo -e "Usage: ./start-kovertklaus.sh [options]"
      echo -e "Options:"
      echo -e "  --dev        Start DB container & run Next.js dev server (Default)"
      echo -e "  --prod       Start full stack (DB + App) via Docker Compose"
      echo -e "  --detach, -d Run dev server in background"
      echo -e "  --open, -o   Open http://localhost:3000 in default browser"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}${BOLD}"
echo "  _  _____  _____   _____ _____ _____ _  ___        _   _  _____ "
echo " | |/ / _ \|  __ \ / ____|  __ \_   _| |/ / |      / \ | |/ ____|"
echo " | ' / | | | |__) | |__  | |__) || | | ' /| |     /  \ | | (___  "
echo " |  <| | | |  _  /|  __| |  ___/ | | |  < | |    / /\ \| |\___ \ "
echo " | . \ |_| | | \ \| |____| |    _| |_| . \| |___/ ____ \ |____) |"
echo " |_|\_\___/|_|  \_\______|_|   |_____|_|\_\_____/_/    \_\_____/ "
echo -e "${NC}"
echo -e "${CYAN}🕵️‍♂️🎄 Stealth Intelligence Gift Exchange Network${NC}\n"

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Docker daemon is not running or current user lacks permissions.${NC}"
  echo -e "${YELLOW}Please start Docker (e.g. 'sudo systemctl start docker') and retry.${NC}"
  exit 1
fi

if [ "$MODE" = "prod" ]; then
  echo -e "${GREEN}[+] Launching full KovertKlaus stack in Production Docker mode...${NC}"
  docker compose up -d --build
  echo -e "${GREEN}[✔] Container stack operational!${NC}"
  echo -e "${CYAN}📍 Application URL: ${BOLD}http://localhost:3000${NC}"
  if [ "$OPEN_BROWSER" = true ]; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# Development Mode Workflow
echo -e "${GREEN}[1/4] Starting PostgreSQL database container (kovertklaus-db)...${NC}"
docker compose up -d kovertklaus-db

echo -e "${GREEN}[2/4] Waiting for PostgreSQL database to be healthy...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
until docker compose exec kovertklaus-db pg_isready -U kovert -d kovertklaus >/dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo -e "${RED}[ERROR] Timed out waiting for PostgreSQL container to start.${NC}"
  exit 1
fi
echo -e "${GREEN}[✔] Database is healthy and listening on port 5432.${NC}"

echo -e "${GREEN}[3/4] Running Prisma schema sync & client generation...${NC}"
npx prisma db push
npx prisma generate >/dev/null

echo -e "${GREEN}[4/4] Starting Next.js development server...${NC}"

if [ "$DETACH" = true ]; then
  echo -e "${YELLOW}[!] Launching in background mode. Logs: kovertklaus.log${NC}"
  nohup npx next dev > kovertklaus.log 2>&1 & disown
  DEV_PID=$!
  echo $DEV_PID > .kovertklaus.pid
  echo -e "${GREEN}[✔] Next.js dev server started (PID: ${DEV_PID})${NC}"
  echo -e "${CYAN}📍 Application URL: ${BOLD}http://localhost:3000${NC}"
  echo -e "${CYAN}📄 View logs: ${BOLD}tail -f kovertklaus.log${NC}"
  echo -e "${CYAN}🛑 Stop service: ${BOLD}./stop-kovertklaus.sh${NC}"

  if [ "$OPEN_BROWSER" = true ]; then
    sleep 2
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
else
  echo -e "${CYAN}📍 Application URL: ${BOLD}http://localhost:3000${NC}"
  echo -e "${CYAN}🛑 Press Ctrl+C to stop dev server (or run ./stop-kovertklaus.sh in another terminal)${NC}\n"
  
  if [ "$OPEN_BROWSER" = true ]; then
    (sleep 2 && xdg-open "http://localhost:3000" >/dev/null 2>&1) &
  fi

  npx next dev
fi
