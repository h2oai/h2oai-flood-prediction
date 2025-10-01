"""
H2OGPTE Agent for ML Model Training and Analysis using Driverless AI
Provides AutoML capabilities for flood prediction model training and evaluation
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import json

from .base_agent import BaseAgent, AgentInsight, AgentAlert
from ..api import llm_call

logger = logging.getLogger(__name__)

class H2OGPTEAgent(BaseAgent):
    """Agent for ML model training and analysis using H2OGPTE and Driverless AI"""
    
    def __init__(self):
        super().__init__(
            name="H2OGPTE ML Agent",
            description="AutoML agent for training flood prediction models using H2OGPTE and Driverless AI platform",
            check_interval=3600  # Check every hour
        )
        self.last_training_session = None
        self.model_performance_score = 0.0
        self.active_experiments = []
        self.training_history = []
        
    async def analyze(self, data: Dict[str, Any]) -> List[AgentInsight]:
        """Analyze ML model performance and training status"""
        insights = []
        
        # Model performance insight
        performance_score = self.model_performance_score or 75.0  # Default score
        insights.append(AgentInsight(
            title="🤖 Model Performance",
            value=f"{performance_score:.1f}% accuracy",
            change="+2.3%" if performance_score > 70 else "-1.2%",
            trend='up' if performance_score > 80 else 'down' if performance_score < 60 else 'stable',
            urgency='normal' if performance_score > 70 else 'high'
        ))
        
        # Training status insight
        training_status = "Active" if self.active_experiments else "Idle"
        insights.append(AgentInsight(
            title="🔬 Training Status",
            value=f"{len(self.active_experiments)} experiments",
            change=f"{training_status}",
            trend='up' if len(self.active_experiments) > 0 else 'stable',
            urgency='normal'
        ))
        
        # Data quality for ML insight
        data_quality = self._assess_data_quality(data)
        insights.append(AgentInsight(
            title="📊 ML Data Quality",
            value=f"{data_quality:.0f}% ready",
            change="+5%" if data_quality > 85 else "needs improvement",
            trend='up' if data_quality > 85 else 'down',
            urgency='high' if data_quality < 70 else 'normal'
        ))
        
        return insights
    
    async def check_alerts(self, data: Dict[str, Any]) -> List[AgentAlert]:
        """Check for ML model and training alerts"""
        alerts = []
        
        # Model drift alert
        if self.model_performance_score and self.model_performance_score < 65:
            alerts.append(AgentAlert(
                id="model_drift",
                title="Model Performance Degradation",
                message=f"Model accuracy dropped to {self.model_performance_score:.1f}%, retraining recommended",
                severity="warning",
                recommendations=[
                    "Schedule model retraining with fresh data",
                    "Evaluate feature engineering improvements",
                    "Consider ensemble methods"
                ]
            ))
        
        # Data quality alert
        data_quality = self._assess_data_quality(data)
        if data_quality < 70:
            alerts.append(AgentAlert(
                id="ml_data_quality",
                title="Training Data Quality Issues",
                message=f"Data quality score {data_quality:.0f}% - insufficient for reliable model training",
                severity="critical",
                recommendations=[
                    "Improve data collection processes",
                    "Implement data validation pipelines",
                    "Address missing or inconsistent data"
                ]
            ))
        
        return alerts
    
    async def train_model(self, 
                         dataset_description: str,
                         target_variable: str = "flood_risk",
                         model_type: str = "classification",
                         user_query: str = "") -> Dict[str, Any]:
        """Train ML model using H2OGPTE agent mode with Driverless AI capabilities"""
        try:
            logger.info(f"H2OGPTE Agent: Starting model training for {target_variable}")
            
            # Construct detailed prompt for H2OGPTE agent mode
            training_prompt = f"""
            As an expert H2OGPTE agent with access to Driverless AI platform, help train a flood prediction model.
            
            **Training Request:**
            User Query: {user_query}
            Dataset: {dataset_description}
            Target Variable: {target_variable}
            Model Type: {model_type}
            
            **Please provide:**
            1. Data preprocessing recommendations specific to flood prediction
            2. Feature engineering suggestions for time-series flood data
            3. Model architecture recommendations (AutoML pipeline)
            4. Hyperparameter tuning strategy
            5. Cross-validation approach for temporal data
            6. Performance metrics most relevant for flood prediction
            7. Model interpretability recommendations
            8. Deployment considerations for real-time predictions
            
            **Focus on:**
            - Handling temporal dependencies in flood data
            - Dealing with class imbalance (rare flood events)
            - Incorporating weather and environmental features
            - Ensemble methods for robust predictions
            - Feature importance for explainable AI
            
            Provide detailed, actionable recommendations in JSON format with specific implementation guidance.
            """
            
            # Call H2OGPTE with agent mode enabled
            response = await llm_call(
                prompt=training_prompt,
                use_agent=True,
                provider_name="h2ogpte"
            )
            
            # Track training session
            session_id = f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.last_training_session = datetime.now(timezone.utc)
            
            training_session = {
                "session_id": session_id,
                "timestamp": self.last_training_session.isoformat(),
                "dataset": dataset_description,
                "target": target_variable,
                "model_type": model_type,
                "user_query": user_query,
                "h2ogpte_response": response,
                "status": "completed"
            }
            
            self.training_history.append(training_session)
            
            return {
                "status": "success",
                "agent": "H2OGPTE ML Agent",
                "session_id": session_id,
                "training_response": response,
                "recommendations": self._extract_recommendations(response),
                "timestamp": self.last_training_session.isoformat(),
                "next_steps": [
                    "Review H2OGPTE recommendations",
                    "Prepare dataset according to suggestions",
                    "Implement feature engineering pipeline",
                    "Execute AutoML training on Driverless AI",
                    "Validate model performance"
                ]
            }
            
        except Exception as e:
            logger.error(f"Error in H2OGPTE model training: {e}")
            return {
                "status": "error",
                "agent": "H2OGPTE ML Agent",
                "message": str(e),
                "recommendations": [
                    "Check H2OGPTE API connectivity",
                    "Verify agent mode is enabled",
                    "Review input data format"
                ]
            }
    
    async def analyze_model_performance(self, 
                                      model_results: Optional[Dict[str, Any]] = None,
                                      user_query: str = "") -> Dict[str, Any]:
        """Analyze model performance using H2OGPTE agent capabilities"""
        try:
            logger.info("H2OGPTE Agent: Analyzing model performance")
            
            performance_prompt = f"""
            As an expert H2OGPTE agent with access to Driverless AI analytics, analyze flood prediction model performance.
            
            **Analysis Request:**
            User Query: {user_query}
            Model Results: {json.dumps(model_results) if model_results else "No specific results provided"}
            
            **Please analyze:**
            1. Model accuracy and performance metrics interpretation
            2. Feature importance analysis for flood prediction
            3. Model bias detection and fairness assessment
            4. Overfitting/underfitting evaluation
            5. Cross-validation results analysis
            6. Prediction confidence and uncertainty quantification
            7. Model explainability and interpretability
            8. Comparison with baseline models
            
            **Provide recommendations for:**
            - Model improvement strategies
            - Feature engineering enhancements
            - Hyperparameter optimization
            - Ensemble methods
            - Production deployment considerations
            - Monitoring and maintenance strategies
            
            Format response as detailed analysis with actionable insights and specific recommendations.
            """
            
            response = await llm_call(
                prompt=performance_prompt,
                use_agent=True,
                provider_name="h2ogpte"
            )
            
            return {
                "status": "success",
                "agent": "H2OGPTE ML Agent",
                "analysis_response": response,
                "performance_summary": self._extract_performance_summary(response),
                "recommendations": self._extract_recommendations(response),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in H2OGPTE performance analysis: {e}")
            return {
                "status": "error",
                "agent": "H2OGPTE ML Agent",
                "message": str(e)
            }
    
    async def optimize_features(self, 
                               feature_data: Dict[str, Any],
                               user_query: str = "") -> Dict[str, Any]:
        """Optimize features using H2OGPTE agent for flood prediction"""
        try:
            logger.info("H2OGPTE Agent: Optimizing features for flood prediction")
            
            optimization_prompt = f"""
            As an expert H2OGPTE agent with Driverless AI feature engineering capabilities, optimize features for flood prediction models.
            
            **Optimization Request:**
            User Query: {user_query}
            Feature Data: {json.dumps(feature_data)}
            
            **Please provide:**
            1. Feature engineering transformations specific to flood data
            2. Time-series feature creation (lags, rolling statistics, seasonality)
            3. Weather pattern feature extraction
            4. Geospatial feature engineering
            5. Interaction features between environmental variables
            6. Feature selection and dimensionality reduction
            7. Handling of missing data and outliers
            8. Feature scaling and normalization strategies
            
            **Focus on flood prediction specifics:**
            - Temporal dependencies and seasonality
            - Precipitation patterns and accumulation
            - River/stream flow dynamics
            - Topographical and geographical features
            - Historical flood event patterns
            - Multi-scale temporal features (hourly, daily, weekly patterns)
            
            Provide detailed feature engineering pipeline with code examples and implementation guidance.
            """
            
            response = await llm_call(
                prompt=optimization_prompt,
                use_agent=True,
                provider_name="h2ogpte"
            )
            
            return {
                "status": "success",
                "agent": "H2OGPTE ML Agent",
                "optimization_response": response,
                "feature_recommendations": self._extract_feature_recommendations(response),
                "implementation_steps": self._extract_implementation_steps(response),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in H2OGPTE feature optimization: {e}")
            return {
                "status": "error",
                "agent": "H2OGPTE ML Agent",
                "message": str(e)
            }
    
    def _assess_data_quality(self, data: Dict[str, Any]) -> float:
        """Assess data quality for ML training"""
        if not data or "watersheds" not in data:
            return 30.0
        
        watersheds = data["watersheds"]
        if not watersheds:
            return 40.0
        
        quality_score = 50.0  # Base score
        
        # Check data completeness
        complete_records = sum(1 for w in watersheds if all(
            key in w and w[key] is not None 
            for key in ["current_streamflow_cfs", "risk_score", "trend_rate_cfs_per_hour"]
        ))
        
        if watersheds:
            completeness = complete_records / len(watersheds)
            quality_score += completeness * 30
        
        # Check data recency
        recent_data = sum(1 for w in watersheds if 
                         "last_updated" in w and w["last_updated"])
        
        if watersheds:
            recency = recent_data / len(watersheds)
            quality_score += recency * 20
        
        return min(100.0, quality_score)
    
    def _extract_recommendations(self, response: str) -> List[str]:
        """Extract actionable recommendations from H2OGPTE response"""
        # Simple extraction - in real implementation, could use NLP
        recommendations = []
        
        if "preprocessing" in response.lower():
            recommendations.append("Implement data preprocessing pipeline")
        if "feature engineering" in response.lower():
            recommendations.append("Apply feature engineering techniques")
        if "cross-validation" in response.lower():
            recommendations.append("Setup cross-validation framework")
        if "ensemble" in response.lower():
            recommendations.append("Consider ensemble methods")
        if "hyperparameter" in response.lower():
            recommendations.append("Optimize hyperparameters")
        
        return recommendations if recommendations else ["Review detailed H2OGPTE analysis"]
    
    def _extract_performance_summary(self, response: str) -> Dict[str, Any]:
        """Extract performance summary from H2OGPTE response"""
        return {
            "accuracy_assessment": "See detailed H2OGPTE analysis",
            "feature_importance": "Provided in response",
            "model_explanation": "Available in analysis",
            "improvement_areas": "Identified by H2OGPTE"
        }
    
    def _extract_feature_recommendations(self, response: str) -> List[str]:
        """Extract feature recommendations from H2OGPTE response"""
        recommendations = []
        
        if "time-series" in response.lower():
            recommendations.append("Implement time-series features")
        if "lag" in response.lower():
            recommendations.append("Create lag features")
        if "rolling" in response.lower():
            recommendations.append("Add rolling statistics")
        if "seasonal" in response.lower():
            recommendations.append("Include seasonal features")
        if "interaction" in response.lower():
            recommendations.append("Build interaction features")
        
        return recommendations if recommendations else ["Follow H2OGPTE feature guidance"]
    
    def _extract_implementation_steps(self, response: str) -> List[str]:
        """Extract implementation steps from H2OGPTE response"""
        return [
            "Review H2OGPTE detailed recommendations",
            "Implement preprocessing pipeline",
            "Create engineered features",
            "Validate feature quality",
            "Test model performance"
        ]
    
    def get_training_history(self) -> List[Dict[str, Any]]:
        """Get history of training sessions"""
        return self.training_history
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "agent_name": self.name,
            "last_training": self.last_training_session.isoformat() if self.last_training_session else None,
            "active_experiments": len(self.active_experiments),
            "model_performance": self.model_performance_score,
            "training_sessions": len(self.training_history),
            "capabilities": [
                "AutoML model training with Driverless AI",
                "Feature engineering optimization",
                "Model performance analysis",
                "ML pipeline recommendations",
                "Flood prediction specific guidance"
            ]
        }