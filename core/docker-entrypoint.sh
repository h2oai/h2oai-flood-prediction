#!/usr/bin/env bash
set -euo pipefail

# Export variables from .env so both processes inherit them
if [ -f "/app/core/.env" ]; then
  # Export all variables defined in the .env file
  set -a
  # shellcheck disable=SC1091
  . /app/core/.env
  set +a
fi

# Map APP_* to library-expected env names if not already set
# This helps libraries like langchain_nvidia_ai_endpoints that look for NVIDIA_API_KEY
export_if_unset() {
  # usage: export_if_unset DEST_VAR SRC_VAR
  local dest=$1
  local src=$2
  if [ -z "${!dest:-}" ] && [ -n "${!src:-}" ]; then
    export "$dest=${!src}"
  fi
}

export_if_unset NVIDIA_API_KEY APP_NVIDIA_API_KEY
export_if_unset H2OGPTE_URL APP_H2OGPTE_URL
export_if_unset H2OGPTE_API_KEY APP_H2OGPTE_API_KEY
export_if_unset H2OGPTE_MODEL APP_H2OGPTE_MODEL

# Safe logging helper to avoid leaking full secrets
mask_val() {
  # Print first 3 and last 4 chars, mask the rest
  local v=$1
  local n=${#v}
  if [ $n -le 8 ]; then
    printf '%s' '****'
  else
    printf '%s' "${v:0:3}****${v: -4}"
  fi
}

echo "[entrypoint] Environment summary:"
echo "  APP_NVIDIA_API_KEY: ${APP_NVIDIA_API_KEY:+$(mask_val "$APP_NVIDIA_API_KEY")}"
echo "  NVIDIA_API_KEY    : ${NVIDIA_API_KEY:+$(mask_val "$NVIDIA_API_KEY")}"
echo "  APP_H2OGPTE_URL   : ${APP_H2OGPTE_URL:-}"
echo "  H2OGPTE_URL       : ${H2OGPTE_URL:-}"
echo "  APP_H2OGPTE_MODEL : ${APP_H2OGPTE_MODEL:-}"
echo "  H2OGPTE_MODEL     : ${H2OGPTE_MODEL:-}"
echo "  APP_H2OGPTE_API_KEY: ${APP_H2OGPTE_API_KEY:+$(mask_val "$APP_H2OGPTE_API_KEY")}"
echo "  H2OGPTE_API_KEY    : ${H2OGPTE_API_KEY:+$(mask_val "$H2OGPTE_API_KEY")}"
echo "  REDIS_ENABLED     : ${REDIS_ENABLED:-}"

# Quick Python-level checks to ensure venvs see the env
echo "[entrypoint] Python env checks (server venv):"
./venv/bin/python - <<'PY'
import os
def mask(s):
    if not s:
        return ''
    return (s[:3] + '****' + s[-4:]) if len(s) > 8 else '****'
print('  NVIDIA_API_KEY set:', bool(os.getenv('NVIDIA_API_KEY')), mask(os.getenv('NVIDIA_API_KEY','')))
print('  APP_NVIDIA_API_KEY set:', bool(os.getenv('APP_NVIDIA_API_KEY')), mask(os.getenv('APP_NVIDIA_API_KEY','')))
print('  H2OGPTE_URL:', os.getenv('H2OGPTE_URL',''))
print('  APP_H2OGPTE_URL:', os.getenv('APP_H2OGPTE_URL',''))
print('  REDIS_ENABLED:', os.getenv('REDIS_ENABLED',''))
PY

echo "[entrypoint] Python env checks (mcp venv):"
./venv-mcp/bin/python - <<'PY'
import os
def mask(s):
    if not s:
        return ''
    return (s[:3] + '****' + s[-4:]) if len(s) > 8 else '****'
print('  NVIDIA_API_KEY set:', bool(os.getenv('NVIDIA_API_KEY')), mask(os.getenv('NVIDIA_API_KEY','')))
print('  APP_NVIDIA_API_KEY set:', bool(os.getenv('APP_NVIDIA_API_KEY')), mask(os.getenv('APP_NVIDIA_API_KEY','')))
print('  H2OGPTE_URL:', os.getenv('H2OGPTE_URL',''))
print('  APP_H2OGPTE_URL:', os.getenv('APP_H2OGPTE_URL',''))
print('  REDIS_ENABLED:', os.getenv('REDIS_ENABLED',''))
PY

# Wait for Redis to be available (only when REDIS_ENABLED is truthy)
enabled_val="${REDIS_ENABLED:-}"
enabled_lc="${enabled_val,,}"
if [[ "$enabled_lc" == "true" || "$enabled_lc" == "1" || "$enabled_lc" == "yes" || "$enabled_lc" == "y" || "$enabled_lc" == "on" ]]; then
  REDIS_HOST_VAL="${REDIS_HOST:-127.0.0.1}"
  REDIS_PORT_VAL="${REDIS_PORT:-6379}"
  export REDIS_HOST_VAL REDIS_PORT_VAL
  echo "Waiting for Redis at ${REDIS_HOST_VAL}:${REDIS_PORT_VAL}";
  if command -v nc >/dev/null 2>&1; then
    echo "Using nc to check Redis connectivity";
    until nc -z "${REDIS_HOST_VAL}" "${REDIS_PORT_VAL}"; do
      echo "Redis not ready yet, sleeping...";
      sleep 2;
    done
  else
    echo "nc not found; falling back to Python socket check";
    until ./venv/bin/python - <<'PY'
import socket, os, sys
host = os.environ.get('REDIS_HOST_VAL', '127.0.0.1')
port = int(os.environ.get('REDIS_PORT_VAL', '6379'))
try:
    with socket.create_connection((host, port), timeout=2):
        sys.exit(0)
except Exception:
    sys.exit(1)
PY
    do
      echo "Redis not ready yet, sleeping...";
      sleep 2;
    done
  fi
  echo "Redis is up";
else
  echo "Redis wait skipped (REDIS_ENABLED=${REDIS_ENABLED:-})";
fi

# Start Redis Worker if Redis is enabled
enabled_val="${REDIS_ENABLED:-}"
enabled_lc="${enabled_val,,}"
if [[ "$enabled_lc" == "true" || "$enabled_lc" == "1" || "$enabled_lc" == "yes" || "$enabled_lc" == "y" || "$enabled_lc" == "on" ]]; then
  echo "[entrypoint] Starting RQ worker (requires Redis)"
  export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
  # Provide REDIS_URL to RQ CLI if host/port were set during readiness check
  if [[ -n "${REDIS_HOST_VAL:-}" && -n "${REDIS_PORT_VAL:-}" ]]; then
    export REDIS_URL="${REDIS_URL:-redis://${REDIS_HOST_VAL}:${REDIS_PORT_VAL}}"
  fi
  # Start the RQ worker via CLI (matches Makefile) in background and capture PID
  ./venv/bin/rq worker > /tmp/worker.log 2>&1 &
  WORKER_PID=$!
  echo "[entrypoint] Worker started with PID ${WORKER_PID} (logs: /tmp/worker.log)"
  # Brief health check: ensure process is alive
  sleep 2
  if kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    echo "[entrypoint] Worker health check: RUNNING"
  else
    echo "[entrypoint] Worker health check: FAILED to start. Recent logs:"
    tail -n 200 /tmp/worker.log || true
    # Continue without hard failing; API and MCP can still run
  fi
else
  echo "[entrypoint] Worker not started (REDIS_ENABLED=${REDIS_ENABLED:-})"
fi

# Start MCP server first
./venv-mcp/bin/python -m flood_prediction.agents.mcp_unified_flood_server &
MCP_PID=$!

# Give MCP a brief moment to initialize (optional, adjust if needed)
sleep 5

# Start FastAPI server with reload dirs as requested
exec ./venv/bin/uvicorn flood_prediction.server:app --host 0.0.0.0 --port 8000
  # --host 0.0.0.0 \
  # --port 8000
  # --reload \
  # --reload-dir src/flood_prediction/ \
  # --reload-dir src
