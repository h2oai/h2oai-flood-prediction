#!/bin/bash

# Flood Prediction Blueprint - Service Shutdown Script
# This script stops all running services

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOTEBOOKS_DIR="$PROJECT_ROOT/notebooks"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "Flood Prediction Services Shutdown"
echo "========================================="
echo ""

# Stop FastAPI Server
if [ -f "$NOTEBOOKS_DIR/server.pid" ]; then
    SERVER_PID=$(cat "$NOTEBOOKS_DIR/server.pid")
    echo -e "${YELLOW}🛑 Stopping FastAPI Server (PID: $SERVER_PID)...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    rm "$NOTEBOOKS_DIR/server.pid"
    echo -e "${GREEN}✅ FastAPI Server stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No FastAPI Server PID file found${NC}"
    pkill -f "uvicorn flood_prediction.server:app" 2>/dev/null || true
fi

# Stop RQ Worker
if [ -f "$NOTEBOOKS_DIR/worker.pid" ]; then
    WORKER_PID=$(cat "$NOTEBOOKS_DIR/worker.pid")
    echo -e "${YELLOW}🛑 Stopping RQ Worker (PID: $WORKER_PID)...${NC}"
    kill $WORKER_PID 2>/dev/null || true
    rm "$NOTEBOOKS_DIR/worker.pid"
    echo -e "${GREEN}✅ RQ Worker stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No RQ Worker PID file found${NC}"
    pkill -f "rq worker" 2>/dev/null || true
fi

# Stop MCP Server
if [ -f "$NOTEBOOKS_DIR/mcp-server.pid" ]; then
    MCP_PID=$(cat "$NOTEBOOKS_DIR/mcp-server.pid")
    echo -e "${YELLOW}🛑 Stopping MCP Server (PID: $MCP_PID)...${NC}"
    kill $MCP_PID 2>/dev/null || true
    rm "$NOTEBOOKS_DIR/mcp-server.pid"
    echo -e "${GREEN}✅ MCP Server stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No MCP Server PID file found${NC}"
    pkill -f "mcp_unified_flood_server" 2>/dev/null || true
fi

# Stop Redis
echo -e "${YELLOW}🛑 Stopping Redis...${NC}"
docker stop flood-redis 2>/dev/null || true
docker rm flood-redis 2>/dev/null || true
echo -e "${GREEN}✅ Redis stopped${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}✅ All Services Stopped${NC}"
echo "========================================="
