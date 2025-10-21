# H2O.ai Flood Prediction - Docker Compose Deployment

This directory contains Docker Compose configuration for deploying the H2O.ai Flood Prediction application locally or on single-node infrastructure.

## Overview

The docker-compose setup provides a production-ready deployment with the following services:

- **Web Application**: FastAPI server with UI, MCP server, and Redis Queue worker
- **Redis**: Task queue and caching layer
- **NVIDIA NIM LLM** (optional): Local large language model inference
- **Jupyter Notebook** (disabled by default): Interactive demos and experimentation (see [Optional: Jupyter Notebook](#optional-jupyter-notebook) section)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Host Machine                         │
│                                                          │
│  ┌────────────┐  ┌─────────┐                           │
│  │    Web     │  │  Redis  │                           │
│  │  :8000     │◄─┤  :6379  │                           │
│  │            │  │         │                           │
│  │ • FastAPI  │  │ • Queue │                           │
│  │ • MCP      │  │ • Cache │                           │
│  │ • RQ Worker│  │         │                           │
│  └────────────┘  └─────────┘                           │
│        │                                                │
│        └──────────────┐                                │
│                       │                                │
│            ┌──────────▼────────┐                       │
│            │   NIM LLM         │ (optional)            │
│            │   :8989           │                       │
│            │                   │                       │
│            │ • GPU Inference   │                       │
│            │ • OpenAI API      │                       │
│            └───────────────────┘                       │
│                                                          │
│  Note: Jupyter Notebook (:8888) is disabled by default │
│        See "Optional: Jupyter Notebook" section         │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required

- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 1.29 or later (or Docker Compose V2)
- **API Keys**:
  - NVIDIA API Key (from [build.nvidia.com](https://build.nvidia.com/))
  - H2OGPTE API Key
  - Jupyter authentication token (generate yourself)

### Optional (for NIM LLM)

- **NVIDIA GPU**: CUDA-capable GPU with sufficient VRAM (24GB+ recommended)
- **NVIDIA Container Toolkit**: Installed and configured
- **NGC API Key**: From [ngc.nvidia.com](https://ngc.nvidia.com/)
- **Disk Space**: ~50GB+ for model cache
- **Docker Registry Access**: Login to `nvcr.io`

## Quick Start

### 1. Clone and Navigate

```bash
cd deployment/docker-compose
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

```bash
# Generate a secure Jupyter token
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit .env with your favorite editor
nano .env  # or vim, code, etc.
```

**Required environment variables:**
- `NVIDIA_API_KEY`: Your NVIDIA API key
- `H2OGPTE_API_KEY`: Your H2OGPTE API key
- `NGC_API_KEY`: Your NGC API key (only if using NIM LLM)

### 3. Authenticate with Private Registries (if needed)

If your web or notebook images are hosted in private Docker registries that require authentication, you need to login before pulling images.

#### Option 1: Using the provided login script (recommended)

Configure registry credentials in your `.env` file:

```bash
# Web image registry (if private)
WEB_REGISTRY_URL=registry.example.com
WEB_REGISTRY_USER=your-web-username
WEB_REGISTRY_PASS=your-web-password

# Notebook image registry (if private)
NOTEBOOK_REGISTRY_URL=registry.example.com  # Can be same as web registry
NOTEBOOK_REGISTRY_USER=your-notebook-username
NOTEBOOK_REGISTRY_PASS=your-notebook-password
```

Then run the authentication script:

```bash
./docker-login.sh
```

The script will:
1. Authenticate with web registry credentials → Pull web image
2. Authenticate with notebook registry credentials → Pull notebook image
3. Pull Redis image (public registry)

All images are automatically pulled by the script, so you can proceed directly to starting services.

#### Option 2: Manual docker login and pull

Alternatively, login and pull manually (recommended approach for same registry with different credentials):

```bash
# Login with web credentials and pull web image
docker login registry.example.com -u your-web-username -p your-web-password
docker pull registry.example.com/h2oai-floodprediction-app:v0.3.0

# Login with notebook credentials and pull notebook image
docker login registry.example.com -u your-notebook-username -p your-notebook-password
docker pull registry.example.com/h2oai-floodprediction-notebook:v0.3.0

# Pull Redis (public registry, no auth needed)
docker pull docker.io/redis:8.2.1
```

#### Skip this step if:
- You're using public registries (like `docker.io`)
- You're already logged into the required registries
- Your images don't require authentication

### 4. Start Services

```bash
# Start core services (web, redis, notebook)
docker-compose up -d

# OR start with NIM LLM enabled
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

**Note:** If you used the `docker-login.sh` script in step 3, all images are already pulled. If you skipped step 3 or used public registries, docker-compose will automatically pull images on first startup.

### 5. Access the Application

Once all services are healthy:

- **Web Application**: http://localhost:8000
- **NIM LLM API** (if enabled): http://localhost:8989/v1

### 6. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes Redis data and cache)
docker-compose down -v
```

## Service Details

### Web Application

**Image**: `h2oairelease/h2oai-floodprediction-app:v0.3.0`

**Port**: 8000

**Components**:
- FastAPI web server with React UI
- MCP (Model Context Protocol) server
- Redis Queue (RQ) worker for background jobs

**Health Check**: `GET http://localhost:8000/`

**Resource Limits**:
- CPU: 1-2 cores
- Memory: 1-2 GB

### Redis

**Image**: `redis:8.2.1`

**Port**: 6379 (internal only)

**Purpose**: Task queue and caching layer

**Persistence**: Volume mounted at `/data` with AOF (Append-Only File) enabled

**Health Check**: `redis-cli ping`

**Resource Limits**:
- CPU: 0.25-0.5 cores
- Memory: 256-512 MB

### Jupyter Notebook (Disabled by Default)

> ⚠️ **Note**: The Jupyter Notebook service is commented out in `docker-compose.yml` by default. To enable it, uncomment the `notebook` service section (lines 83-136) in the file. See [Optional: Jupyter Notebook](#optional-jupyter-notebook) for details.

**Image**: `h2oairelease/h2oai-floodprediction-notebook:v0.3.0`

**Port**: 8888

**Purpose**: Interactive demos, experimentation, and tutorials

**Authentication**: Token-based (configured via `JUPYTER_TOKEN`)

**Base URL**: `/jupyter` (configured to match Helm chart routing)

**Health Check**: `GET http://localhost:8888/jupyter`

**Resource Limits**:
- CPU: 1-2 cores
- Memory: 1-2 GB

### NVIDIA NIM LLM (Optional)

**Image**: `nvcr.io/nim/nvidia/llama-3_3-nemotron-super-49b-v1_5:1.12.0`

**Port**: 8989 (external), 8000 (internal)

**Purpose**: Local large language model inference with OpenAI-compatible API

**Requirements**:
- NVIDIA GPU with 24GB+ VRAM
- NVIDIA Container Toolkit
- NGC API key
- ~50GB disk space for model cache

See [Enabling NIM LLM](#enabling-nvidia-nim-llm) for setup instructions.

## Environment Variables

All configuration is managed through the `.env` file. Key variables:

### Required Secrets

| Variable | Description | Example |
|----------|-------------|---------|
| `NVIDIA_API_KEY` | NVIDIA API key for model endpoints | `nvapi-abc123...` |
| `H2OGPTE_API_KEY` | H2O GPT Enterprise API key | `h2ogpte-xyz789...` |
| `NGC_API_KEY` | NGC API key (required for NIM LLM) | `ngc-def456...` |
| `JUPYTER_TOKEN` | Jupyter authentication token (only if enabling notebook) | `generate with secrets.token_urlsafe(32)` |

### Service Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_PORT` | `8000` | Web application external port |
| `NIMLLM_PORT` | `8989` | NIM LLM external port |
| `NOTEBOOK_PORT` | `8888` | Jupyter notebook external port (only if notebook enabled) |
| `H2OGPTE_URL` | `https://h2ogpte.cloud-dev.h2o.dev` | H2OGPTE service URL |
| `H2OGPTE_MODEL` | `claude-sonnet-4-20250514` | H2OGPTE model to use |
| `REDIS_ENABLED` | `true` | Enable Redis queue/cache |

### Image Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_IMAGE_TAG` | `v0.3.0` | Web application image tag |
| `NOTEBOOK_IMAGE_TAG` | `v0.3.0` | Notebook image tag |
| `REDIS_IMAGE_TAG` | `8.2.1` | Redis image tag |

See `.env.example` for the complete list of variables.

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f redis
docker-compose logs -f nimllm  # if using NIM LLM

# Last 100 lines
docker-compose logs --tail=100 web
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart web
```

### Update Images

```bash
# For private registries with authentication, use the login script
./docker-login.sh

# For public registries or after authentication, pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d
```

**Note:** If using private registries with different credentials for web and notebook images, the `docker-login.sh` script will handle authentication and pulling automatically.

### Execute Commands in Containers

```bash
# Open shell in web container
docker-compose exec web bash

# Open shell in redis container
docker-compose exec redis sh

# Run Python in web container
docker-compose exec web ./venv/bin/python -c "import flood_prediction; print(flood_prediction.__version__)"
```

### Check Service Health

```bash
# View container status
docker-compose ps

# Check web application health
curl http://localhost:8000/

# Check NIM LLM health (if enabled)
curl http://localhost:8989/v1/models

# Check Redis
docker-compose exec redis redis-cli ping
```

### Scale Services (Advanced)

```bash
# Run multiple web workers (requires load balancer configuration)
docker-compose up -d --scale web=3

# Note: Redis should remain at 1 replica
```

## Enabling NVIDIA NIM LLM

To enable local LLM inference with NVIDIA NIM:

### 1. Install Prerequisites

**NVIDIA Container Toolkit** (Ubuntu/Debian):

```bash
# Add NVIDIA package repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
   && curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - \
   && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install nvidia-container-toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Restart Docker
sudo systemctl restart docker

# Verify GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### 2. Configure NGC Registry Access

Login to NVIDIA NGC Container Registry:

```bash
docker login nvcr.io
# Username: $oauthtoken
# Password: <Your NGC_API_KEY>
```

### 3. Set NGC API Key

Add your NGC API key to `.env`:

```bash
NGC_API_KEY=your-ngc-api-key-here
```

### 4. Configure Model Cache

The model cache requires ~50GB+ of disk space. By default, it uses `~/.cache/nim`:

```bash
# Create cache directory
mkdir -p ~/.cache/nim

# Or use a custom location in .env
LOCAL_NIM_CACHE=/path/to/large/disk/nim-cache
```

### 5. Start with NIM LLM Enabled

```bash
# Start all services including NIM LLM
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml up -d

# View NIM startup logs (model download may take 10-20 minutes)
docker-compose logs -f nimllm

# Check when model is loaded
curl http://localhost:8989/v1/models
```

### 6. Verify Integration

The web application will automatically use the NIM LLM when available:

```bash
# Check web service environment
docker-compose exec web env | grep NIM_LLM_BASE_URL
# Should show: NIM_LLM_BASE_URL=http://nimllm:8000/v1
```

### 7. Stop NIM LLM

```bash
# Stop all services including NIM
docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml down

# Or stop only NIM while keeping others running
docker stop flood-prediction-nimllm
```

## Troubleshooting

### Cannot Connect to Services

**Symptoms**: Connection refused or timeout errors

**Solutions**:
1. Check services are running: `docker-compose ps`
2. Check logs: `docker-compose logs -f`
3. Verify ports are not in use: `netstat -tulpn | grep -E '8000|6379|8989'`
4. Check firewall rules

### ImagePullBackOff / Image Pull Errors

**Symptoms**: Cannot pull images from registry

**Solutions**:
1. **For private registries**: Run the authentication and pull script:
   ```bash
   ./docker-login.sh
   ```
   This script will authenticate and automatically pull all images.

2. **Manual approach**: Login and pull each image individually:
   ```bash
   docker login registry.example.com -u username -p password
   docker pull registry.example.com/your-image:tag
   ```

3. Verify Docker registry credentials in `.env` file
4. Check if you're already logged in: `cat ~/.docker/config.json`
5. Check network connectivity to the registry
6. For NIM: Verify NGC credentials and access to `nvcr.io`

### Web Service CrashLoopBackOff

**Symptoms**: Web container repeatedly restarting

**Solutions**:
1. Check logs: `docker-compose logs web`
2. Verify API keys are set in `.env`
3. Check Redis connectivity: `docker-compose exec web nc -zv redis 6379`
4. Verify environment variables: `docker-compose exec web env | grep -E 'NVIDIA|H2OGPTE'`

### NIM LLM GPU Access Issues

**Symptoms**: NIM fails to start or doesn't detect GPU

**Solutions**:
1. Verify NVIDIA drivers: `nvidia-smi`
2. Check NVIDIA Container Toolkit: `docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi`
3. Verify Docker can access GPU: `docker-compose -f docker-compose.yml -f docker-compose.nimllm.yml config`
4. Check GPU memory: Ensure 24GB+ VRAM available

### NIM LLM Model Download Slow/Fails

**Symptoms**: NIM container taking very long to start or failing

**Solutions**:
1. Check disk space: `df -h` (need 50GB+ free)
2. Verify NGC API key: `echo $NGC_API_KEY`
3. Check NGC registry access: `docker pull nvcr.io/nim/nvidia/llama-3_3-nemotron-super-49b-v1_5:1.12.0`
4. Monitor download progress: `docker-compose logs -f nimllm`
5. Be patient: First-time model download can take 10-20 minutes

### Redis Connection Errors

**Symptoms**: Web service reports Redis connection failures

**Solutions**:
1. Check Redis is running: `docker-compose ps redis`
2. Verify Redis health: `docker-compose exec redis redis-cli ping`
3. Check network: `docker network inspect flood-prediction-network`
4. Disable Redis if not needed: Set `REDIS_ENABLED=false` in `.env`

### Out of Memory Errors

**Symptoms**: Containers killed or OOM messages in logs

**Solutions**:
1. Check Docker resources: `docker stats`
2. Increase Docker memory limits (Docker Desktop settings)
3. Reduce resource limits in `docker-compose.yml`
4. For NIM: Ensure sufficient system RAM (32GB+ recommended)

### Permission Denied on NIM Cache

**Symptoms**: NIM LLM fails with permission errors on `/opt/nim/.cache`

**Solutions**:
1. Check cache directory ownership: `ls -la ~/.cache/nim`
2. Set correct UID/GID in `.env`: `UID=$(id -u)` and `GID=$(id -g)`
3. Fix permissions: `sudo chown -R $(id -u):$(id -g) ~/.cache/nim`

## Security Best Practices

1. **Never commit `.env` to version control**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as template

2. **Use strong, random tokens**
   ```bash
   # Generate secure tokens
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

3. **Rotate secrets regularly**
   - Update API keys periodically
   - Change Jupyter token monthly

4. **Limit exposure**
   - Don't expose ports publicly without authentication
   - Use reverse proxy (nginx, traefik) with TLS in production
   - Consider firewall rules

5. **Keep images updated**
   ```bash
   # Regular updates
   docker-compose pull
   docker-compose up -d
   ```

6. **Use least privilege**
   - Run containers as non-root when possible
   - Limit network access between containers

7. **Monitor logs**
   - Regular log review for suspicious activity
   - Set up log aggregation for production

## Comparison with Helm Deployment

| Feature | Docker Compose | Helm Chart |
|---------|----------------|------------|
| **Target Environment** | Single-node, local dev | Kubernetes clusters |
| **Complexity** | Low | Medium-High |
| **Scalability** | Limited | High (horizontal scaling) |
| **High Availability** | No | Yes (multi-replica) |
| **Load Balancing** | Manual | Automatic (Service/Ingress) |
| **Service Discovery** | Docker DNS | Kubernetes DNS |
| **Health Checks** | Docker healthcheck | Readiness/Liveness probes |
| **Secrets Management** | .env file | Kubernetes Secrets |
| **Persistence** | Docker volumes | PersistentVolumeClaims |
| **Networking** | Bridge network | CNI (Calico, Flannel, etc.) |
| **Ingress** | Manual (nginx, traefik) | Ingress Controller |
| **Best For** | Local dev, testing, small deployments | Production, multi-node clusters |

### When to Use Docker Compose

- Local development and testing
- Single-node deployments
- Simple infrastructure
- Quick prototyping
- Learning and experimentation

### When to Use Helm/Kubernetes

- Production deployments
- Multi-node clusters
- High availability requirements
- Horizontal scaling needs
- Advanced networking and service mesh
- Enterprise infrastructure

## Advanced Configuration

### Custom Networks

To integrate with existing Docker networks:

```yaml
# docker-compose.override.yml
networks:
  flood-prediction-network:
    external: true
    name: my-existing-network
```

### External Redis

To use an external Redis instance:

```bash
# In .env
REDIS_ENABLED=true
REDIS_HOST=my-redis-server.example.com
REDIS_PORT=6379
REDIS_URL=redis://my-redis-server.example.com:6379
```

```yaml
# docker-compose.override.yml
services:
  web:
    depends_on: []  # Remove Redis dependency
```

### Custom Image Registry

To use a private registry:

```bash
# In .env
WEB_IMAGE_REGISTRY=my-registry.example.com
WEB_IMAGE_REPOSITORY=h2oai/flood-prediction
WEB_IMAGE_TAG=custom-v1.0.0
```

### TLS/HTTPS

For production with TLS, use a reverse proxy:

```yaml
# docker-compose.proxy.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - web
```

## Maintenance

### Backup Redis Data

```bash
# Backup Redis AOF file
docker-compose exec redis redis-cli BGSAVE
docker cp flood-prediction-redis:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

### Cleanup Unused Resources

```bash
# Remove stopped containers and unused images
docker system prune -a

# Remove unused volumes (WARNING: deletes data)
docker volume prune
```

### Update to New Version

```bash
# Update image tags in .env
WEB_IMAGE_TAG=v0.4.0

# For private registries, authenticate and pull
./docker-login.sh

# For public registries, pull new images
docker-compose pull

# Recreate containers
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs -f
```

## Optional: Jupyter Notebook

The Jupyter Notebook service is **disabled by default** in the docker-compose configuration. If you need interactive notebooks for demos and experimentation, you can enable it.

### Enabling Jupyter Notebook

1. **Uncomment the notebook service** in `docker-compose.yml` (lines 83-136):
   ```bash
   # Edit docker-compose.yml and uncomment the entire notebook service block
   nano docker-compose.yml  # or your preferred editor
   ```

2. **Set the JUPYTER_TOKEN** in your `.env` file:
   ```bash
   # Generate a secure token
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"

   # Add to .env
   JUPYTER_TOKEN=your-generated-token-here
   ```

3. **Restart services**:
   ```bash
   docker-compose up -d
   ```

4. **Access Jupyter Notebook**:
   - URL: http://localhost:8888/jupyter
   - Login with the token from your `.env` file

### Notebook Commands

Once enabled, you can use these commands:

```bash
# View notebook logs
docker-compose logs -f notebook

# Open shell in notebook container
docker-compose exec notebook bash

# Check notebook health
curl http://localhost:8888/jupyter
```

### Troubleshooting: Notebook Authentication Issues

**Symptoms**: Jupyter token rejected or 403 errors

**Solutions**:
1. Verify `JUPYTER_TOKEN` is set in `.env`
2. Check notebook logs: `docker-compose logs notebook`
3. Use the exact token from `.env` (no extra spaces)
4. Try accessing `/jupyter` not `/jupyter/`

### If Using NIM LLM with Notebook

If you enable both notebook and NIM LLM, uncomment the notebook environment section in `docker-compose.nimllm.yml` (lines 58-60) to enable NIM integration:

```yaml
# Update notebook service to use NIM LLM
notebook:
  environment:
    - NIM_LLM_BASE_URL=http://nimllm:8000/v1
```

## Support

For issues, questions, or contributions:

- **GitHub**: https://github.com/h2oai/flood_prediction
- **Documentation**: See `/deployment/helm/README.md` for Helm deployment
- **Issues**: Report bugs at https://github.com/h2oai/flood_prediction/issues

## License

See the main repository for license information.
