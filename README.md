# Flood Prediction Agent Application

AI-powered flood prediction system featuring h2oGPTe Agent + NVIDIA NIM integration (A2A), NAT pipeline with Nemotron 49B, and real-time flood risk assessment. Part of NVIDIA–H2O.ai AI for Good Blueprint for disaster response and monitoring.

Individual Task Agents: 

- Data Integration Agent
- Data Analysis Agent
- Predictive Agent
- Assistant Chatbot
- Response Evaluator

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
