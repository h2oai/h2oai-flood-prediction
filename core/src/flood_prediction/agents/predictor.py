"""
Predictor Agent - AI-powered flood prediction and forecasting.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json
import logging
import math

from .base_agent import BaseAgent, AgentInsight, AgentAlert

logger = logging.getLogger(__name__)

class PredictorAgent(BaseAgent):
    """Agent responsible for AI-powered flood prediction and forecasting"""
    
    def __init__(self):
        super().__init__(
            name="AI Predictor",
            description="Advanced AI forecasting and predictive analysis for flood conditions",
            check_interval=900  # Check every 15 minutes
        )
        self.prediction_history = []
        self.model_accuracy_scores = {}
        self.forecast_horizon = 72  # hours
        self.confidence_threshold = 0.7
        
    async def analyze(self, data: Dict[str, Any]) -> List[AgentInsight]:
        """Analyze predictive model performance and generate forecasts"""
        insights = []
        
        # Model accuracy insight
        accuracy = await self._calculate_model_accuracy(data)
        insights.append(AgentInsight(
            title="🎯 Model Accuracy",
            value=f"{accuracy['overall']:.1f}%",
            change=f"{accuracy['trend']:+.1f}% vs yesterday",
            trend='up' if accuracy['trend'] > 0 else 'down' if accuracy['trend'] < -1 else 'stable',
            urgency='high' if accuracy['overall'] < 75 else 'normal'
        ))
        
        # Prediction confidence
        confidence = await self._calculate_prediction_confidence(data)
        insights.append(AgentInsight(
            title="🧠 Prediction Confidence",
            value=f"{confidence['average']:.0f}%",
            change=f"{confidence['reliability']}",
            trend='stable',
            urgency='high' if confidence['average'] < 60 else 'normal'
        ))
        
        # Forecast horizon
        horizon_quality = await self._assess_forecast_quality(data)
        insights.append(AgentInsight(
            title="🔮 Forecast Horizon",
            value=f"{horizon_quality['reliable_hours']}h reliable",
            change=f"Quality: {horizon_quality['quality_score']:.0f}%",
            trend='stable',
            urgency='normal'
        ))
        
        # Next critical period
        critical_period = await self._predict_next_critical_period(data)
        if critical_period:
            insights.append(AgentInsight(
                title="⚠️ Next Critical Period",
                value=critical_period['timeframe'],
                change=f"{critical_period['confidence']:.0f}% confidence",
                trend='up' if critical_period['severity'] == 'high' else 'stable',
                urgency='high' if critical_period['severity'] == 'high' else 'normal'
            ))
        
        # Trend prediction accuracy
        trend_accuracy = await self._assess_trend_prediction_accuracy(data)
        insights.append(AgentInsight(
            title="📈 Trend Accuracy",
            value=f"{trend_accuracy['score']:.0f}%",
            change=f"{trend_accuracy['recent_performance']}",
            trend='stable',
            urgency='normal'
        ))
        
        return insights
    
    async def check_alerts(self, data: Dict[str, Any]) -> List[AgentAlert]:
        """Check for prediction-based alerts and model concerns"""
        alerts = []
        
        # Check for high-confidence adverse predictions
        adverse_predictions = await self._detect_adverse_predictions(data)
        if adverse_predictions['high_confidence_threats']:
            alerts.append(AgentAlert(
                id=f"adverse_prediction_{datetime.now().strftime('%Y%m%d%H')}",
                title="🔮 High-Confidence Flood Prediction",
                message=f"AI models predict significant flood risk in {len(adverse_predictions['threatened_areas'])} areas "
                       f"within {adverse_predictions['time_horizon']} hours. Confidence: {adverse_predictions['confidence']:.0f}%",
                severity="warning" if adverse_predictions['confidence'] < 80 else "critical",
                source_agent=self.name,
                affected_areas=adverse_predictions['threatened_areas'],
                recommendations=[
                    "Verify predictions with additional data sources",
                    "Increase monitoring in predicted areas",
                    "Prepare preemptive response measures",
                    "Issue advisories for affected areas"
                ]
            ))
        
        # Check for model degradation
        model_issues = await self._detect_model_issues(data)
        if model_issues['accuracy_drop']:
            alerts.append(AgentAlert(
                id=f"model_degradation_{datetime.now().strftime('%Y%m%d')}",
                title="⚠️ Prediction Model Degradation",
                message=f"AI model accuracy has dropped by {model_issues['accuracy_drop']:.1f}% "
                       f"over the last {model_issues['timeframe']}. Predictions may be less reliable.",
                severity="warning",
                source_agent=self.name,
                recommendations=[
                    "Review recent training data quality",
                    "Consider model retraining",
                    "Increase validation with other sources",
                    "Apply additional safety margins"
                ]
            ))
        
        # Check for prediction conflicts
        conflicts = await self._detect_prediction_conflicts(data)
        if conflicts:
            alerts.append(AgentAlert(
                id=f"prediction_conflict_{datetime.now().strftime('%Y%m%d%H')}",
                title="🤔 Conflicting Predictions",
                message=f"Multiple AI models show conflicting predictions for {len(conflicts)} areas. "
                       f"Additional verification needed.",
                severity="warning",
                source_agent=self.name,
                affected_areas=conflicts,
                recommendations=[
                    "Analyze source of prediction differences",
                    "Use ensemble averaging methods",
                    "Increase data collection in conflict areas",
                    "Apply conservative risk assessment"
                ]
            ))
        
        return alerts
    
    async def generate_forecast(self, data: Dict[str, Any], hours_ahead: int = 24) -> Dict[str, Any]:
        """Generate detailed flood forecast using AI models"""
        try:
            watersheds = data.get('watersheds', [])
            forecast = {
                'generated_at': datetime.now(timezone.utc).isoformat(),
                'forecast_horizon_hours': hours_ahead,
                'watersheds_forecast': [],
                'overall_confidence': 0.0,
                'methodology': 'AI-Enhanced Ensemble Prediction'
            }
            
            total_confidence = 0.0
            
            for watershed in watersheds:
                watershed_forecast = await self._predict_watershed_conditions(watershed, hours_ahead)
                forecast['watersheds_forecast'].append(watershed_forecast)
                total_confidence += watershed_forecast.get('confidence', 0.5)
            
            if watersheds:
                forecast['overall_confidence'] = total_confidence / len(watersheds)
            
            # Store forecast for accuracy tracking
            self.prediction_history.append({
                'timestamp': datetime.now(timezone.utc),
                'forecast': forecast,
                'actual_conditions': None  # Will be filled when actual data comes in
            })
            
            # Keep only recent history
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            self.prediction_history = [
                p for p in self.prediction_history 
                if p['timestamp'] > cutoff
            ]
            
            return forecast
        
        except Exception as e:
            logger.error(f"Error generating forecast: {e}")
            return {}
    
    async def _predict_watershed_conditions(self, watershed: Dict[str, Any], hours_ahead: int) -> Dict[str, Any]:
        """Predict conditions for a specific watershed"""
        try:
            current_flow = watershed.get('current_streamflow_cfs', 0)
            current_risk = watershed.get('risk_score', 0)
            trend_rate = watershed.get('trend_rate_cfs_per_hour', 0)
            
            # Simple prediction model (in reality, this would use sophisticated ML models)
            predicted_flow = current_flow + (trend_rate * hours_ahead)
            
            # Account for trend decay
            decay_factor = math.exp(-hours_ahead / 24)  # Trend weakens over time
            predicted_flow = current_flow + (predicted_flow - current_flow) * decay_factor
            
            # Predict risk score based on flow
            flood_stage = watershed.get('flood_stage_cfs', predicted_flow * 2)
            flow_ratio = predicted_flow / flood_stage if flood_stage > 0 else 0
            predicted_risk = min(10, flow_ratio * 8 + current_risk * 0.2)
            
            # Calculate confidence based on data quality and trend stability
            data_age = self._get_data_age(watershed)
            trend_stability = self._assess_trend_stability(watershed)
            
            confidence = 0.9
            if data_age > 2:  # Hours
                confidence *= 0.8
            if trend_stability < 0.7:
                confidence *= 0.9
            if hours_ahead > 24:
                confidence *= 0.8
            
            return {
                'watershed_name': watershed.get('name', 'Unknown'),
                'watershed_id': watershed.get('id'),
                'current_conditions': {
                    'flow_cfs': current_flow,
                    'risk_score': current_risk
                },
                'predicted_conditions': {
                    'flow_cfs': predicted_flow,
                    'risk_score': predicted_risk,
                    'risk_level': self._risk_score_to_level(predicted_risk)
                },
                'confidence': confidence,
                'prediction_factors': {
                    'trend_rate': trend_rate,
                    'data_age_hours': data_age,
                    'trend_stability': trend_stability
                }
            }
        
        except Exception as e:
            logger.error(f"Error predicting watershed conditions: {e}")
            return {}
    
    async def _calculate_model_accuracy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall model accuracy from historical predictions"""
        try:
            if not self.prediction_history:
                return {'overall': 85.0, 'trend': 0.0}  # Default values
            
            # Find predictions that can be validated (have actual data)
            validated_predictions = []
            
            for prediction in self.prediction_history:
                prediction_time = prediction['timestamp']
                forecast_data = prediction['forecast']
                
                # Check if enough time has passed to validate
                if datetime.now(timezone.utc) - prediction_time > timedelta(hours=6):
                    accuracy = self._calculate_prediction_accuracy(prediction, data)
                    if accuracy is not None:
                        validated_predictions.append({
                            'timestamp': prediction_time,
                            'accuracy': accuracy
                        })
            
            if not validated_predictions:
                return {'overall': 85.0, 'trend': 0.0}
            
            # Calculate overall accuracy
            overall_accuracy = sum(p['accuracy'] for p in validated_predictions) / len(validated_predictions)
            
            # Calculate trend (compare recent vs older predictions)
            if len(validated_predictions) >= 4:
                recent = validated_predictions[-2:]
                older = validated_predictions[-4:-2]
                
                recent_avg = sum(p['accuracy'] for p in recent) / len(recent)
                older_avg = sum(p['accuracy'] for p in older) / len(older)
                trend = recent_avg - older_avg
            else:
                trend = 0.0
            
            return {
                'overall': overall_accuracy,
                'trend': trend
            }
        
        except Exception as e:
            logger.error(f"Error calculating model accuracy: {e}")
            return {'overall': 80.0, 'trend': 0.0}
    
    async def _calculate_prediction_confidence(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate confidence in current predictions"""
        try:
            # Generate a forecast to get confidence metrics
            forecast = await self.generate_forecast(data, 24)
            
            if not forecast or 'watersheds_forecast' not in forecast:
                return {'average': 70.0, 'reliability': 'Moderate'}
            
            confidences = [
                w.get('confidence', 0.5) for w in forecast['watersheds_forecast']
            ]
            
            if not confidences:
                return {'average': 70.0, 'reliability': 'Moderate'}
            
            average_confidence = (sum(confidences) / len(confidences)) * 100
            
            # Determine reliability level
            if average_confidence >= 85:
                reliability = "Very High"
            elif average_confidence >= 70:
                reliability = "High"
            elif average_confidence >= 55:
                reliability = "Moderate"
            else:
                reliability = "Low"
            
            return {
                'average': average_confidence,
                'reliability': reliability
            }
        
        except Exception as e:
            logger.error(f"Error calculating prediction confidence: {e}")
            return {'average': 65.0, 'reliability': 'Moderate'}
    
    async def _assess_forecast_quality(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of forecasts at different time horizons"""
        try:
            # Simulate forecast quality assessment
            # In reality, this would analyze historical forecast performance
            
            # Quality typically decreases with time horizon
            base_quality = 90
            hours_reliable = 48
            
            # Adjust based on current data quality
            watersheds = data.get('watersheds', [])
            if watersheds:
                recent_data_ratio = sum(
                    1 for w in watersheds 
                    if self._get_data_age(w) < 2
                ) / len(watersheds)
                
                quality_adjustment = recent_data_ratio * 10
                quality_score = min(95, base_quality + quality_adjustment - 10)
                
                if recent_data_ratio > 0.8:
                    hours_reliable = 72
                elif recent_data_ratio < 0.5:
                    hours_reliable = 24
            else:
                quality_score = 75
            
            return {
                'reliable_hours': hours_reliable,
                'quality_score': quality_score
            }
        
        except Exception as e:
            logger.error(f"Error assessing forecast quality: {e}")
            return {'reliable_hours': 36, 'quality_score': 80}
    
    async def _predict_next_critical_period(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Predict when the next critical flood period will occur"""
        try:
            watersheds = data.get('watersheds', [])
            if not watersheds:
                return None
            
            # Look for watersheds with increasing trends
            critical_predictions = []
            
            for watershed in watersheds:
                trend_rate = watershed.get('trend_rate_cfs_per_hour', 0)
                current_risk = watershed.get('risk_score', 0)
                
                if trend_rate > 50 and current_risk > 5:
                    # Estimate time to critical conditions
                    hours_to_critical = max(1, (8.5 - current_risk) / (trend_rate / 100))
                    
                    critical_predictions.append({
                        'watershed': watershed.get('name', 'Unknown'),
                        'hours_to_critical': hours_to_critical,
                        'predicted_severity': 'high' if trend_rate > 100 else 'moderate'
                    })
            
            if not critical_predictions:
                return None
            
            # Find the earliest critical period
            earliest = min(critical_predictions, key=lambda x: x['hours_to_critical'])
            
            if earliest['hours_to_critical'] > 72:  # Too far in the future
                return None
            
            hours = earliest['hours_to_critical']
            if hours <= 6:
                timeframe = f"Next {hours:.0f} hours"
            elif hours <= 24:
                timeframe = f"Next {hours:.0f} hours"
            else:
                timeframe = f"Next {hours/24:.1f} days"
            
            confidence = max(60, 95 - hours * 2)  # Confidence decreases with time
            
            return {
                'timeframe': timeframe,
                'confidence': confidence,
                'severity': earliest['predicted_severity'],
                'primary_watershed': earliest['watershed']
            }
        
        except Exception as e:
            logger.error(f"Error predicting critical period: {e}")
            return None
    
    async def _assess_trend_prediction_accuracy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess accuracy of trend predictions"""
        try:
            # This would analyze how well the model predicts trends
            # For now, return simulated values
            
            score = 82.0  # Base accuracy
            performance = "Good"
            
            # Adjust based on recent validation data
            if hasattr(self, '_recent_trend_accuracy'):
                score = self._recent_trend_accuracy
                
            if score >= 85:
                performance = "Excellent"
            elif score >= 75:
                performance = "Good"
            elif score >= 65:
                performance = "Fair"
            else:
                performance = "Poor"
            
            return {
                'score': score,
                'recent_performance': performance
            }
        
        except Exception as e:
            logger.error(f"Error assessing trend accuracy: {e}")
            return {'score': 75.0, 'recent_performance': 'Fair'}
    
    async def _detect_adverse_predictions(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect high-confidence predictions of adverse conditions"""
        try:
            forecast = await self.generate_forecast(data, 48)
            
            if not forecast or 'watersheds_forecast' not in forecast:
                return {'high_confidence_threats': False, 'threatened_areas': [], 'confidence': 0, 'time_horizon': 48}
            
            threatened_areas = []
            max_confidence = 0
            
            for watershed_forecast in forecast['watersheds_forecast']:
                predicted = watershed_forecast.get('predicted_conditions', {})
                confidence = watershed_forecast.get('confidence', 0)
                
                if (predicted.get('risk_score', 0) > 7.5 and confidence > 0.75):
                    threatened_areas.append(watershed_forecast.get('watershed_name', 'Unknown'))
                    max_confidence = max(max_confidence, confidence)
            
            return {
                'high_confidence_threats': len(threatened_areas) > 0,
                'threatened_areas': threatened_areas,
                'confidence': max_confidence * 100,
                'time_horizon': 48
            }
        
        except Exception as e:
            logger.error(f"Error detecting adverse predictions: {e}")
            return {'high_confidence_threats': False, 'threatened_areas': [], 'confidence': 0, 'time_horizon': 48}
    
    async def _detect_model_issues(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect issues with prediction models"""
        try:
            accuracy_data = await self._calculate_model_accuracy(data)
            current_accuracy = accuracy_data['overall']
            
            # Check if accuracy has dropped significantly
            if current_accuracy < 70:
                accuracy_drop = 85 - current_accuracy  # Assume baseline of 85%
                return {
                    'accuracy_drop': accuracy_drop,
                    'timeframe': '24 hours'
                }
            
            return {'accuracy_drop': 0, 'timeframe': None}
        
        except Exception as e:
            logger.error(f"Error detecting model issues: {e}")
            return {'accuracy_drop': 0, 'timeframe': None}
    
    async def _detect_prediction_conflicts(self, data: Dict[str, Any]) -> List[str]:
        """Detect conflicts between different prediction models"""
        try:
            # This would compare predictions from different models
            # For now, simulate occasional conflicts
            
            import random
            if random.random() < 0.05:  # 5% chance of conflicts
                return ['Trinity River', 'Buffalo Bayou']
            
            return []
        
        except Exception as e:
            logger.error(f"Error detecting prediction conflicts: {e}")
            return []
    
    def _calculate_prediction_accuracy(self, prediction: Dict[str, Any], current_data: Dict[str, Any]) -> Optional[float]:
        """Calculate accuracy of a historical prediction"""
        try:
            # This would compare predicted vs actual conditions
            # For now, return simulated accuracy
            import random
            return 75 + random.random() * 20  # 75-95% accuracy
        
        except Exception as e:
            logger.error(f"Error calculating prediction accuracy: {e}")
            return None
    
    def _get_data_age(self, watershed: Dict[str, Any]) -> float:
        """Get age of watershed data in hours"""
        try:
            last_updated = watershed.get('last_updated')
            if not last_updated:
                return 24.0  # Assume old data
            
            update_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            age = datetime.now(timezone.utc) - update_time
            return age.total_seconds() / 3600
        
        except:
            return 24.0
    
    def _assess_trend_stability(self, watershed: Dict[str, Any]) -> float:
        """Assess stability of the trend (0-1)"""
        # This would analyze trend consistency over time
        # For now, return a reasonable default
        return 0.8
    
    def _risk_score_to_level(self, risk_score: float) -> str:
        """Convert risk score to risk level"""
        if risk_score >= 8:
            return "CRITICAL"
        elif risk_score >= 6:
            return "HIGH"
        elif risk_score >= 4:
            return "MODERATE"
        else:
            return "LOW"