# Usage Guide - Separate Docker Compose Files

This guide explains how to run services independently using separate compose files or docker run commands.

## Quick Reference

### Option A: Docker Compose (Recommended)

```bash
# Start base services (web + redis)
docker-compose -f docker-compose.yml up -d

# Start NIM LLM separately
docker-compose -f docker-compose.nimllm-standalone.yml up -d

# Stop services
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.nimllm-standalone.yml down
```

### Option B: Docker Run Commands

```bash
# Start base services
source .env && bash docker-run-commands.sh

# Start NIM LLM separately
source .env && bash docker-run-nimllm.sh

# Stop services
docker stop flood-prediction-web flood-prediction-redis
docker stop flood-prediction-nimllm
```

### Option C: Combined (Original - Still Works)

```bash
# Start everything together
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml up -d

# Stop everything
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml down
```

---

## Detailed Instructions

### Setup

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your API keys
   ```

2. **Login to NGC (only if using NIM LLM):**
   ```bash
   docker login nvcr.io
   # Username: $oauthtoken
   # Password: <Your NGC_API_KEY>
   ```

---

## Option A: Separate Docker Compose Files

### Base Services (Web + Redis)

**Start:**
```bash
cd deployment/docker-compose
docker-compose -f docker-compose.yml up -d
```

**Check status:**
```bash
docker-compose -f docker-compose.yml ps
```

**View logs:**
```bash
docker-compose -f docker-compose.yml logs -f
```

**Stop:**
```bash
docker-compose -f docker-compose.yml down
```

### NIM LLM Service (Standalone)

**Start:**
```bash
docker-compose -f docker-compose.nimllm-standalone.yml up -d
```

**Check status:**
```bash
docker-compose -f docker-compose.nimllm-standalone.yml ps
```

**View logs:**
```bash
docker-compose -f docker-compose.nimllm-standalone.yml logs -f
```

**Stop:**
```bash
docker-compose -f docker-compose.nimllm-standalone.yml down
```

### Connecting Web Service to NIM LLM

If you start NIM LLM separately, you need to update the web service to use it:

```bash
# Stop web service
docker-compose -f docker-compose.yml stop web

# Update web service with NIM LLM URL
docker-compose -f docker-compose.yml up -d web \
  -e NIM_LLM_BASE_URL=http://localhost:8989/v1
```

Or restart with the combined approach:
```bash
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml up -d
```

---

## Option B: Docker Run Commands

### Base Services

**Start all base services:**
```bash
source .env && bash docker-run-commands.sh
```

**Start individual services:**

**Redis:**
```bash
docker run -d \
  --name flood-prediction-redis \
  --restart unless-stopped \
  --network host \
  -v flood-prediction-redis-data:/data \
  redis:8.2.1 \
  redis-server --appendonly yes
```

**Web Application:**
```bash
# Source .env first
source .env

docker run -d \
  --name flood-prediction-web \
  --restart unless-stopped \
  --network host \
  -e NVIDIA_API_KEY="${NVIDIA_API_KEY}" \
  -e APP_NVIDIA_API_KEY="${NVIDIA_API_KEY}" \
  -e H2OGPTE_URL="${H2OGPTE_URL:-https://h2ogpte.cloud-dev.h2o.dev}" \
  -e H2OGPTE_MODEL="${H2OGPTE_MODEL:-claude-sonnet-4-20250514}" \
  -e H2OGPTE_API_KEY="${H2OGPTE_API_KEY}" \
  -e APP_H2OGPTE_URL="${H2OGPTE_URL:-https://h2ogpte.cloud-dev.h2o.dev}" \
  -e APP_H2OGPTE_MODEL="${H2OGPTE_MODEL:-claude-sonnet-4-20250514}" \
  -e APP_H2OGPTE_API_KEY="${H2OGPTE_API_KEY}" \
  -e REDIS_ENABLED=true \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  -e REDIS_URL=redis://localhost:6379 \
  -e PORT=8000 \
  ${WEB_IMAGE_REGISTRY:-h2oairelease}/${WEB_IMAGE_REPOSITORY:-h2oai-floodprediction-app}:${WEB_IMAGE_TAG:-v0.3.0}
```

### NIM LLM Service

**Start NIM LLM:**
```bash
source .env && bash docker-run-nimllm.sh
```

**Or manually:**
```bash
# Source .env first
source .env

