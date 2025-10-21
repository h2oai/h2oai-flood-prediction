# 🌊 Building AI-Powered Flood Prediction System

Welcome! This guide will help you build and deploy an **AI-powered flood prediction and disaster response system** using NVIDIA NIM and h2oGPTe.

## What You'll Build

An intelligent system that combines:
- **Real-time flood monitoring** from USGS and NOAA data sources
- **AI-powered risk assessment** using NVIDIA's latest language models
- **Multi-agent coordination** with 5 specialized AI agents
- **Predictive analytics** for flood forecasting
- **Interactive dashboard** for monitoring and alerts

By the end of this guide, you'll have a fully functional flood prediction system running with live data.

---

## What You Need

### Required
- ✅ **NVIDIA API Key** - Get your free key from [build.nvidia.com](https://build.nvidia.com)

### Optional (Recommended)
- 🔹 **NGC API Key** - For running a local NVIDIA NIM model (requires GPU)
  - Get it from [NGC Catalog](https://catalog.ngc.nvidia.com/)
  - Only needed if you have an NVIDIA GPU available

- 🔹 **H2OGPTE Access** - For advanced AutoML features
  - Get access at [h2o.ai](https://h2o.ai/platform/enterprise-h2ogpte/)
  - The system works without this, but some features will be limited

**Note**: If you don't have H2OGPTE or NGC keys, that's okay! The system will work with just the NVIDIA API key.

---

## Getting Started

### Step 1: Open the Notebook

1. In your Jupyter environment, navigate to the notebook:

   ```
   notebooks/Building_Flood_Prediction_Agents_Nvidia_Launchable.ipynb
   ```

2. Open the notebook - you'll see it's organized into clear sections

3. You'll follow the notebook from top to bottom, running cells as you go

**Important**: Read the instructions in each section before running cells!

---

## Following the Notebook

The notebook guides you through everything step-by-step. Here's what to expect:

### 📋 Section 1: Setup

This section sets up your environment and deploys the application.

**What you'll do:**

1. **Install Python Dependencies** (Cell 5)
   - Run the cell to install required libraries
   - **⚠️ Important**: Restart your kernel after this step
   - Don't run this cell again after restarting

2. **Collect API Keys** (Cells 7-10)
   - The notebook will prompt you to enter your API keys
   - Your inputs are hidden for security
   - Required: NVIDIA API Key
   - Optional: NGC API Key, H2OGPTE credentials
   - Just press Enter to skip optional keys

3. **Generate Configuration File** (Cells 12-13)
   - Run the cells to create your configuration
   - The notebook shows a summary of what was configured
   - A file called `flood_prediction.env` is created automatically

4. **Pull Docker Images** (Cells 17-18, optionally 23-27)
   - This downloads the application containers
   - Takes 5-10 minutes depending on your connection
   - You'll see progress bars
   - Optional: If you have a GPU, you can pull the NIM LLM image (cells 23-27)

5. **Deploy the Application** (Cell 30 or 32)
   - Run the docker compose command
   - **With GPU**: Use cell 30 to deploy with local NIM LLM
   - **Without GPU**: Use cell 32 for standard deployment
   - Wait 2-3 minutes for services to start

6. **Verify Deployment** (Cell 34)
   - Check that all containers show "healthy" status
   - If not healthy, wait another minute and check again

**✅ Checkpoint**: Once all containers are healthy, your system is deployed!

### 🚀 Section 2: NVIDIA NIM Integration

Learn how NVIDIA's language models power the flood prediction system:
- Test different NVIDIA models
- See streaming responses in action
- Compare model performance
- Try the LLM-as-Judge evaluation feature

**What you'll do**: Run the cells to see AI models analyzing flood scenarios in real-time.

### 🧠 Section 3: h2oGPTe Agent Integration

Explore advanced AutoML capabilities (if you configured H2OGPTE):
- Get AI guidance on building ML models
- Learn feature engineering techniques
- Understand model training best practices

**Note**: This section is skipped if you don't have H2OGPTE credentials - that's okay!

### 🤝 Section 4: Multi-Agent System

Interact with the 5 specialized AI agents:
- **Data Collector**: Pulls real-time flood data
- **Risk Analyzer**: Calculates flood risk scores
- **Emergency Responder**: Manages alerts and evacuations
- **AI Predictor**: Generates flood forecasts
- **H2OGPTE ML Agent**: Trains and optimizes models (optional)

**What you'll do**:
- View agent status and insights
- Run agent workflows
- See how agents coordinate to analyze flood risk

### 🌐 Section 5: Real-World Data Integration

Work with live data from government agencies:
- USGS water monitoring stations
- NOAA flood alerts
- Weather forecasts

**What you'll do**:
- Refresh live data from monitoring stations
- View watershed data in tables
- See risk scores and trends

---

## Accessing Your Application

### Web Dashboard

Once deployment is complete (Section 1), you can access the interactive dashboard:

1. Goto the "Access" section of your deployed instance on brev.
2. At the bottom of the page, find "Using Ports" section.
3. If the cloud provider allows forwarding ports, there will be a clickable link similar to x.x.x.x:8090 under the "TCP/UDP Ports" section.
2. Open that URL in your browser
3. You'll see the Flood Prediction Dashboard with:
   - Real-time flood monitoring
   - Interactive watershed maps
   - Agent status and insights
   - Alert management
   - Data visualizations

---

## Troubleshooting

### Containers Not Healthy

**Problem**: After deploying, containers don't show "(healthy)" status

**Solutions**:
1. Wait 20-30 minutes - services take time to initialize
2. Run this cell again to check status:
   ```python
   !docker ps -a
   ```
3. If still not healthy after 5 minutes, check logs:
   ```python
   !docker logs flood-prediction-web
   ```

### Can't Access the Dashboard

**Problem**: Port 8090 doesn't load or shows an error

**Solutions**:
1. Verify containers are running and healthy (see above)
2. Wait 2-3 minutes after deployment
3. Try refreshing your browser
4. Check that the deployment step (cell 30 or 32) completed without errors

### API Key Errors

**Problem**: Cells show "API key required" errors

**Solutions**:
1. Make sure you ran all cells in Section 1, Step 2 (collecting keys)
2. Verify you entered the keys correctly (check for extra spaces)
3. Re-run the key collection cells if needed
4. After fixing keys, restart the deployment:
   ```python
   !docker compose -f ../deployment/nvidia-launchable/docker-compose.yml --env-file ./flood_prediction.env down
   !docker compose -f ../deployment/nvidia-launchable/docker-compose.yml --env-file ./flood_prediction.env up -d
   ```

### Out of Memory

**Problem**: Containers crash or system becomes slow

**Solutions**:
1. If you deployed with local NIM (cell 30), try without it (cell 32 instead)
2. Close other applications to free up memory
3. Restart the containers:
   ```python
   !docker compose --env-file ./flood_prediction.env restart
   ```

### Notebook Kernel Issues

**Problem**: "Kernel died" or cells won't run

**Solutions**:
1. Restart the kernel from the Kernel menu
2. Don't re-run the dependency installation (cell 5) after restarting
3. Re-run cells from Section 1, Step 2 onwards

---

## Next Steps

Once your system is running, you can:

1. **Explore the Agents** - Run the examples in Section 4 to see agents in action
2. **Monitor Live Data** - Use Section 5 to refresh and view real-time watershed data
3. **Customize** - Modify the prompts and queries to test different scenarios
4. **Add More Data** - The system can monitor any watershed with USGS data
5. **Train Models** - If you have H2OGPTE, try the AutoML features in Section 3

### Learning Resources

- **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com)
- **USGS Water Data**: [waterdata.usgs.gov](https://waterdata.usgs.gov)
- **NOAA Flood Alerts**: [weather.gov](https://weather.gov)
- **H2O.ai**: [h2o.ai](https://h2o.ai)

---

## Quick Reference

### Check Container Status
```python
!docker ps -a
```
All containers should show "Up" and "(healthy)"

### View Logs
```python
!docker logs flood-prediction-web
!docker logs flood-prediction-redis
```

### Restart Services
```python
!docker compose --env-file ./flood_prediction.env restart
```

### Stop Services
```python
!docker compose --env-file ./flood_prediction.env down
```

### Start Services Again
```python
!docker compose --env-file ./flood_prediction.env up -d
```

---

## Need Help?

If you encounter issues:

1. Check the Troubleshooting section above
2. Review the error messages in failed cells
3. Check container logs with the commands above
4. Make sure you completed all steps in Section 1 (Setup)

---

## About This System

This flood prediction system is built with:
- **NVIDIA NIM** - High-performance AI inference
- **h2oGPTe** - Enterprise AI and AutoML
- **FastMCP** - Multi-agent coordination
- **Real-time APIs** - USGS, NOAA, weather data

It demonstrates how AI can be used for disaster response and public safety.

---

**🌊 Ready to start?** Open the notebook and begin with Section 1!

*Built with ❤️ for AI for Good using H2O.ai and NVIDIA NIM*
