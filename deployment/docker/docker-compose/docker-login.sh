#!/bin/bash

# ==============================================================================
# Docker Registry Authentication Script
# ==============================================================================
# This script authenticates Docker with private registries and pulls all
# required images for the flood prediction application.
#
# Features:
#   - Supports multiple registries with different credentials
#   - Sequential login→pull ensures each image is pulled with correct credentials
#   - Interactive mode for missing credentials
#   - Handles public images automatically
#
# Usage:
#   1. Set credentials in .env file (recommended):
#      ./docker-login.sh
#
#   2. Or pass credentials as environment variables:
#      WEB_REGISTRY_USER=user WEB_REGISTRY_PASS=pass ./docker-login.sh
#
#   3. Or run interactively (will prompt for credentials):
#      ./docker-login.sh --interactive
#
# After successful execution:
#   docker-compose up -d
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running. Please start Docker and try again."
    exit 1
fi

# Load .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
    log_info "Loading environment variables from .env file"
    # Export variables from .env, ignoring comments, empty lines, and readonly variables (UID, GID)
    set -a
    source <(grep -v '^#' "${ENV_FILE}" | grep -v '^$' | grep -v '^UID=' | grep -v '^GID=' | sed 's/\r$//')
    set +a
else
    log_warn ".env file not found at ${ENV_FILE}"
    log_warn "You can copy .env.example to .env and fill in your credentials"
fi

# Parse command line arguments
INTERACTIVE=false
if [[ "$1" == "--interactive" ]] || [[ "$1" == "-i" ]]; then
    INTERACTIVE=true
fi

# Function to prompt for credentials
prompt_credentials() {
    local registry_name="$1"
    local url_var="$2"
    local user_var="$3"
    local pass_var="$4"

    echo ""
    log_info "Enter credentials for ${registry_name}"

    if [[ -z "${!url_var}" ]]; then
        read -p "Registry URL (e.g., registry.example.com): " ${url_var}
    fi

    if [[ -z "${!user_var}" ]]; then
        read -p "Username: " ${user_var}
    fi

    if [[ -z "${!pass_var}" ]]; then
        read -s -p "Password: " ${pass_var}
        echo ""  # New line after hidden password input
    fi
}

# Function to perform docker login
docker_login_registry() {
    local registry_name="$1"
    local registry_url="$2"
    local registry_user="$3"
    local registry_pass="$4"

    if [[ -z "${registry_url}" ]]; then
        log_warn "No registry URL specified for ${registry_name}, skipping"
        return 0
    fi

    if [[ -z "${registry_user}" ]] || [[ -z "${registry_pass}" ]]; then
        if [[ "${INTERACTIVE}" == true ]]; then
            log_warn "Credentials not found for ${registry_name}"
            prompt_credentials "${registry_name}" "registry_url" "registry_user" "registry_pass"
        else
            log_error "Missing credentials for ${registry_name}"
            log_error "Please set ${registry_name}_REGISTRY_USER and ${registry_name}_REGISTRY_PASS"
            return 1
        fi
    fi

    log_info "Authenticating with ${registry_name} (${registry_url})..."

    if echo "${registry_pass}" | docker login "${registry_url}" -u "${registry_user}" --password-stdin &> /dev/null; then
        log_success "Successfully authenticated with ${registry_name}"
        return 0
    else
        log_error "Failed to authenticate with ${registry_name}"
        return 1
    fi
}

# Function to pull a Docker image
pull_image() {
    local service_name="$1"
    local full_image="$2"

    log_info "Pulling ${service_name} image: ${full_image}"

    if docker pull "${full_image}"; then
        log_success "Successfully pulled ${service_name} image"
        return 0
    else
        log_error "Failed to pull ${service_name} image: ${full_image}"
        return 1
    fi
}

# ==============================================================================
# Main authentication flow
# ==============================================================================

echo ""
echo "=============================================================================="
echo "Docker Registry Authentication for H2O.ai Flood Prediction"
echo "=============================================================================="
echo ""

# Extract registry URLs from image registry variables
# Default to the registry value if no explicit URL is set
WEB_REGISTRY_URL="${WEB_REGISTRY_URL:-${WEB_IMAGE_REGISTRY}}"
NOTEBOOK_REGISTRY_URL="${NOTEBOOK_REGISTRY_URL:-${NOTEBOOK_IMAGE_REGISTRY}}"

