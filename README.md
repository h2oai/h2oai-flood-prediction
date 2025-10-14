# Flood Prediction Agent Application

AI-powered flood prediction system featuring h2oGPTe Agent + NVIDIA NIM integration (A2A), NAT pipeline with Nemotron 49B, and real-time flood risk assessment. Part of NVIDIA–H2O.ai AI for Good Blueprint for disaster response and monitoring.

Individual Task Agents: 

- Data Integration Agent
- Data Analysis Agent
- Predictive Agent
- Assistant Chatbot
- Response Evaluator

## 📋 Prerequisites

Ensure you have the following installed and configured:

### Required Software

1. **Python 3.11**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install python3.11 python3.11-venv
   sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
   sudo update-alternatives --set python3 /usr/bin/python3.11
   ```

2. **Docker** (for Redis)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install docker.io
   sudo systemctl start docker
   ```

3. **Node.js & npm** (for netcat utility used by scripts)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install nodejs npm netcat
   ```

### Required API Keys

#### 1. NVIDIA API Key (Required)

Get your NVIDIA API key from the NVIDIA AI API Catalog:

🔗 **[Get NVIDIA API Key](https://docs.api.nvidia.com/nim/docs/api-quickstart#interacting-through-python)**

Steps:
1. Visit [https://build.nvidia.com/explore/discover](https://build.nvidia.com/explore/discover)
2. Sign in or create an NVIDIA account
3. Navigate to "API Keys" section
4. Generate a new API key
5. Copy the key (starts with `nvapi-`)

#### 2. h2oGPTe Credentials

For AutoML and advanced ML features, get h2oGPTe credentials:

🔗 **[Get h2oGPTe Access](https://h2o.ai/platform/enterprise-h2ogpte/)**

---


## Quick Start

### 1. Initial Setup
```bash
make setup
make build
```

### 2. Environment Configuration
Create these environment variables in the `core` folder:
```bash
APP_H2OGPTE_URL=""
APP_H2OGPTE_API_KEY=""
APP_H2OGPTE_MODEL=""
APP_NVIDIA_API_KEY=""
```

### 3. Start MCP Server
```bash
export NVIDIA_API_KEY=<your-key> && make run-mcp
```
This starts the MCP server at `localhost:8001`

## 4. Start Redis and Workers
In a new terminal, run:
```bash
make run-redis
```
In another terminal, run:
```bash
make run-worker
```

### 5. Start Application
```bash
export NVIDIA_API_KEY=<your-key> && make run-server
```
The application will be available at `localhost:8000`

## About

This application provides:
- **Real-time flood monitoring** with live data from watersheds and monitoring stations
- **AI-powered risk assessment** using advanced machine learning models
- **Interactive dashboards** showing flood predictions, alerts, and historical trends
- **Background data processing** for continuous monitoring and analysis
- **Comprehensive alerting system** for flood warnings and risk notifications

The system integrates with multiple data sources including USGS water services, NOAA flood forecasts, and weather APIs to provide accurate, up-to-date flood predictions and risk assessments.

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## Support

For questions and support, please open an issue in this repository.
