"""
Risk Analyzer Agent - Analyzes flood risk conditions using AI.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json
import logging
import math

from .base_agent import BaseAgent, AgentInsight, AgentAlert

logger = logging.getLogger(__name__)

class RiskAnalyzerAgent(BaseAgent):
    """Agent responsible for analyzing flood risk using AI and data analysis"""
    
    def __init__(self):
        super().__init__(
            name="Risk Analyzer",
            description="AI-powered analysis of flood risk conditions and trend detection",
            check_interval=600  # Check every 10 minutes
        )
        self.risk_history = []
        self.trend_analysis = {}
        self.ml_predictions = {}
        
    async def analyze(self, data: Dict[str, Any]) -> List[AgentInsight]:
        """Analyze current flood risk conditions"""
        insights = []
        
        # Overall risk assessment
        overall_risk = await self._calculate_overall_risk(data)
        insights.append(AgentInsight(
            title="🎯 Overall Risk Level",
            value=f"{overall_risk['level']} ({overall_risk['score']:.1f}/10)",
            change=f"{overall_risk['change']:+.1f}",
            trend=overall_risk['trend'],
            urgency='critical' if overall_risk['score'] > 8 else 'high' if overall_risk['score'] > 6 else 'normal'
        ))
        
        # Critical watersheds count
        critical_count = await self._count_critical_watersheds(data)
        insights.append(AgentInsight(
            title="🚨 Critical Watersheds",
            value=f"{critical_count['count']} areas",
            change=f"{critical_count['change']:+d}" if critical_count['change'] != 0 else None,
            trend='up' if critical_count['change'] > 0 else 'down' if critical_count['change'] < 0 else 'stable',
            urgency='critical' if critical_count['count'] > 5 else 'high' if critical_count['count'] > 2 else 'normal'
        ))
        
        # Trend analysis
        trend_data = await self._analyze_trends(data)
        insights.append(AgentInsight(
            title="📈 Risk Trend Analysis",
            value=trend_data['direction'],
            change=f"{trend_data['rate']:.1f}% per hour",
            trend=trend_data['trend'],
            urgency='high' if trend_data['trend'] == 'up' and trend_data['rate'] > 5 else 'normal'
        ))
        
        # AI confidence score
        ai_confidence = await self._get_ai_confidence(data)
        insights.append(AgentInsight(
            title="🧠 AI Confidence",
            value=f"{ai_confidence['score']:.0f}%",
            change=f"{ai_confidence['reliability']}",
            trend='stable',
            urgency='normal'
        ))
        
        # Predicted peak risk time
        peak_prediction = await self._predict_peak_risk(data)
        if peak_prediction:
            insights.append(AgentInsight(
                title="⏰ Peak Risk Window",
                value=peak_prediction['time_range'],
                change=f"{peak_prediction['confidence']:.0f}% confidence",
                trend='stable',
                urgency='high' if peak_prediction['severity'] == 'high' else 'normal'
            ))
        
        return insights
    
    async def check_alerts(self, data: Dict[str, Any]) -> List[AgentAlert]:
        """Check for high-risk conditions requiring alerts"""
        alerts = []
        
        # Check for rapid risk increase
        risk_change = await self._detect_rapid_risk_change(data)
        if risk_change['rapid_increase']:
            alerts.append(AgentAlert(
                id=f"rapid_risk_increase_{datetime.now().strftime('%Y%m%d%H%M')}",
                title="⚡ Rapid Risk Escalation",
                message=f"Risk levels are increasing rapidly in {len(risk_change['affected_areas'])} areas. "
                       f"Average increase: {risk_change['rate']:.1f}% per hour.",
                severity="critical",
                source_agent=self.name,
                affected_areas=risk_change['affected_areas'],
                recommendations=[
                    "Monitor affected watersheds closely",
                    "Prepare emergency response resources",
                    "Issue public advisories for high-risk areas",
                    "Activate automated alert systems"
                ]
            ))
        
        # Check for threshold breaches
        threshold_breaches = await self._check_threshold_breaches(data)
        if threshold_breaches:
            alerts.append(AgentAlert(
                id=f"threshold_breach_{len(threshold_breaches)}_{datetime.now().strftime('%Y%m%d%H')}",
                title="🚨 Critical Threshold Exceeded",
                message=f"{len(threshold_breaches)} watersheds have exceeded critical risk thresholds.",
                severity="critical",
                source_agent=self.name,
                affected_areas=[breach['watershed'] for breach in threshold_breaches],
                recommendations=[
                    "Immediate evacuation assessment required",
                    "Deploy emergency response teams",
                    "Coordinate with local authorities",
                    "Monitor downstream areas"
                ]
            ))
        
        # Check for pattern anomalies
        anomalies = await self._detect_pattern_anomalies(data)
        if anomalies:
            alerts.append(AgentAlert(
                id=f"pattern_anomaly_{datetime.now().strftime('%Y%m%d%H')}",
                title="🔍 Unusual Pattern Detected",
                message=f"AI detected unusual flood patterns that deviate from historical norms.",
                severity="warning",
                source_agent=self.name,
                recommendations=[
                    "Verify data accuracy with multiple sources",
                    "Increase monitoring frequency",
                    "Review prediction models",
                    "Consider additional safety margins"
                ]
            ))
        
        return alerts
    
    async def _calculate_overall_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall regional flood risk score"""
        try:
            watersheds = data.get('watersheds', [])
            if not watersheds:
                return {'level': 'Unknown', 'score': 0, 'change': 0, 'trend': 'stable'}
            
            # Calculate weighted average risk score
            total_score = 0
            total_weight = 0
            
            for watershed in watersheds:
                risk_score = watershed.get('risk_score', 0)
                # Weight by basin size if available
                weight = watershed.get('basin_size_sqmi', 1)
                total_score += risk_score * weight
                total_weight += weight
            
            if total_weight == 0:
                avg_score = 0
            else:
                avg_score = total_score / total_weight
            
            # Determine risk level
            if avg_score >= 8:
                level = "CRITICAL"
            elif avg_score >= 6:
                level = "HIGH"
            elif avg_score >= 4:
                level = "MODERATE"
            else:
                level = "LOW"
            
            # Calculate change from previous assessment
            change = 0
            trend = 'stable'
            if self.risk_history:
                previous_score = self.risk_history[-1]['score']
                change = avg_score - previous_score
                if abs(change) > 0.5:
                    trend = 'up' if change > 0 else 'down'
            
            # Store in history
            self.risk_history.append({
                'timestamp': datetime.now(timezone.utc),
                'score': avg_score,
                'level': level
            })
            
            # Keep only last 24 hours of history
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            self.risk_history = [h for h in self.risk_history if h['timestamp'] > cutoff]
            
            return {
                'level': level,
                'score': avg_score,
                'change': change,
                'trend': trend
            }
        
        except Exception as e:
            logger.error(f"Error calculating overall risk: {e}")
            return {'level': 'Unknown', 'score': 0, 'change': 0, 'trend': 'stable'}
    
    async def _count_critical_watersheds(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Count watersheds in critical condition"""
        watersheds = data.get('watersheds', [])
        critical_count = sum(1 for w in watersheds if w.get('risk_score', 0) >= 8)
        
        # Compare with previous count
        previous_count = getattr(self, '_previous_critical_count', critical_count)
        change = critical_count - previous_count
        self._previous_critical_count = critical_count
        
        return {
            'count': critical_count,
            'change': change
        }
    
    async def _analyze_trends(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze risk trends over time"""
        if len(self.risk_history) < 2:
            return {'direction': 'Insufficient data', 'rate': 0, 'trend': 'stable'}
        
        # Calculate trend over last few hours
        recent_history = self.risk_history[-6:]  # Last 6 data points
        if len(recent_history) < 2:
            return {'direction': 'Stable', 'rate': 0, 'trend': 'stable'}
        
        # Simple linear trend calculation
        scores = [h['score'] for h in recent_history]
        times = [(h['timestamp'] - recent_history[0]['timestamp']).total_seconds() / 3600 for h in recent_history]
        
        if len(scores) >= 2:
            # Calculate slope (change per hour)
            n = len(scores)
            sum_xy = sum(t * s for t, s in zip(times, scores))
            sum_x = sum(times)
            sum_y = sum(scores)
            sum_x2 = sum(t * t for t in times)
            
            if n * sum_x2 - sum_x * sum_x != 0:
                slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
                rate = slope * 10  # Convert to percentage-like scale
                
                if rate > 0.5:
                    direction = "Increasing"
                    trend = 'up'
                elif rate < -0.5:
                    direction = "Decreasing"
                    trend = 'down'
                else:
                    direction = "Stable"
                    trend = 'stable'
                
                return {'direction': direction, 'rate': abs(rate), 'trend': trend}
        
        return {'direction': 'Stable', 'rate': 0, 'trend': 'stable'}
    
    async def _get_ai_confidence(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get AI model confidence in current analysis"""
        try:
            # This would typically use the AI model to assess its own confidence
            # For now, calculate based on data quality and completeness
            
            watersheds = data.get('watersheds', [])
            total_watersheds = len(watersheds)
            
            if total_watersheds == 0:
                return {'score': 0, 'reliability': 'No data'}
            
            # Factors affecting confidence
            recent_data_count = sum(1 for w in watersheds if self._is_recent_data(w))
            usgs_data_count = sum(1 for w in watersheds if w.get('data_source') == 'usgs')
            
            # Calculate confidence score
            data_freshness = (recent_data_count / total_watersheds) * 100
            data_quality = (usgs_data_count / total_watersheds) * 100
            
            # Weighted confidence score
            confidence = (data_freshness * 0.6 + data_quality * 0.4)
            
            if confidence >= 90:
                reliability = "Very High"
            elif confidence >= 75:
                reliability = "High"
            elif confidence >= 60:
                reliability = "Moderate"
            else:
                reliability = "Low"
            
            return {'score': confidence, 'reliability': reliability}
        
        except Exception as e:
            logger.error(f"Error calculating AI confidence: {e}")
            return {'score': 50, 'reliability': 'Uncertain'}
    
    async def _predict_peak_risk(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict when peak risk conditions will occur"""
        try:
            if len(self.risk_history) < 3:
                return None
            
            # Simple prediction based on current trends
            recent_trend = await self._analyze_trends(data)
            
            if recent_trend['trend'] == 'up' and recent_trend['rate'] > 1:
                # Predict peak will occur in next 6-12 hours
                hours_to_peak = max(2, 10 - recent_trend['rate'])
                peak_time = datetime.now(timezone.utc) + timedelta(hours=hours_to_peak)
                
                time_range = f"Next {hours_to_peak:.0f} hours"
                confidence = min(90, 60 + recent_trend['rate'] * 5)
                severity = 'high' if recent_trend['rate'] > 3 else 'moderate'
                
                return {
                    'time_range': time_range,
                    'confidence': confidence,
                    'severity': severity,
                    'peak_time': peak_time
                }
            
            return None
        
        except Exception as e:
            logger.error(f"Error predicting peak risk: {e}")
            return None
    
    async def _detect_rapid_risk_change(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect rapid changes in risk levels"""
        affected_areas = []
        max_rate = 0
        
        watersheds = data.get('watersheds', [])
        
        for watershed in watersheds:
            # Check if this watershed has rapid risk increase
            current_risk = watershed.get('risk_score', 0)
            trend_rate = watershed.get('trend_rate_cfs_per_hour', 0)
            
            # Convert flow rate to risk rate (simplified)
            if trend_rate > 100:  # Significant flow increase
                risk_rate = trend_rate / 50  # Approximate conversion
                if risk_rate > 2:  # Rapid increase threshold
                    affected_areas.append(watershed.get('name', 'Unknown'))
                    max_rate = max(max_rate, risk_rate)
        
        return {
            'rapid_increase': len(affected_areas) > 0,
            'affected_areas': affected_areas,
            'rate': max_rate
        }
    
    async def _check_threshold_breaches(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check for critical threshold breaches"""
        breaches = []
        watersheds = data.get('watersheds', [])
        
        for watershed in watersheds:
            risk_score = watershed.get('risk_score', 0)
            current_flow = watershed.get('current_streamflow_cfs', 0)
            flood_stage = watershed.get('flood_stage_cfs')
            
            # Check risk score threshold
            if risk_score >= 9:
                breaches.append({
                    'watershed': watershed.get('name', 'Unknown'),
                    'type': 'risk_score',
                    'value': risk_score,
                    'threshold': 9
                })
            
            # Check flood stage threshold
            if flood_stage and current_flow >= flood_stage * 0.9:  # 90% of flood stage
                breaches.append({
                    'watershed': watershed.get('name', 'Unknown'),
                    'type': 'flood_stage',
                    'value': current_flow,
                    'threshold': flood_stage * 0.9
                })
        
        return breaches
    
    async def _detect_pattern_anomalies(self, data: Dict[str, Any]) -> bool:
        """Detect unusual patterns that deviate from normal"""
        try:
            # This would use more sophisticated anomaly detection
            # For now, simple heuristics
            
            watersheds = data.get('watersheds', [])
            if not watersheds:
                return False
            
            # Check for unusual combinations
            high_risk_low_flow = 0
            for watershed in watersheds:
                risk_score = watershed.get('risk_score', 0)
                current_flow = watershed.get('current_streamflow_cfs', 0)
                
                # Anomaly: High risk but low flow (unusual)
                if risk_score > 7 and current_flow < 100:
                    high_risk_low_flow += 1
            
            # If more than 20% of watersheds show this pattern, it's anomalous
            anomaly_threshold = len(watersheds) * 0.2
            
            return high_risk_low_flow > anomaly_threshold
        
        except Exception as e:
            logger.error(f"Error detecting pattern anomalies: {e}")
            return False
    
    def _is_recent_data(self, watershed: Dict[str, Any]) -> bool:
        """Check if watershed has recent data"""
        last_updated = watershed.get('last_updated')
        if not last_updated:
            return False
        
        try:
            update_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            age = datetime.now(timezone.utc) - update_time
            return age < timedelta(hours=2)
        except:
            return False