docker run -d \
  --name flood-prediction-nimllm \
  --restart unless-stopped \
  --runtime nvidia \
  --network host \
  --shm-size 16gb \
  --user "1000:1000" \
  -e NGC_API_KEY="${NGC_API_KEY}" \
  -e NIM_HTTP_API_PORT=8989 \
  -v ~/.cache/nim:/opt/nim/.cache \
  nvcr.io/nim/nvidia/llama-3_3-nemotron-super-49b-v1_5:1.12.0
```

---

## Service Management

### Check Running Services

```bash
# All containers
docker ps

# Specific services
docker ps --filter "name=flood-prediction"
```

### View Logs

```bash
# Docker compose
docker-compose -f docker-compose.yml logs -f web
docker-compose -f docker-compose.nimllm-standalone.yml logs -f nimllm

# Docker run
docker logs -f flood-prediction-web
docker logs -f flood-prediction-redis
docker logs -f flood-prediction-nimllm
```

### Stop Services

```bash
# Docker compose
docker-compose -f docker-compose.yml stop
docker-compose -f docker-compose.nimllm-standalone.yml stop

# Docker run
docker stop flood-prediction-web
docker stop flood-prediction-redis
docker stop flood-prediction-nimllm
```

### Remove Services

```bash
# Docker compose (stops and removes containers)
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.nimllm-standalone.yml down

# Docker run
docker rm -f flood-prediction-web
docker rm -f flood-prediction-redis
docker rm -f flood-prediction-nimllm
```

### Remove Everything Including Volumes

```bash
# Docker compose
docker-compose -f docker-compose.yml down -v
docker-compose -f docker-compose.nimllm-standalone.yml down -v

# Docker run
docker rm -f flood-prediction-web flood-prediction-redis flood-prediction-nimllm
docker volume rm flood-prediction-redis-data
rm -rf ~/.cache/nim  # Warning: Deletes NIM model cache (~50GB)
```

---

## Access Points

Once services are running, they are accessible at:

| Service | URL | Port |
|---------|-----|------|
| Web Application | http://localhost:8000 | 8000 |
| NIM LLM API | http://localhost:8989/v1 | 8989 |
| Redis | localhost:6379 | 6379 |

### From External Jupyter Notebook

Since all services use host networking, your external Jupyter notebook can access them via:

```python
api_server_base_url = "http://localhost:8000"
nim_llm_base_url = "http://localhost:8989/v1"
```

---

## Troubleshooting

### Check Service Health

```bash
# Web API
curl http://localhost:8000/

# NIM LLM
curl http://localhost:8989/v1/models

# Redis
docker exec flood-prediction-redis redis-cli ping
```

### Port Conflicts

If you get port conflicts, check what's using the ports:

```bash
# Check if ports are in use
sudo netstat -tulpn | grep -E '8000|8989|6379'

# Or with lsof
sudo lsof -i :8000
sudo lsof -i :8989
sudo lsof -i :6379
```

### Container Won't Start

Check logs for errors:
```bash
docker logs flood-prediction-web
docker logs flood-prediction-redis
docker logs flood-prediction-nimllm
```

### NIM LLM Model Download

First-time startup downloads ~50GB model. Monitor progress:
```bash
docker logs -f flood-prediction-nimllm
```

---

## Files Overview

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base services (web + redis) - standalone |
| `docker-compose.nimllm.yml` | NIM LLM override (requires docker-compose.yml) |
| `docker-compose.nimllm-standalone.yml` | NIM LLM standalone (independent) |
| `docker-run-commands.sh` | Script to start base services with docker run |
| `docker-run-nimllm.sh` | Script to start NIM LLM with docker run |
| `.env` | Environment variables (API keys, configuration) |
| `.env.example` | Template for .env file |

---

## Best Practices

1. **Always source .env before docker run commands:**
   ```bash
   source .env && bash docker-run-commands.sh
   ```

2. **Use docker-compose for easier management:**
   - Handles dependencies automatically
   - Easier to update and manage
   - Better for development

3. **Use docker run for fine-grained control:**
   - More explicit control over each container
   - Easier to debug individual services
   - Better for production automation

4. **Monitor resource usage:**
   ```bash
   docker stats
   ```

5. **Regular cleanup:**
   ```bash
   # Remove stopped containers
   docker container prune

   # Remove unused volumes
   docker volume prune
   ```
