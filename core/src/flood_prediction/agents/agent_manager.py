"""
Agent Manager - Centralized management of all AI agents.
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import json
import logging

from .base_agent import BaseAgent, AgentInsight, AgentAlert
from .data_collector import DataCollectorAgent
from .risk_analyzer import RiskAnalyzerAgent
from .emergency_responder import EmergencyResponderAgent
from .predictor import PredictorAgent
from ..settings import settings
from .. import db

logger = logging.getLogger(__name__)

class AgentManager:
    """Centralized manager for all AI agents"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.agents: Dict[str, BaseAgent] = {}
        self.is_initialized = False
        self.last_data_fetch = None
        self.cached_data = {}
        
        # Initialize agents
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all AI agents"""
        try:
            self.agents = {
                'data_collector': DataCollectorAgent(),
                'risk_analyzer': RiskAnalyzerAgent(),
                'emergency_responder': EmergencyResponderAgent(),
                'predictor': PredictorAgent()
            }
            
            # Inject data getter into each agent
            for agent in self.agents.values():
                agent._get_current_data = self._get_current_data
            
            self.is_initialized = True
            logger.info("Agent manager initialized with 4 agents")
            
        except Exception as e:
            logger.error(f"Error initializing agents: {e}")
            self.is_initialized = False
    
    async def _generate_initial_insights(self):
        """Generate initial insights for all agents"""
        try:
            await asyncio.sleep(1)  # Give agents time to initialize
            logger.info("Generating initial insights for all agents...")
            
            for agent_name, agent in self.agents.items():
                try:
                    await agent._run_check()
                    logger.debug(f"Generated initial insights for {agent_name}")
                except Exception as e:
                    logger.error(f"Failed to generate initial insights for {agent_name}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to generate initial insights: {e}")
    
    async def start_all_agents(self):
        """Start monitoring for all agents"""
        if not self.is_initialized:
            raise RuntimeError("Agent manager not initialized")
        
        try:
            start_tasks = []
            for agent_name, agent in self.agents.items():
                task = agent.start_monitoring()
                start_tasks.append(task)
                logger.info(f"Starting agent: {agent_name}")
            
            # Start all agents concurrently
            await asyncio.gather(*start_tasks, return_exceptions=True)
            logger.info("All agents started successfully")
            
        except Exception as e:
            logger.error(f"Error starting agents: {e}")
            raise
    
    async def stop_all_agents(self):
        """Stop monitoring for all agents"""
        try:
            stop_tasks = []
            for agent_name, agent in self.agents.items():
                task = agent.stop_monitoring()
                stop_tasks.append(task)
                logger.info(f"Stopping agent: {agent_name}")
            
            # Stop all agents concurrently
            await asyncio.gather(*stop_tasks, return_exceptions=True)
            logger.info("All agents stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping agents: {e}")
    
    async def get_all_insights(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get insights from all agents"""
        insights = {}
        
        for agent_name, agent in self.agents.items():
            try:
                agent_insights = agent.get_insights()
                insights[agent_name] = agent_insights
            except Exception as e:
                logger.error(f"Error getting insights from {agent_name}: {e}")
                insights[agent_name] = []
        
        return insights
    
    async def get_all_alerts(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get alerts from all agents"""
        alerts = {}
        
        for agent_name, agent in self.agents.items():
            try:
                agent_alerts = agent.get_alerts()
                alerts[agent_name] = agent_alerts
            except Exception as e:
                logger.error(f"Error getting alerts from {agent_name}: {e}")
                alerts[agent_name] = []
        
        return alerts
    
    async def get_agent_status(self, agent_name: str = None) -> Dict[str, Any]:
        """Get status of specific agent or all agents"""
        if agent_name:
            if agent_name in self.agents:
                return self.agents[agent_name].get_status()
            else:
                raise ValueError(f"Agent '{agent_name}' not found")
        
        # Return status of all agents
        status = {}
        for name, agent in self.agents.items():
            try:
                status[name] = agent.get_status()
            except Exception as e:
                logger.error(f"Error getting status from {name}: {e}")
                status[name] = {'error': str(e)}
        
        return status
    
    async def force_agent_check(self, agent_name: str) -> Dict[str, Any]:
        """Force an immediate check for a specific agent"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent '{agent_name}' not found")
        
        try:
            result = await self.agents[agent_name].force_check()
            logger.info(f"Forced check completed for agent: {agent_name}")
            return result
        except Exception as e:
            logger.error(f"Error forcing check for {agent_name}: {e}")
            raise
    
    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get summary of all agent activities for dashboard"""
        try:
            # Get insights and alerts from all agents
            all_insights = await self.get_all_insights()
            all_alerts = await self.get_all_alerts()
            
            # Count totals
            total_insights = sum(len(insights) for insights in all_insights.values())
            total_alerts = sum(len(alerts) for alerts in all_alerts.values())
            
            # Count by urgency
            urgent_insights = 0
            critical_alerts = 0
            
            for insights in all_insights.values():
                urgent_insights += sum(1 for insight in insights if insight.get('urgency') in ['high', 'critical'])
            
            for alerts in all_alerts.values():
                critical_alerts += sum(1 for alert in alerts if alert.get('severity') == 'critical')
            
            # Get agent statuses
            agent_statuses = await self.get_agent_status()
            running_agents = sum(1 for status in agent_statuses.values() if status.get('is_running', False))
            
            return {
                'total_agents': len(self.agents),
                'running_agents': running_agents,
                'total_insights': total_insights,
                'urgent_insights': urgent_insights,
                'total_alerts': total_alerts,
                'critical_alerts': critical_alerts,
                'last_update': datetime.now(timezone.utc).isoformat(),
                'agent_statuses': agent_statuses
            }
            
        except Exception as e:
            logger.error(f"Error getting dashboard summary: {e}")
            return {
                'total_agents': len(self.agents),
                'running_agents': 0,
                'total_insights': 0,
                'urgent_insights': 0,
                'total_alerts': 0,
                'critical_alerts': 0,
                'last_update': datetime.now(timezone.utc).isoformat(),
                'error': str(e)
            }
    
    async def get_agent_details(self, agent_name: str) -> Dict[str, Any]:
        """Get detailed information about a specific agent"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent '{agent_name}' not found")
        
        agent = self.agents[agent_name]
        
        try:
            # Get comprehensive agent information
            details = {
                'name': agent.name,
                'description': agent.description,
                'status': agent.get_status(),
                'insights': agent.get_insights(),
                'alerts': agent.get_alerts(),
                'configuration': {
                    'check_interval': agent.check_interval,
                    'last_check': agent.last_check.isoformat() if agent.last_check else None
                }
            }
            
            # Add agent-specific details
            if isinstance(agent, DataCollectorAgent):
                details['data_sources'] = {
                    'last_usgs_update': agent.last_usgs_update.isoformat() if agent.last_usgs_update else None,
                    'last_noaa_update': agent.last_noaa_update.isoformat() if agent.last_noaa_update else None,
                    'last_weather_update': agent.last_weather_update.isoformat() if agent.last_weather_update else None,
                    'data_quality_score': agent.data_quality_score
                }
            
            elif isinstance(agent, RiskAnalyzerAgent):
                details['analysis_data'] = {
                    'risk_history_count': len(agent.risk_history),
                    'trend_analysis': agent.trend_analysis,
                    'ml_predictions': agent.ml_predictions
                }
            
            elif isinstance(agent, EmergencyResponderAgent):
                details['emergency_data'] = {
                    'active_incidents': len(agent.active_incidents),
                    'response_teams': len(agent.response_teams),
                    'evacuation_zones': len(agent.evacuation_zones),
                    'notification_history_count': len(agent.notification_history)
                }
            
            elif isinstance(agent, PredictorAgent):
                details['prediction_data'] = {
                    'prediction_history_count': len(agent.prediction_history),
                    'forecast_horizon_hours': agent.forecast_horizon,
                    'confidence_threshold': agent.confidence_threshold,
                    'model_accuracy_scores': agent.model_accuracy_scores
                }
            
            return details
            
        except Exception as e:
            logger.error(f"Error getting details for {agent_name}: {e}")
            raise
    
    async def _get_current_data(self) -> Dict[str, Any]:
        """Get current flood data for agents"""
        try:
            # Check if we need to refresh cached data
            now = datetime.now(timezone.utc)
            if (self.last_data_fetch is None or 
                (now - self.last_data_fetch).total_seconds() > 300):  # Refresh every 5 minutes
                
                # Fetch fresh data from database
                summary = db.get_dashboard_summary(self.db_path)
                
                # Initialize sample data if database is empty
                if summary['total_watersheds'] == 0:
                    logger.info("Database empty, populating with sample data for agents...")
                    db.populate_sample_data(self.db_path)
                    summary = db.get_dashboard_summary(self.db_path)
                
                watersheds = db.get_watersheds(self.db_path)
                alerts = db.get_active_alerts(self.db_path)
                
                self.cached_data = {
                    'summary': summary,
                    'watersheds': watersheds,
                    'alerts': alerts,
                    'timestamp': now
                }
                self.last_data_fetch = now
            
            return self.cached_data
            
        except Exception as e:
            logger.error(f"Error fetching current data: {e}")
            return {}
    
    async def collect_external_data(self) -> Dict[str, Any]:
        """Trigger data collection from external APIs and store in database"""
        data_collector = self.agents.get('data_collector')
        if not isinstance(data_collector, DataCollectorAgent):
            raise RuntimeError("Data collector agent not available")

        try:
            # Import here to avoid circular dependency
            from ..data_sources import fetch_and_update_usgs_data

            # Collect data from all sources (this updates timestamps)
            usgs_data = await data_collector.collect_usgs_data()
            noaa_data = await data_collector.collect_noaa_flood_data()
            weather_data = await data_collector.collect_weather_data()

            # Store USGS data in database (synchronous operation)
            db_update_result = None
            try:
                db_update_result = fetch_and_update_usgs_data(self.db_path, None)
                logger.info(f"Database update: {db_update_result.get('message', 'completed')}")
            except Exception as db_error:
                logger.error(f"Failed to update database with USGS data: {db_error}")

            # Force data_collector agent to regenerate insights with new timestamps
            # This ensures the data freshness score is immediately updated
            try:
                await data_collector._run_check()
                logger.info("Data collector insights regenerated after manual collection")
            except Exception as check_error:
                logger.warning(f"Failed to regenerate data collector insights: {check_error}")

            return {
                'usgs_data': usgs_data,
                'noaa_data': noaa_data,
                'weather_data': weather_data,
                'collected_at': datetime.now(timezone.utc).isoformat(),
                'db_updated': db_update_result.get('updated_count', 0) if db_update_result else 0
            }

        except Exception as e:
            logger.error(f"Error collecting external data: {e}")
            raise
    
    async def generate_forecast(self, hours_ahead: int = 24) -> Dict[str, Any]:
        """Generate AI-powered forecast"""
        predictor = self.agents.get('predictor')
        if not isinstance(predictor, PredictorAgent):
            raise RuntimeError("Predictor agent not available")
        
        try:
            data = await self._get_current_data()
            forecast = await predictor.generate_forecast(data, hours_ahead)
            return forecast
            
        except Exception as e:
            logger.error(f"Error generating forecast: {e}")
            raise
    
    async def send_emergency_alert(self, alert_data: Dict[str, Any]) -> bool:
        """Send emergency alert through emergency responder agent"""
        emergency_responder = self.agents.get('emergency_responder')
        if not isinstance(emergency_responder, EmergencyResponderAgent):
            raise RuntimeError("Emergency responder agent not available")
        
        try:
            # Create alert object
            alert = AgentAlert(
                id=alert_data.get('id', f"manual_{datetime.now().strftime('%Y%m%d%H%M%S')}"),
                title=alert_data.get('title', 'Emergency Alert'),
                message=alert_data.get('message', ''),
                severity=alert_data.get('severity', 'warning'),
                source_agent='manual',
                affected_areas=alert_data.get('affected_areas', []),
                recommendations=alert_data.get('recommendations', [])
            )
            
            channels = alert_data.get('channels', ['EAS', 'Cell', 'Social'])
            success = await emergency_responder.send_emergency_alert(alert, channels)
            
            return success
            
        except Exception as e:
            logger.error(f"Error sending emergency alert: {e}")
            return False
    
    def get_available_agents(self) -> List[Dict[str, str]]:
        """Get list of available agents with their descriptions"""
        return [
            {
                'name': agent.name,
                'key': key,
                'description': agent.description,
                'is_running': agent.is_running
            }
            for key, agent in self.agents.items()
        ]