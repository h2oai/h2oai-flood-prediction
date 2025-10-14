#!/bin/bash

# Flood Prediction Blueprint - Virtual Environment Setup Script
# This script creates both venv and venv-mcp for standalone notebook deployment
#
# Package Installation Priority:
#   1. Core directory (editable mode) - for development with full repo
#   2. Wheel file (bundled) - for standalone notebook deployment
#   3. Skip if neither available - warn user
#
# Usage: ./notebooks/setup-venvs.sh

set -e

NOTEBOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$NOTEBOOK_DIR/.." && pwd)"
CORE_DIR="$PROJECT_ROOT/core"

echo "========================================="
echo "Flood Prediction Virtual Environment Setup"
echo "========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python 3.11 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Error: python3 not found${NC}"
    echo "Please install Python 3.11 first"
    exit 1
fi

echo -e "${YELLOW}📦 Python 3.11 found: $(python3 --version)${NC}"
echo ""

# Function to setup venv-mcp
setup_venv_mcp() {
    echo "1️⃣  Setting up venv-mcp..."
    echo -e "${YELLOW}🔨 Creating venv-mcp virtual environment...${NC}"

    cd "$NOTEBOOK_DIR"

    # Remove existing venv-mcp if it exists
    if [ -d "venv-mcp" ]; then
        echo -e "${YELLOW}⚠️  Removing existing venv-mcp...${NC}"
        rm -rf venv-mcp
    fi

    # Create venv-mcp
    python3 -m venv venv-mcp

    # Upgrade pip
    echo -e "${YELLOW}📦 Upgrading pip...${NC}"
    ./venv-mcp/bin/python3 -m pip install --upgrade pip

    # Install requirements
    echo -e "${YELLOW}📦 Installing requirements-mcp.txt...${NC}"
    ./venv-mcp/bin/python3 -m pip install -r requirements-mcp.txt

    # Install flood_prediction package
    if [ -d "$CORE_DIR/src" ]; then
        echo -e "${YELLOW}📦 Installing flood_prediction package from core (editable mode)...${NC}"
        cd "$CORE_DIR"
        "$NOTEBOOK_DIR/venv-mcp/bin/python3" -m pip install -e .
        cd "$NOTEBOOK_DIR"
    elif [ -f "$NOTEBOOK_DIR/flood_prediction-0.1.0-py3-none-any.whl" ]; then
        echo -e "${YELLOW}📦 Installing flood_prediction package from wheel file...${NC}"
        "$NOTEBOOK_DIR/venv-mcp/bin/python3" -m pip install "$NOTEBOOK_DIR/flood_prediction-0.1.0-py3-none-any.whl"
    else
        echo -e "${YELLOW}⚠️  flood_prediction package not found (neither core directory nor wheel file)${NC}"
    fi

    echo -e "${GREEN}✅ venv-mcp setup complete!${NC}"
    echo ""
}

# Function to setup venv
setup_venv() {
    echo "2️⃣  Setting up venv..."
    echo -e "${YELLOW}🔨 Creating venv virtual environment...${NC}"

    cd "$NOTEBOOK_DIR"

    # Remove existing venv if it exists
    if [ -d "venv" ]; then
        echo -e "${YELLOW}⚠️  Removing existing venv...${NC}"
        rm -rf venv
    fi

    # Create venv
    python3 -m venv venv

    # Upgrade pip and install build tools
    echo -e "${YELLOW}📦 Upgrading pip and installing build tools...${NC}"
    ./venv/bin/python3 -m pip install --upgrade pip wheel build twine tomli pyright pytest pytest-cov black[colorama]

    # Install requirements
    echo -e "${YELLOW}📦 Installing requirements.txt...${NC}"
    ./venv/bin/python3 -m pip install -r requirements.txt

    # Install flood_prediction package
    if [ -d "$CORE_DIR/src" ]; then
        echo -e "${YELLOW}📦 Installing flood_prediction package from core (editable mode)...${NC}"
        cd "$CORE_DIR"
        "$NOTEBOOK_DIR/venv/bin/python3" -m pip install -e .
        cd "$NOTEBOOK_DIR"
    elif [ -f "$NOTEBOOK_DIR/flood_prediction-0.1.0-py3-none-any.whl" ]; then
        echo -e "${YELLOW}📦 Installing flood_prediction package from wheel file...${NC}"
        "$NOTEBOOK_DIR/venv/bin/python3" -m pip install "$NOTEBOOK_DIR/flood_prediction-0.1.0-py3-none-any.whl"
    else
        echo -e "${YELLOW}⚠️  flood_prediction package not found (neither core directory nor wheel file)${NC}"
    fi

    echo -e "${GREEN}✅ venv setup complete!${NC}"
    echo ""
}

# Setup both environments
setup_venv_mcp
setup_venv

# Summary
echo "========================================="
echo -e "${GREEN}✅ All Virtual Environments Created!${NC}"
echo "========================================="
echo ""
echo "Virtual Environments:"
echo "  📦 venv-mcp:  $NOTEBOOK_DIR/venv-mcp"
echo "  📦 venv:      $NOTEBOOK_DIR/venv"
echo ""
echo "To activate venv-mcp:"
echo "  source $NOTEBOOK_DIR/venv-mcp/bin/activate"
echo ""
echo "To activate venv:"
echo "  source $NOTEBOOK_DIR/venv/bin/activate"
echo ""
echo "You can now run the services with:"
echo "  ./notebooks/run.sh"
echo ""
echo "========================================="