# Build full image names
WEB_IMAGE="${WEB_IMAGE_REGISTRY}/${WEB_IMAGE_REPOSITORY}:${WEB_IMAGE_TAG}"
NOTEBOOK_IMAGE="${NOTEBOOK_IMAGE_REGISTRY}/${NOTEBOOK_IMAGE_REPOSITORY}:${NOTEBOOK_IMAGE_TAG}"
REDIS_IMAGE="${REDIS_IMAGE_REGISTRY}/${REDIS_IMAGE_REPOSITORY}:${REDIS_IMAGE_TAG}"

# Track success
SUCCESS_COUNT=0
FAILED_COUNT=0
PULL_COUNT=0

# Check if both images need authentication
WEB_NEEDS_AUTH=false
NOTEBOOK_NEEDS_AUTH=false

if [[ -n "${WEB_REGISTRY_URL}" ]] && [[ "${WEB_REGISTRY_URL}" != "docker.io" ]] && [[ -n "${WEB_REGISTRY_USER}" ]]; then
    WEB_NEEDS_AUTH=true
fi

if [[ -n "${NOTEBOOK_REGISTRY_URL}" ]] && [[ "${NOTEBOOK_REGISTRY_URL}" != "docker.io" ]] && [[ -n "${NOTEBOOK_REGISTRY_USER}" ]]; then
    NOTEBOOK_NEEDS_AUTH=true
fi

# Check if any registries need authentication
if [[ "${WEB_NEEDS_AUTH}" == false ]] && [[ "${NOTEBOOK_NEEDS_AUTH}" == false ]]; then
    log_info "No private registries detected or all registries use public access"
    log_info "If your images require authentication, please set:"
    log_info "  - WEB_REGISTRY_URL, WEB_REGISTRY_USER, WEB_REGISTRY_PASS"
    log_info "  - NOTEBOOK_REGISTRY_URL, NOTEBOOK_REGISTRY_USER, NOTEBOOK_REGISTRY_PASS"
    echo ""
    exit 0
fi

# ==============================================================================
# Sequential Login + Pull for All Images
# ==============================================================================
log_info "Starting authentication and image pull process"
echo ""

# Step 1: Login with web credentials and pull web image (if needed)
if [[ "${WEB_NEEDS_AUTH}" == true ]]; then
    if docker_login_registry "Web Image Registry" \
        "${WEB_REGISTRY_URL}" \
        "${WEB_REGISTRY_USER}" \
        "${WEB_REGISTRY_PASS}"; then
        ((SUCCESS_COUNT++))

        if pull_image "Web" "${WEB_IMAGE}"; then
            ((PULL_COUNT++))
        else
            ((FAILED_COUNT++))
        fi
    else
        ((FAILED_COUNT++))
    fi
    echo ""
fi

# Step 2: Login with notebook credentials and pull notebook image (if needed)
if [[ "${NOTEBOOK_NEEDS_AUTH}" == true ]]; then
    if docker_login_registry "Notebook Image Registry" \
        "${NOTEBOOK_REGISTRY_URL}" \
        "${NOTEBOOK_REGISTRY_USER}" \
        "${NOTEBOOK_REGISTRY_PASS}"; then
        ((SUCCESS_COUNT++))

        if pull_image "Notebook" "${NOTEBOOK_IMAGE}"; then
            ((PULL_COUNT++))
        else
            ((FAILED_COUNT++))
        fi
    else
        ((FAILED_COUNT++))
    fi
    echo ""
fi

# Step 3: Pull Redis image (no authentication needed for public registry)
if [[ "${REDIS_IMAGE_REGISTRY}" == "docker.io" ]] || [[ -z "${REDIS_IMAGE_REGISTRY}" ]]; then
    log_info "Pulling Redis image (public registry)"
    if pull_image "Redis" "${REDIS_IMAGE}"; then
        ((PULL_COUNT++))
    fi
    echo ""
fi

# Summary
echo ""
echo "=============================================================================="
echo "Authentication & Pull Summary"
echo "=============================================================================="
log_success "Successful logins: ${SUCCESS_COUNT}"
log_success "Images pulled: ${PULL_COUNT}"
if [[ ${FAILED_COUNT} -gt 0 ]]; then
    log_error "Failed operations: ${FAILED_COUNT}"
fi
echo ""

# Exit with appropriate code
if [[ ${FAILED_COUNT} -gt 0 ]]; then
    log_error "Some operations failed"
    log_error "Please check your credentials and try again"
    exit 1
else
    log_success "All images pulled successfully!"
    log_info "You can now start services with: docker-compose up -d"
    exit 0
fi
