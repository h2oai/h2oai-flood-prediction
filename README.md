# Flood Prediction Application

A real-time flood prediction and monitoring application built with React + FastAPI, featuring AI-powered analysis and real-time data visualization.

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
APP_H2OGPTE_MODEL="claude-sonnet-4-20250514"
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License

```
MIT License

Copyright (c) 2025 Flood Prediction Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## Support

For questions and support, please open an issue in this repository.
