#!/bin/bash

# Flood Prediction Blueprint - Service Startup Script
# This script starts all required services for the flood prediction application

set -e

NOTEBOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$NOTEBOOK_DIR/.." && pwd)"
CORE_DIR="$PROJECT_ROOT/core"

echo "========================================="
echo "Flood Prediction Services Startup"
echo "========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if nc -z localhost $1 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    echo -e "${YELLOW}⏳ Waiting for $service_name to start on port $port...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    echo -e "${RED}❌ $service_name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Check if required environment variables are set
if [ -z "$NVIDIA_API_KEY" ]; then
    echo -e "${RED}❌ Error: NVIDIA_API_KEY environment variable is not set${NC}"
    echo "Please set it with: export NVIDIA_API_KEY=<your-key>"
    exit 1
fi

# Check if virtual environments exist (check both notebook and core directories)
VENV_DIR=""
VENV_MCP_DIR=""

if [ -d "$NOTEBOOK_DIR/venv" ]; then
    VENV_DIR="$NOTEBOOK_DIR/venv"
elif [ -d "$CORE_DIR/venv" ]; then
    VENV_DIR="$CORE_DIR/venv"
else
    echo -e "${RED}❌ Error: venv not found. Please run './notebooks/setup-venvs.sh' or 'make setup' first${NC}"
    exit 1
fi

if [ -d "$NOTEBOOK_DIR/venv-mcp" ]; then
    VENV_MCP_DIR="$NOTEBOOK_DIR/venv-mcp"
elif [ -d "$CORE_DIR/venv-mcp" ]; then
    VENV_MCP_DIR="$CORE_DIR/venv-mcp"
else
    echo -e "${RED}❌ Error: venv-mcp not found. Please run './notebooks/setup-venvs.sh' or 'make setup-mcp' first${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using venv from: $VENV_DIR${NC}"
echo -e "${GREEN}✅ Using venv-mcp from: $VENV_MCP_DIR${NC}"

# Create logs directory if it doesn't exist
mkdir -p "$NOTEBOOK_DIR/logs"

echo -e "${YELLOW}📦 Starting services...${NC}"
echo ""

# 1. Start Redis (if not already running)
echo "1️⃣  Starting Redis server..."
if check_port 6379; then
    echo -e "${GREEN}✅ Redis already running on port 6379${NC}"
else
    echo -e "${YELLOW}🚀 Starting Redis via Docker...${NC}"
    docker run -d -p 6379:6379 --name flood-redis redis >/dev/null 2>&1 || true
    wait_for_service 6379 "Redis"
fi
echo ""

# 2. Start MCP Server
echo "2️⃣  Starting MCP Server..."
if check_port 8001; then
    echo -e "${YELLOW}⚠️  Port 8001 already in use. Stopping existing MCP server...${NC}"
    pkill -f "mcp_unified_flood_server" || true
    sleep 2
fi

echo -e "${YELLOW}🚀 Starting MCP server on port 8001...${NC}"
export NVIDIA_API_KEY=$NVIDIA_API_KEY
if [ -d "$CORE_DIR" ]; then
    cd "$CORE_DIR"
    nohup "$VENV_MCP_DIR/bin/python3" -m flood_prediction.agents.mcp_unified_flood_server > "$NOTEBOOK_DIR/logs/mcp-server.log" 2>&1 &
    MCP_PID=$!
    cd "$PROJECT_ROOT"
else
    cd "$NOTEBOOK_DIR"
    nohup "$VENV_MCP_DIR/bin/python3" -m flood_prediction.agents.mcp_unified_flood_server > "$NOTEBOOK_DIR/logs/mcp-server.log" 2>&1 &
    MCP_PID=$!
fi
echo $MCP_PID > "$NOTEBOOK_DIR/mcp-server.pid"

wait_for_service 8001 "MCP Server"
echo ""

# 3. Start RQ Workers
echo "3️⃣  Starting RQ Workers..."
echo -e "${YELLOW}🚀 Starting background worker...${NC}"
if [ -d "$CORE_DIR" ]; then
    cd "$CORE_DIR"
    nohup env OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES "$VENV_DIR/bin/rq" worker > "$NOTEBOOK_DIR/logs/worker.log" 2>&1 &
    WORKER_PID=$!
    cd "$PROJECT_ROOT"
else
    cd "$NOTEBOOK_DIR"
    nohup env OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES "$VENV_DIR/bin/rq" worker > "$NOTEBOOK_DIR/logs/worker.log" 2>&1 &
    WORKER_PID=$!
fi
echo $WORKER_PID > "$NOTEBOOK_DIR/worker.pid"
echo -e "${GREEN}✅ RQ Worker started (PID: $WORKER_PID)${NC}"
echo ""

# 4. Start FastAPI Server
echo "4️⃣  Starting FastAPI Server..."
if check_port 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 already in use. Stopping existing server...${NC}"
    pkill -f "uvicorn flood_prediction.server:app" || true
    sleep 2
fi

echo -e "${YELLOW}🚀 Starting FastAPI server on port 8000...${NC}"
export NVIDIA_API_KEY=$NVIDIA_API_KEY
if [ -d "$CORE_DIR/src" ]; then
    # Full repo mode - use reload with src directory
    cd "$CORE_DIR"
    nohup "$VENV_DIR/bin/uvicorn" flood_prediction.server:app --reload --reload-dir src/flood_prediction/ --host 0.0.0.0 --port 8000 --reload-dir src > "$NOTEBOOK_DIR/logs/server.log" 2>&1 &
    SERVER_PID=$!
    cd "$PROJECT_ROOT"
else
    # Standalone mode - no reload
    cd "$NOTEBOOK_DIR"
    nohup "$VENV_DIR/bin/uvicorn" flood_prediction.server:app --host 0.0.0.0 --port 8000 > "$NOTEBOOK_DIR/logs/server.log" 2>&1 &
    SERVER_PID=$!
fi
echo $SERVER_PID > "$NOTEBOOK_DIR/server.pid"

wait_for_service 8000 "FastAPI Server"
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}✅ All Services Started Successfully!${NC}"
echo "========================================="
echo ""
echo "Service Status:"
echo "  🔴 Redis:        http://localhost:6379"
echo "  🟣 MCP Server:   http://localhost:8001"
echo "  🟢 RQ Worker:    Running (PID: $WORKER_PID)"
echo "  🔵 FastAPI:      http://localhost:8000"
echo ""
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "To stop all services, run:"
echo "  ./notebooks/stop.sh"
echo ""
echo "Log files:"
echo "  MCP Server: notebooks/logs/mcp-server.log"
echo "  Worker:     notebooks/logs/worker.log"
echo "  Server:     notebooks/logs/server.log"
echo ""
echo "========================================="
