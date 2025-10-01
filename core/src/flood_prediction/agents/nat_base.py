#!/usr/bin/env python3
import asyncio
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from nat.runtime.loader import load_workflow
    NAT_AVAILABLE = True
    logger.info("NVIDIA NAT runtime available")
except ImportError:
    logger.error("NVIDIA NAT not available. Install with: pip install nvidia-nat")
    NAT_AVAILABLE = False

class FloodPredictionRunner:
    """Unified runner for flood prediction agent workflows"""
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent / "nat"
        self.available_agents = {
            'data_collector': 'data_collector_config.yml',
            'risk_analyzer': 'risk_analyzer_config.yml', 
            'emergency_responder': 'emergency_responder_config.yml',
            'predictor': 'predictor_config.yml',
            'h2ogpte_agent': 'h2ogpte_agent_config.yml'
        }
        
    async def run_workflow(self, config_path: str, input_text: str) -> Dict[str, Any]:
        """Run NAT workflow with specified config and input"""
        if not NAT_AVAILABLE:
            return {"error": "NAT not available", "status": "error"}
        
        try:
            logger.info(f"Loading workflow from: {config_path}")
            async with load_workflow(config_path) as workflow:
                logger.info("Executing workflow...")
                async with workflow.run(input_text) as runner:
                    result = await runner.result(to_type=str)
                    
                    # Try to parse as JSON
                    try:
                        parsed_result = json.loads(result)
                        logger.info("Workflow completed successfully")
                        return parsed_result
                    except json.JSONDecodeError:
                        logger.info("Workflow completed with text output")
                        return {"output": result, "status": "success"}
                        
        except Exception as e:
            logger.error(f"NAT workflow execution failed: {e}")
            return {"error": str(e), "status": "error"}

    async def run_data_collector(self, custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Run Data Collector Agent workflow"""
        config_file = self.base_path / self.available_agents['data_collector']
        
        prompt = custom_prompt or """
        You are a Data Collector Agent for flood prediction. Use your tools to:
        1. Check current data collection status using generate_data_insights_tool
        2. Collect fresh USGS water data using collect_usgs_data_tool
        3. Get NOAA flood alerts using collect_noaa_flood_data_tool
        4. Retrieve weather data using collect_weather_data_tool
        
        Provide a comprehensive status report including:
        - Data freshness and quality metrics
        - API connectivity status
        - Any alerts or issues detected
        - Recommendations for data collection improvement
        
        Return results in JSON format with clear status indicators.
        """
        
        logger.info("Running Data Collector Agent workflow...")
        return await self.run_workflow(str(config_file), prompt)

    async def run_risk_analyzer(self, location: str = "Texas Region", custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Run Risk Analyzer Agent workflow"""
        config_file = self.base_path / self.available_agents['risk_analyzer']
        
        prompt = custom_prompt or f"""
        You are a Risk Analyzer Agent for flood prediction. Analyze flood risk for {location}:
        
        1. Use analyze_flood_risk_tool to assess current conditions
        2. Calculate detailed risk scores using calculate_risk_score_tool for key locations
        3. Run comprehensive_flood_analysis_tool for complete assessment
        
        Provide detailed analysis including:
        - Overall risk level and score
        - Critical watersheds and risk factors
        - Trend analysis and predictions
        - Immediate vs. long-term risk assessment
        - Specific recommendations for risk mitigation
        
        Focus on actionable intelligence with confidence levels.
        """
        
        logger.info(f"Running Risk Analyzer Agent workflow for {location}...")
        return await self.run_workflow(str(config_file), prompt)

    async def run_emergency_responder(self, scenario: str = "routine_check", custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Run Emergency Responder Agent workflow"""
        config_file = self.base_path / self.available_agents['emergency_responder']
        
        if custom_prompt:
            prompt = custom_prompt
        elif scenario == "flash_flood_alert":
            prompt = """
            EMERGENCY SCENARIO: Flash flood conditions detected in multiple watersheds.
            
            As Emergency Responder Agent, immediately:
            1. Assess emergency response readiness using assess_emergency_response_tool
            2. Activate appropriate emergency alerts using activate_emergency_alert_tool
            3. Coordinate evacuation procedures if needed using coordinate_evacuation_tool
            
            Determine:
            - Alert severity level (warning/critical)
            - Affected areas and estimated population at risk
            - Evacuation recommendations (voluntary/mandatory)
            - Communication channels for alert distribution
            - Resource allocation and response team deployment
            
            Provide immediate action plan with timeline and resource requirements.
            """
        else:
            prompt = """
            You are an Emergency Responder Agent conducting routine emergency preparedness assessment.
            
            1. Assess current emergency response status using assess_emergency_response_tool
            2. Evaluate communication systems and resource readiness
            3. Review any active incidents or ongoing responses
            
            Provide status report including:
            - Response readiness level and available resources
            - Active incidents and evacuation zones
            - Communication system status
            - Recommendations for preparedness improvement
            
            Focus on maintaining optimal emergency response capability.
            """
        
        logger.info(f"Running Emergency Responder Agent workflow - scenario: {scenario}...")
        return await self.run_workflow(str(config_file), prompt)

    async def run_predictor(self, forecast_hours: int = 24, location: str = "Dallas, TX", custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Run AI Predictor Agent workflow"""
        config_file = self.base_path / self.available_agents['predictor']
        
        prompt = custom_prompt or f"""
        You are an AI Predictor Agent for flood forecasting. Generate predictions for {location}:
        
        1. Create {forecast_hours}-hour flood forecast using generate_flood_forecast_tool
        2. Analyze prediction accuracy and model performance using analyze_prediction_accuracy_tool  
        3. Predict critical conditions and peak risk windows using predict_critical_conditions_tool
        4. Run comprehensive analysis for broader regional assessment
        
        Provide detailed forecast including:
        - Watershed-specific predictions with confidence levels
        - Critical time windows and peak risk periods
        - Model accuracy and reliability assessment
        - Uncertainty ranges and validation recommendations
        - Potential model conflicts or limitations
        
        Emphasize actionable predictive intelligence with clear confidence indicators.
        """
        
        logger.info(f"Running AI Predictor Agent workflow - {forecast_hours}h forecast for {location}...")
        return await self.run_workflow(str(config_file), prompt)

    async def run_h2ogpte_agent(self, task_type: str = "train_model", user_query: str = "", custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Run H2OGPTE ML Agent workflow"""
        config_file = self.base_path / self.available_agents['h2ogpte_agent']
        
        if custom_prompt:
            prompt = custom_prompt
        elif task_type == "train_model":
            prompt = f"""
            As an H2OGPTE ML Agent, help with flood prediction model training using Driverless AI capabilities.
            
            User Request: {user_query}
            
            Please provide comprehensive guidance on:
            1. Use h2ogpte_train_model_tool to initiate model training with appropriate parameters
            2. Analyze dataset requirements and preprocessing needs
            3. Recommend feature engineering strategies for flood prediction
            4. Suggest optimal model architectures and hyperparameters
            5. Provide validation and evaluation strategies
            
            Focus on:
            - Time-series aspects of flood prediction
            - Handling imbalanced flood event data
            - Real-time prediction requirements
            - Model interpretability for emergency response
            - Integration with existing flood monitoring systems
            
            Provide detailed, actionable recommendations with implementation guidance.
            """
        elif task_type == "analyze_performance":
            prompt = f"""
            As an H2OGPTE ML Agent, analyze flood prediction model performance.
            
            User Request: {user_query}
            
            Tasks:
            1. Use h2ogpte_analyze_performance_tool to evaluate model performance
            2. Assess model accuracy, precision, recall for flood prediction
            3. Analyze feature importance and model interpretability
            4. Identify potential improvements and optimization opportunities
            5. Check for model bias and fairness issues
            
            Provide comprehensive analysis with specific recommendations for improvement.
            """
        elif task_type == "optimize_features":
            prompt = f"""
            As an H2OGPTE ML Agent, optimize features for flood prediction models.
            
            User Request: {user_query}
            
            Tasks:
            1. Use h2ogpte_optimize_features_tool to enhance feature engineering
            2. Create time-series features (lags, rolling statistics, seasonality)
            3. Design interaction features between environmental variables
            4. Optimize feature selection and dimensionality reduction
            5. Handle missing data and outliers appropriately
            
            Focus on flood prediction specific feature engineering strategies.
            """
        else:
            prompt = f"""
            As an H2OGPTE ML Agent, provide general ML assistance for flood prediction.
            
            User Request: {user_query}
            
            Use available tools to help with the user's request:
            - h2ogpte_train_model_tool for training assistance
            - h2ogpte_analyze_performance_tool for performance analysis
            - h2ogpte_optimize_features_tool for feature engineering
            - h2ogpte_get_status_tool for agent status and history
            
            Provide expert guidance on ML aspects of flood prediction systems.
            """
        
        logger.info(f"Running H2OGPTE ML Agent workflow - task: {task_type}...")
        return await self.run_workflow(str(config_file), prompt)

    async def run_comprehensive_analysis(self) -> Dict[str, Any]:
        """Run comprehensive analysis using all agents"""
        logger.info("Running comprehensive flood prediction analysis with all agents...")
        
        results = {}
        
        # Run each agent workflow
        try:
            logger.info("Step 1/5: Data Collection Analysis...")
            results['data_collector'] = await self.run_data_collector()
            
            logger.info("Step 2/5: Risk Analysis...")
            results['risk_analyzer'] = await self.run_risk_analyzer()
            
            logger.info("Step 3/5: Emergency Response Assessment...")
            results['emergency_responder'] = await self.run_emergency_responder()
            
            logger.info("Step 4/5: Predictive Analysis...")
            results['predictor'] = await self.run_predictor()
            
            logger.info("Step 5/5: ML Model Analysis...")
            results['h2ogpte_agent'] = await self.run_h2ogpte_agent('analyze_performance', 'Analyze current flood prediction models')
            
            # Generate summary
            results['comprehensive_summary'] = {
                "analysis_timestamp": asyncio.get_event_loop().time(),
                "total_agents": len(self.available_agents),
                "successful_workflows": sum(1 for r in results.values() if isinstance(r, dict) and r.get('status') != 'error'),
                "overall_status": "completed",
                "recommendations": [
                    "Monitor data collection quality continuously",
                    "Focus on high-risk watersheds identified",
                    "Maintain emergency response readiness",
                    "Validate predictions with multiple sources"
                ]
            }
            
            logger.info("Comprehensive analysis completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {e}")
            results['error'] = str(e)
            results['status'] = 'partial_failure'
            return results

    def list_available_agents(self) -> Dict[str, Any]:
        """List all available agent configurations"""
        return {
            "available_agents": self.available_agents,
            "base_path": str(self.base_path),
            "nat_available": NAT_AVAILABLE,
            "description": {
                "data_collector": "Collects real-time data from USGS, NOAA, and weather APIs",
                "risk_analyzer": "AI-powered flood risk assessment and analysis", 
                "emergency_responder": "Emergency response coordination and alert management",
                "predictor": "Advanced AI forecasting and predictive analysis",
                "h2ogpte_agent": "AutoML agent for training flood prediction models using H2OGPTE and Driverless AI"
            }
        }

async def main():
    """Main entry point with command-line interface"""
    parser = argparse.ArgumentParser(description="NAT Base Runner for Flood Prediction Agents")
    parser.add_argument('--agent', choices=['data_collector', 'risk_analyzer', 'emergency_responder', 'predictor', 'h2ogpte_agent', 'all'],
                       default='all', help='Agent to run (default: all)')
    parser.add_argument('--prompt', type=str, help='Custom prompt for agent')
    parser.add_argument('--location', type=str, default='Texas Region', help='Location for analysis')
    parser.add_argument('--forecast-hours', type=int, default=24, help='Forecast horizon in hours')
    parser.add_argument('--scenario', type=str, default='routine_check', 
                       choices=['routine_check', 'flash_flood_alert'], help='Emergency response scenario')
    parser.add_argument('--ml-task', type=str, default='train_model',
                       choices=['train_model', 'analyze_performance', 'optimize_features'], help='H2OGPTE ML task type')
    parser.add_argument('--list-agents', action='store_true', help='List available agents')
    parser.add_argument('--output-file', type=str, help='Save results to file')
    
    args = parser.parse_args()
    
    runner = FloodPredictionRunner()
    
    if args.list_agents:
        agents_info = runner.list_available_agents()
        print(json.dumps(agents_info, indent=2))
        return
    
    if not NAT_AVAILABLE:
        logger.error("NVIDIA NAT is not available. Please install it first.")
        return
    
    # Run specified agent or comprehensive analysis
    if args.agent == 'data_collector':
        result = await runner.run_data_collector(args.prompt)
    elif args.agent == 'risk_analyzer':
        result = await runner.run_risk_analyzer(args.location, args.prompt)
    elif args.agent == 'emergency_responder':
        result = await runner.run_emergency_responder(args.scenario, args.prompt)
    elif args.agent == 'predictor':
        result = await runner.run_predictor(args.forecast_hours, args.location, args.prompt)
    elif args.agent == 'h2ogpte_agent':
        user_query = args.prompt or f"Please help with {args.ml_task} for flood prediction"
        result = await runner.run_h2ogpte_agent(args.ml_task, user_query, args.prompt)
    else:  # all
        result = await runner.run_comprehensive_analysis()
    
    # Output results
    if args.output_file:
        with open(args.output_file, 'w') as f:
            json.dump(result, f, indent=2)
        logger.info(f"Results saved to {args.output_file}")
    else:
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())