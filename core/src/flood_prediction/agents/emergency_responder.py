"""
Emergency Responder Agent - Manages emergency response coordination and alerts.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set
import json
import logging

from .base_agent import BaseAgent, AgentInsight, AgentAlert

logger = logging.getLogger(__name__)

class EmergencyResponderAgent(BaseAgent):
    """Agent responsible for emergency response coordination and alert management"""
    
    def __init__(self):
        super().__init__(
            name="Emergency Responder",
            description="Coordinates emergency response activities and manages critical alerts",
            check_interval=180  # Check every 3 minutes for emergency conditions
        )
        self.active_incidents = []
        self.response_teams = {}
        self.evacuation_zones = set()
        self.notification_history = []
        
    async def analyze(self, data: Dict[str, Any]) -> List[AgentInsight]:
        """Analyze emergency response status and readiness"""
        insights = []
        
        # Active incidents count
        incident_count = len(self.active_incidents)
        insights.append(AgentInsight(
            title="🚨 Active Incidents",
            value=f"{incident_count} ongoing",
            change=self._get_incident_change(),
            trend='up' if incident_count > 3 else 'down' if incident_count == 0 else 'stable',
            urgency='critical' if incident_count > 5 else 'high' if incident_count > 2 else 'normal'
        ))
        
        # Response readiness
        readiness = await self._calculate_response_readiness(data)
        insights.append(AgentInsight(
            title="🚁 Response Readiness",
            value=f"{readiness['level']} ({readiness['score']:.0f}%)",
            change=f"{readiness['available_teams']} teams ready",
            trend='stable',
            urgency='high' if readiness['score'] < 70 else 'normal'
        ))
        
        # Evacuation status
        evacuation_status = await self._get_evacuation_status(data)
        insights.append(AgentInsight(
            title="🏃 Evacuation Status",
            value=evacuation_status['status'],
            change=f"{len(self.evacuation_zones)} zones active",
            trend='up' if len(self.evacuation_zones) > 0 else 'stable',
            urgency='critical' if len(self.evacuation_zones) > 0 else 'normal'
        ))
        
        # Communication status
        comm_status = await self._check_communication_systems()
        insights.append(AgentInsight(
            title="📡 Communication Systems",
            value=f"{comm_status['operational_percentage']:.0f}% operational",
            change=f"{comm_status['active_channels']} channels active",
            trend='stable',
            urgency='high' if comm_status['operational_percentage'] < 80 else 'normal'
        ))
        
        # Recent alerts sent
        alert_stats = self._get_alert_statistics()
        insights.append(AgentInsight(
            title="📢 Alert Distribution",
            value=f"{alert_stats['last_hour']} alerts sent",
            change=f"{alert_stats['total_today']} today",
            trend='stable',
            urgency='normal'
        ))
        
        return insights
    
    async def check_alerts(self, data: Dict[str, Any]) -> List[AgentAlert]:
        """Check for emergency conditions requiring immediate response"""
        alerts = []
        
        # Check for flash flood conditions
        flash_flood_risk = await self._assess_flash_flood_risk(data)
        if flash_flood_risk['immediate_risk']:
            alerts.append(AgentAlert(
                id=f"flash_flood_{datetime.now().strftime('%Y%m%d%H%M')}",
                title="⚡ FLASH FLOOD WARNING",
                message=f"Immediate flash flood risk detected in {len(flash_flood_risk['areas'])} areas. "
                       f"Rapid response required within {flash_flood_risk['time_window']} minutes.",
                severity="critical",
                source_agent=self.name,
                affected_areas=flash_flood_risk['areas'],
                recommendations=[
                    "Immediately activate emergency response teams",
                    "Issue public emergency alerts",
                    "Prepare for potential evacuations",
                    "Coordinate with local emergency services",
                    "Monitor affected areas continuously"
                ],
                expires_at=datetime.now(timezone.utc) + timedelta(hours=6)
            ))
        
        # Check for dam/levee stress
        infrastructure_risk = await self._check_infrastructure_stress(data)
        if infrastructure_risk['critical_stress']:
            alerts.append(AgentAlert(
                id=f"infrastructure_stress_{datetime.now().strftime('%Y%m%d%H')}",
                title="🏗️ Critical Infrastructure Stress",
                message=f"Critical stress detected on flood control infrastructure. "
                       f"Potential failure risk in {infrastructure_risk['at_risk_structures']} structures.",
                severity="critical",
                source_agent=self.name,
                affected_areas=infrastructure_risk['downstream_areas'],
                recommendations=[
                    "Inspect critical infrastructure immediately",
                    "Prepare downstream evacuation plans",
                    "Deploy emergency engineering teams",
                    "Coordinate with dam/levee operators",
                    "Monitor structural integrity continuously"
                ]
            ))
        
        # Check for populated area threats
        population_threat = await self._assess_population_threat(data)
        if population_threat['high_risk_population'] > 1000:
            alerts.append(AgentAlert(
                id=f"population_threat_{datetime.now().strftime('%Y%m%d%H')}",
                title="👥 High-Risk Population Alert",
                message=f"Approximately {population_threat['high_risk_population']:,} people "
                       f"in immediate flood risk areas. Evacuation assessment required.",
                severity="critical",
                source_agent=self.name,
                affected_areas=population_threat['communities'],
                recommendations=[
                    "Assess evacuation necessity immediately",
                    "Prepare mass notification systems",
                    "Coordinate with local authorities",
                    "Activate emergency shelters",
                    "Deploy search and rescue resources"
                ]
            ))
        
        # Check for communication failures
        comm_failures = await self._detect_communication_failures()
        if comm_failures:
            alerts.append(AgentAlert(
                id=f"comm_failure_{datetime.now().strftime('%Y%m%d%H')}",
                title="📡 Communication System Failure",
                message=f"Critical communication systems are down in {len(comm_failures)} areas. "
                       f"Emergency coordination may be compromised.",
                severity="warning",
                source_agent=self.name,
                affected_areas=comm_failures,
                recommendations=[
                    "Activate backup communication systems",
                    "Deploy mobile communication units",
                    "Use alternative alert methods",
                    "Coordinate via remaining channels"
                ]
            ))
        
        return alerts
    
    async def _assess_flash_flood_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess immediate flash flood risk"""
        try:
            immediate_risk = False
            at_risk_areas = []
            time_window = 60  # minutes
            
            watersheds = data.get('watersheds', [])
            
            for watershed in watersheds:
                risk_score = watershed.get('risk_score', 0)
                trend_rate = watershed.get('trend_rate_cfs_per_hour', 0)
                current_flow = watershed.get('current_streamflow_cfs', 0)
                flood_stage = watershed.get('flood_stage_cfs')
                
                # Flash flood indicators
                rapid_rise = trend_rate > 200  # Very rapid flow increase
                near_capacity = flood_stage and current_flow > flood_stage * 0.8
                high_risk = risk_score > 8.5
                
                if (rapid_rise and near_capacity) or (high_risk and rapid_rise):
                    immediate_risk = True
                    at_risk_areas.append(watershed.get('name', 'Unknown'))
                    
                    # Calculate time window based on flow rate
                    if trend_rate > 500:
                        time_window = min(time_window, 30)
                    elif trend_rate > 300:
                        time_window = min(time_window, 45)
            
            return {
                'immediate_risk': immediate_risk,
                'areas': at_risk_areas,
                'time_window': time_window
            }
        
        except Exception as e:
            logger.error(f"Error assessing flash flood risk: {e}")
            return {'immediate_risk': False, 'areas': [], 'time_window': 60}
    
    async def _calculate_response_readiness(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate emergency response readiness score"""
        try:
            # Simulate response readiness calculation
            # In reality, this would integrate with emergency management systems
            
            base_readiness = 85  # Base readiness percentage
            
            # Factors affecting readiness
            active_incidents = len(self.active_incidents)
            readiness_reduction = min(active_incidents * 10, 30)  # Max 30% reduction
            
            current_readiness = max(50, base_readiness - readiness_reduction)
            
            # Determine readiness level
            if current_readiness >= 90:
                level = "OPTIMAL"
            elif current_readiness >= 75:
                level = "GOOD"
            elif current_readiness >= 60:
                level = "ADEQUATE"
            else:
                level = "LIMITED"
            
            # Calculate available teams
            available_teams = max(0, 8 - active_incidents)  # Assume 8 total teams
            
            return {
                'score': current_readiness,
                'level': level,
                'available_teams': available_teams
            }
        
        except Exception as e:
            logger.error(f"Error calculating response readiness: {e}")
            return {'score': 70, 'level': 'ADEQUATE', 'available_teams': 5}
    
    async def _get_evacuation_status(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get current evacuation status"""
        if not self.evacuation_zones:
            return {'status': 'No active evacuations'}
        
        # Categorize evacuation zones
        voluntary = 0
        mandatory = 0
        
        for zone in self.evacuation_zones:
            # This would check actual evacuation orders
            # For now, assume distribution
            if hash(zone) % 2 == 0:
                mandatory += 1
            else:
                voluntary += 1
        
        if mandatory > 0:
            status = f"{mandatory} mandatory, {voluntary} voluntary"
        else:
            status = f"{voluntary} voluntary zones"
        
        return {'status': status}
    
    async def _check_communication_systems(self) -> Dict[str, Any]:
        """Check status of emergency communication systems"""
        # Simulate communication system status
        systems = {
            'Emergency Alert System': True,
            'NOAA Weather Radio': True,
            'Cell Broadcast': True,
            'Social Media Alerts': True,
            'Local TV/Radio': True,
            'Municipal Alert Systems': True
        }
        
        operational_count = sum(1 for status in systems.values() if status)
        total_systems = len(systems)
        
        return {
            'operational_percentage': (operational_count / total_systems) * 100,
            'active_channels': operational_count,
            'total_channels': total_systems,
            'systems_status': systems
        }
    
    async def _check_infrastructure_stress(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Check for critical infrastructure stress"""
        try:
            critical_stress = False
            at_risk_structures = 0
            downstream_areas = []
            
            watersheds = data.get('watersheds', [])
            
            for watershed in watersheds:
                current_flow = watershed.get('current_streamflow_cfs', 0)
                flood_stage = watershed.get('flood_stage_cfs')
                
                if flood_stage and current_flow > flood_stage * 0.95:
                    # Near or exceeding design capacity
                    critical_stress = True
                    at_risk_structures += 1
                    
                    # Add downstream areas
                    watershed_name = watershed.get('name', 'Unknown')
                    downstream_areas.append(f"Downstream of {watershed_name}")
            
            return {
                'critical_stress': critical_stress,
                'at_risk_structures': at_risk_structures,
                'downstream_areas': downstream_areas
            }
        
        except Exception as e:
            logger.error(f"Error checking infrastructure stress: {e}")
            return {'critical_stress': False, 'at_risk_structures': 0, 'downstream_areas': []}
    
    async def _assess_population_threat(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess threat to populated areas"""
        try:
            # Estimate population at risk based on watershed risk levels
            # In reality, this would use GIS data and population databases
            
            high_risk_population = 0
            threatened_communities = []
            
            watersheds = data.get('watersheds', [])
            
            for watershed in watersheds:
                risk_score = watershed.get('risk_score', 0)
                watershed_name = watershed.get('name', 'Unknown')
                
                if risk_score > 7:
                    # Estimate population based on watershed size and urban areas
                    basin_size = watershed.get('basin_size_sqmi', 100)
                    estimated_population = int(basin_size * 150)  # Rough estimate
                    
                    high_risk_population += estimated_population
                    threatened_communities.append(watershed_name)
            
            return {
                'high_risk_population': high_risk_population,
                'communities': threatened_communities
            }
        
        except Exception as e:
            logger.error(f"Error assessing population threat: {e}")
            return {'high_risk_population': 0, 'communities': []}
    
    async def _detect_communication_failures(self) -> List[str]:
        """Detect communication system failures"""
        # Simulate communication failure detection
        # In reality, this would monitor actual communication systems
        
        failed_areas = []
        
        # Random simulation of occasional failures
        import random
        if random.random() < 0.1:  # 10% chance of failure
            failed_areas = ['Rural Area Alpha', 'Downtown Sector']
        
        return failed_areas
    
    def _get_incident_change(self) -> Optional[str]:
        """Get change in incident count"""
        # This would track historical incident counts
        return None
    
    def _get_alert_statistics(self) -> Dict[str, int]:
        """Get alert distribution statistics"""
        now = datetime.now(timezone.utc)
        
        # Count alerts in last hour
        last_hour = sum(1 for alert in self.notification_history 
                       if (now - alert.get('timestamp', now)).total_seconds() < 3600)
        
        # Count alerts today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = sum(1 for alert in self.notification_history 
                         if alert.get('timestamp', now) >= today_start)
        
        return {
            'last_hour': last_hour,
            'total_today': today_count
        }
    
    async def send_emergency_alert(self, alert: AgentAlert, channels: List[str] = None) -> bool:
        """Send emergency alert through multiple channels"""
        try:
            if channels is None:
                channels = ['EAS', 'Cell', 'Social', 'Radio']
            
            # Log the alert
            self.notification_history.append({
                'timestamp': datetime.now(timezone.utc),
                'alert_id': alert.id,
                'severity': alert.severity,
                'channels': channels
            })
            
            # In reality, this would integrate with actual alert systems
            logger.info(f"Emergency alert sent: {alert.title} via {', '.join(channels)}")
            
            # Keep notification history manageable
            if len(self.notification_history) > 1000:
                self.notification_history = self.notification_history[-500:]
            
            return True
        
        except Exception as e:
            logger.error(f"Error sending emergency alert: {e}")
            return False
    
    async def activate_response_team(self, incident_type: str, location: str) -> str:
        """Activate emergency response team"""
        try:
            team_id = f"team_{len(self.response_teams) + 1}_{datetime.now().strftime('%Y%m%d%H%M')}"
            
            self.response_teams[team_id] = {
                'activated_at': datetime.now(timezone.utc),
                'incident_type': incident_type,
                'location': location,
                'status': 'dispatched'
            }
            
            logger.info(f"Response team {team_id} activated for {incident_type} at {location}")
            return team_id
        
        except Exception as e:
            logger.error(f"Error activating response team: {e}")
            return ""
    
    async def declare_evacuation_zone(self, zone_name: str, evacuation_type: str = "voluntary") -> bool:
        """Declare evacuation zone"""
        try:
            self.evacuation_zones.add(f"{zone_name}_{evacuation_type}")
            logger.info(f"Evacuation zone declared: {zone_name} ({evacuation_type})")
            return True
        
        except Exception as e:
            logger.error(f"Error declaring evacuation zone: {e}")
            return False