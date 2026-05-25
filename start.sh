#!/bin/bash
# ============================================================
# VAAHAN AI — One-command startup script
# Usage:  ./start.sh           (normal start)
#         ./start.sh --fresh   (reset everything + reseed)
#         ./start.sh --stop    (stop all services)
#         ./start.sh --status  (check what's running)
# ============================================================

set -e
COMPOSE="docker compose"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC}  $1"; }
warn() { echo -e "${YELLOW}[..] $1${NC}"; }
err()  { echo -e "${RED}[ERR] $1${NC}"; }
info() { echo -e "${BLUE}[-->]${NC} $1"; }

header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  VAAHAN AI — Automated Vehicle Enforcement Platform${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

check_docker() {
  if ! command -v docker &>/dev/null; then
    err "Docker is not installed. Install from https://docker.com"
    exit 1
  fi
  if ! docker info &>/dev/null; then
    err "Docker is not running. Start Docker Desktop first."
    exit 1
  fi
  log "Docker is running"
}

setup_env() {
  if [ ! -f .env ]; then
    warn ".env not found — creating from .env.example"
    cp .env.example .env

    # Generate random secrets so it works out of the box
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    DB_PASS=$(openssl rand -hex 16 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))")
    REDIS_PASS=$(openssl rand -hex 16 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))")

    # Replace placeholders
    sed -i.bak "s/your-256-bit-secret-key-here/$SECRET/g" .env
    sed -i.bak "s/your-jwt-secret-key-256-bits/$JWT_SECRET/g" .env
    sed -i.bak "s/strong-password-here/$DB_PASS/g" .env
    sed -i.bak "s/redis-password-here/$REDIS_PASS/g" .env
    # Update composed URLs
    sed -i.bak "s|enforcement_user:strong-password-here|enforcement_user:$DB_PASS|g" .env
    sed -i.bak "s|:redis-password-here@|:$REDIS_PASS@|g" .env
    rm -f .env.bak
    log ".env created with auto-generated secure keys"
  else
    log ".env already exists"
  fi
}

# ── Commands ──────────────────────────────────────────────

if [ "$1" = "--stop" ]; then
  header
  warn "Stopping all services..."
  $COMPOSE down
  log "All services stopped"
  exit 0
fi

if [ "$1" = "--status" ]; then
  header
  $COMPOSE ps
  echo ""
  info "Platform URLs:"
  echo "  Main Dashboard : http://localhost"
  echo "  API Docs       : http://localhost:8000/docs"
  echo "  Celery Monitor : http://localhost:5555"
  echo ""
  exit 0
fi

header

# 1. Checks
check_docker
setup_env

# 2. Fresh reset
if [ "$1" = "--fresh" ]; then
  warn "Fresh start — removing all volumes and containers..."
  $COMPOSE down -v --remove-orphans
  log "Reset complete"
fi

# 3. Build and start
warn "Starting all services (this may take 2-5 minutes on first run)..."
$COMPOSE up -d --build

# 4. Wait for healthy
info "Waiting for services to be healthy..."
for service in postgres redis; do
  echo -n "  Waiting for $service... "
  for i in {1..30}; do
    if $COMPOSE exec -T $service sh -c "exit 0" &>/dev/null; then
      echo "✓"
      break
    fi
    sleep 2
  done
done

# 5. Wait for backend
echo -n "  Waiting for backend API... "
for i in {1..30}; do
  if curl -sf http://localhost:8000/health &>/dev/null; then
    echo "✓"
    break
  fi
  sleep 3
done

# 6. Seed DB (only if fresh or no users)
USER_COUNT=$(docker exec enforcement-backend python3 -c "
import asyncio, os
os.environ.setdefault('SECRET_KEY','x'*32)
os.environ.setdefault('JWT_SECRET_KEY','x'*32)
async def count():
    from app.db.session import AsyncSessionFactory
    from sqlalchemy import text
    async with AsyncSessionFactory() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM users'))
        print(r.scalar_one())
asyncio.run(count())
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ] || [ "$1" = "--fresh" ]; then
  warn "Seeding database with test data..."
  docker exec enforcement-backend python scripts/seed_db.py
  log "Database seeded"
else
  log "Database already has data ($USER_COUNT users)"
fi

# 7. Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓  VAAHAN AI is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  🌐 Open in browser:  http://localhost"
echo "  📚 API Docs:         http://localhost:8000/docs"
echo "  📊 Task Monitor:     http://localhost:5555"
echo ""
echo "  🔑 Login credentials:"
echo "     Email:    admin@enforcement.gov"
echo "     Password: Admin@1234"
echo ""
echo "  📌 To stop:   ./start.sh --stop"
echo "  📌 To reset:  ./start.sh --fresh"
echo "  📌 Status:    ./start.sh --status"
echo ""
