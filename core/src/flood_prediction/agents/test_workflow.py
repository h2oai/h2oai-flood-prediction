"""
Simple test script to run NAT workflow with the data collector config
"""

import asyncio
import json
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from nat.runtime.loader import load_workflow
    NAT_AVAILABLE = True
except ImportError:
    logger.error("NVIDIA NAT not available. Install with: pip install nvidia-nat")
    NAT_AVAILABLE = False

async def run_nat_workflow(config_path: str, input_text: str) -> dict:
    """Simple function to run NAT workflow"""
    if not NAT_AVAILABLE:
        return {"error": "NAT not available", "status": "error"}
    
    try:
        async with load_workflow(config_path) as workflow:
            async with workflow.run(input_text) as runner:
                result = await runner.result(to_type=str)
                
                # Try to parse as JSON
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    return {"output": result, "status": "success"}
                    
    except Exception as e:
        logger.error(f"NAT workflow execution failed: {e}")
        return {"error": str(e), "status": "error"}

async def test_data_collector_workflow():
    """Test the data collector workflow"""
    config_file = Path(__file__).parent / "nat" / "data_collector_config.yml"
    
    if not config_file.exists():
        logger.error(f"Config file not found: {config_file}")
        return
    
    # Test prompt for insights
    insights_prompt = """
    You are a Data Collector Agent. Use the generate_insights function to collect data insights.
    
    Return JSON in this exact format:
    {
      "insights": [
        {
          "title": "🔄 Data Freshness",
          "value": "85% current",
          "change": "+5%",
          "trend": "up",
          "urgency": "normal"
        },
        {
          "title": "🌐 API Connectivity", 
          "value": "3/5 active",
          "trend": "stable",
          "urgency": "normal"
        }
      ]
    }
    
    Call generate_insights function and return the JSON.
    """
    
    logger.info("Testing NAT workflow with data collector config...")
    result = await run_nat_workflow(str(config_file), insights_prompt)
    
    logger.info(f"Workflow result: {json.dumps(result, indent=2)}")
    return result

if __name__ == "__main__":
    asyncio.run(test_data_collector_workflow())