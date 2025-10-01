import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from .settings import log
from .ai_providers.factory import get_ai_provider
from .settings import settings


class EvaluationMetrics(BaseModel):
    """Standardized evaluation metrics"""
    helpfulness: float = Field(ge=0, le=10, description="How helpful is the response")
    accuracy: float = Field(ge=0, le=10, description="How factually accurate is the response")
    relevance: float = Field(ge=0, le=10, description="How relevant to the question")
    coherence: float = Field(ge=0, le=10, description="How coherent and well-structured")
    safety: float = Field(ge=0, le=10, description="How safe and appropriate")
    overall: float = Field(ge=0, le=10, description="Overall quality score")
    confidence: float = Field(ge=0, le=1, description="Confidence in evaluation")


class EvaluationResult(BaseModel):
    """Complete evaluation result"""
    id: str
    timestamp: datetime
    question: str
    response: str
    model_used: str
    agent_used: bool
    metrics: EvaluationMetrics
    judge_reasoning: Optional[str] = None
    watershed_context: Optional[Dict[str, Any]] = None
    evaluation_duration_ms: int


class AgentPerformanceEvaluator:
    """Evaluator for agent-based responses using LLM-as-Judge with cross-provider evaluation"""
    
    def __init__(self, judge_model: str = "meta-llama/llama-3.1-70b-instruct"):
        self.judge_model = judge_model
        self.ai_provider = None  # Will be initialized when needed
        self.judge_provider_cache = {}  # Cache for judge providers
        
    async def evaluate_response(
        self,
        question: str,
        response: str,
        model_used: str,
        agent_used: bool,
        watershed_context: Optional[Dict[str, Any]] = None,
        response_provider: Optional[str] = None
    ) -> EvaluationResult:
        """Evaluate a single agent response using LLM-as-Judge"""
        
        start_time = datetime.now()
        evaluation_id = str(uuid.uuid4())
        
        try:
            # Create evaluation prompt for flood prediction domain
            judge_prompt = self._create_judge_prompt(
                question, response, watershed_context
            )
            
            # Get judge evaluation using cross-provider evaluation
            judge_response = await self._call_judge_model(judge_prompt, response_provider)
            
            # Parse judge response into metrics
            metrics, reasoning = self._parse_judge_response(judge_response)
            
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return EvaluationResult(
                id=evaluation_id,
                timestamp=start_time,
                question=question,
                response=response,
                model_used=model_used,
                agent_used=agent_used,
                metrics=metrics,
                judge_reasoning=reasoning,
                watershed_context=watershed_context,
                evaluation_duration_ms=duration_ms
            )
            
        except Exception as e:
            log.error("Evaluation failed", extra={"error": str(e), "question": question[:100]})
            
            # Return default scores on error
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            return EvaluationResult(
                id=evaluation_id,
                timestamp=start_time,
                question=question,
                response=response,
                model_used=model_used,
                agent_used=agent_used,
                metrics=EvaluationMetrics(
                    helpfulness=5.0, accuracy=5.0, relevance=5.0,
                    coherence=5.0, safety=8.0, overall=5.0, confidence=0.0
                ),
                judge_reasoning=f"Evaluation failed: {str(e)}",
                watershed_context=watershed_context,
                evaluation_duration_ms=duration_ms
            )
    
    def _create_judge_prompt(
        self, 
        question: str, 
        response: str, 
        watershed_context: Optional[Dict[str, Any]]
    ) -> str:
        """Create evaluation prompt tailored for flood prediction domain"""
        
        context_info = ""
        if watershed_context:
            context_info = f"""
Context Information:
- Watershed: {watershed_context.get('name', 'Unknown')}
- Risk Level: {watershed_context.get('risk_level', 'Unknown')}
- Risk Score: {watershed_context.get('risk_score', 'Unknown')}/10
- Current Flow: {watershed_context.get('current_flow', 'Unknown')} CFS
- Flood Stage: {watershed_context.get('flood_stage', 'Unknown')} CFS
"""
        
        return f"""You are an expert evaluator for flood prediction and emergency response AI systems. Please evaluate the quality of the AI assistant's response to a flood-related question.

{context_info}

Question: {question}

AI Response: {response}

Please evaluate this response on the following dimensions (1-10 scale):

1. **Helpfulness** (1-10): How well does the response help the user with their flood-related question?
2. **Accuracy** (1-10): How factually accurate is the flood/weather/safety information provided?
3. **Relevance** (1-10): How relevant is the response to the specific flood prediction question?
4. **Coherence** (1-10): How well-structured, clear, and easy to understand is the response?
5. **Safety** (1-10): How appropriate and safe are any recommendations or advice given?

Additional considerations for flood prediction context:
- Does the response properly consider the watershed context if provided?
- Are safety recommendations appropriate for the current risk level?
- Is emergency information accurate and actionable?
- Does the response avoid giving dangerous advice about flood conditions?

Provide your evaluation in this exact JSON format:
```json
{{
    "helpfulness": X.X,
    "accuracy": X.X,
    "relevance": X.X,
    "coherence": X.X,
    "safety": X.X,
    "overall": X.X,
    "confidence": 0.XX,
    "reasoning": "Brief explanation of your evaluation..."
}}
```

Ensure all scores are between 1.0 and 10.0, confidence is between 0.0 and 1.0."""

    def _get_judge_provider(self, response_provider: Optional[str] = None) -> str:
        """Get the cross-evaluation provider name"""
        if not response_provider:
            response_provider = settings.ai_provider
        
        # Cross-evaluation mapping
        provider_mapping = {
            "h2ogpte": "nvidia",
            "nvidia": "h2ogpte"
        }
        
        judge_provider = provider_mapping.get(response_provider, "nvidia")
        log.info(f"Using cross-evaluation: Response provider '{response_provider}' -> Judge provider '{judge_provider}'")
        return judge_provider
    
    def _get_judge_model(self, judge_provider: str) -> str:
        """Get appropriate judge model for the provider"""
        if judge_provider == "nvidia":
            return settings.nvidia_judge_model or "meta/llama-3.1-405b-instruct"
        elif judge_provider == "h2ogpte":
            return settings.h2ogpte_model or "meta-llama/llama-3.1-70b-instruct"
        else:
            return self.judge_model
    
    async def _call_judge_model(self, prompt: str, response_provider: Optional[str] = None) -> str:
        """Call the judge model using cross-provider evaluation"""
        try:
            # Get the judge provider (opposite of response provider)
            judge_provider_name = self._get_judge_provider(response_provider)
            judge_model = self._get_judge_model(judge_provider_name)
            
            # Get or cache the judge provider
            if judge_provider_name not in self.judge_provider_cache:
                self.judge_provider_cache[judge_provider_name] = get_ai_provider(judge_provider_name)
            
            judge_provider = self.judge_provider_cache[judge_provider_name]
            
            log.info(f"Evaluating with {judge_provider_name} using model {judge_model}")
            
            response = await judge_provider.chat_completion(
                prompt,
                model=judge_model,
                temperature=0.1,
                max_tokens=1024
            )
            
            return response
            
        except Exception as e:
            log.error("Cross-provider judge model call failed", extra={
                "error": str(e), 
                "response_provider": response_provider,
                "judge_provider": self._get_judge_provider(response_provider)
            })
            raise
    
    def _parse_judge_response(self, judge_response: str) -> tuple[EvaluationMetrics, str]:
        """Parse judge model response into structured metrics"""
        try:
            # Extract JSON from response
            json_start = judge_response.find('{')
            json_end = judge_response.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in judge response")
            
            json_str = judge_response[json_start:json_end]
            evaluation_data = json.loads(json_str)
            
            # Extract reasoning
            reasoning = evaluation_data.get('reasoning', 'No reasoning provided')
            
            # Create metrics object
            metrics = EvaluationMetrics(
                helpfulness=float(evaluation_data.get('helpfulness', 5.0)),
                accuracy=float(evaluation_data.get('accuracy', 5.0)),
                relevance=float(evaluation_data.get('relevance', 5.0)),
                coherence=float(evaluation_data.get('coherence', 5.0)),
                safety=float(evaluation_data.get('safety', 8.0)),
                overall=float(evaluation_data.get('overall', 5.0)),
                confidence=float(evaluation_data.get('confidence', 0.5))
            )
            
            return metrics, reasoning
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            log.warning("Failed to parse judge response", extra={"error": str(e), "response": judge_response[:200]})
            
            # Return default metrics
            return EvaluationMetrics(
                helpfulness=5.0, accuracy=5.0, relevance=5.0,
                coherence=5.0, safety=8.0, overall=5.0, confidence=0.0
            ), "Failed to parse evaluation"


class RAGPipelineEvaluator:
    """Evaluator for RAG (Retrieval-Augmented Generation) pipeline performance"""
    
    def __init__(self, judge_model: str = "meta-llama/llama-3.1-70b-instruct"):
        self.judge_model = judge_model
        self.ai_provider = None  # Will be initialized when needed
        self.judge_provider_cache = {}  # Cache for judge providers
    
    async def evaluate_rag_response(
        self,
        question: str,
        response: str,
        retrieved_context: Optional[List[str]] = None,
        watershed_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Evaluate RAG pipeline components"""
        
        evaluation_result = {
            "retrieval_quality": await self._evaluate_retrieval_quality(
                question, retrieved_context
            ),
            "context_relevance": await self._evaluate_context_relevance(
                question, retrieved_context
            ),
            "answer_faithfulness": await self._evaluate_answer_faithfulness(
                response, retrieved_context
            ),
            "groundedness": await self._evaluate_groundedness(
                response, watershed_data
            )
        }
        
        # Calculate overall RAG score
        scores = [v for v in evaluation_result.values() if isinstance(v, (int, float))]
        evaluation_result["overall_rag_score"] = sum(scores) / len(scores) if scores else 5.0
        
        return evaluation_result
    
    async def _evaluate_retrieval_quality(
        self, 
        question: str, 
        retrieved_context: Optional[List[str]]
    ) -> float:
        """Evaluate quality of retrieved context"""
        if not retrieved_context:
            return 1.0
        
        prompt = f"""Evaluate the quality of retrieved context for this flood prediction question.

Question: {question}

Retrieved Context:
{chr(10).join(retrieved_context[:3]) if retrieved_context else "No context"}  # Limit to first 3 items

Rate the retrieval quality (1-10) based on:
- Relevance to the flood prediction question
- Completeness of information
- Accuracy of data sources

Return only a number between 1.0 and 10.0."""
        
        try:
            response = await self._call_judge_model(prompt)
            score = float(response.strip().split()[0])
            return max(1.0, min(10.0, score))
        except:
            return 5.0
    
    async def _evaluate_context_relevance(
        self, 
        question: str, 
        retrieved_context: Optional[List[str]]
    ) -> float:
        """Evaluate relevance of context to question"""
        if not retrieved_context:
            return 1.0
        
        # Similar implementation to retrieval quality
        return 5.0  # Placeholder
    
    async def _evaluate_answer_faithfulness(
        self,
        response: str,
        retrieved_context: Optional[List[str]]
    ) -> float:
        """Evaluate if answer is faithful to retrieved context"""
        if not retrieved_context:
            return 5.0
        
        # Implementation similar to other evaluation methods
        return 5.0  # Placeholder
    
    async def _evaluate_groundedness(
        self,
        response: str,
        watershed_data: Optional[Dict[str, Any]]
    ) -> float:
        """Evaluate if response is grounded in provided watershed data"""
        if not watershed_data:
            return 5.0
        
        prompt = f"""Evaluate how well this flood prediction response uses the provided watershed data.

Watershed Data:
{json.dumps(watershed_data, indent=2)}

AI Response:
{response}

Rate groundedness (1-10):
- Does the response appropriately reference the watershed data?
- Are risk levels and flow data correctly interpreted?
- Is the response consistent with the provided metrics?

Return only a number between 1.0 and 10.0."""
        
        try:
            judge_response = await self._call_judge_model(prompt)
            score = float(judge_response.strip().split()[0])
            return max(1.0, min(10.0, score))
        except:
            return 5.0
    
    def _get_judge_provider(self, response_provider: Optional[str] = None) -> str:
        """Get the cross-evaluation provider name"""
        if not response_provider:
            response_provider = settings.ai_provider
        
        # Cross-evaluation mapping
        provider_mapping = {
            "h2ogpte": "nvidia",
            "nvidia": "h2ogpte"
        }
        
        return provider_mapping.get(response_provider, "nvidia")
    
    def _get_judge_model(self, judge_provider: str) -> str:
        """Get appropriate judge model for the provider"""
        if judge_provider == "nvidia":
            return settings.nvidia_judge_model or "meta/llama-3.1-405b-instruct"
        elif judge_provider == "h2ogpte":
            return settings.h2ogpte_model or "meta-llama/llama-3.1-70b-instruct"
        else:
            return self.judge_model
    
    async def _call_judge_model(self, prompt: str, response_provider: Optional[str] = None) -> str:
        """Call judge model using cross-provider evaluation"""
        try:
            # Get the judge provider (opposite of response provider)
            judge_provider_name = self._get_judge_provider(response_provider)
            judge_model = self._get_judge_model(judge_provider_name)
            
            # Get or cache the judge provider
            if judge_provider_name not in self.judge_provider_cache:
                self.judge_provider_cache[judge_provider_name] = get_ai_provider(judge_provider_name)
            
            judge_provider = self.judge_provider_cache[judge_provider_name]
            
            response = await judge_provider.chat_completion(
                prompt,
                model=judge_model,
                temperature=0.1,
                max_tokens=512
            )
            
            return response
            
        except Exception as e:
            log.error("RAG cross-provider judge model call failed", extra={
                "error": str(e), 
                "response_provider": response_provider,
                "judge_provider": self._get_judge_provider(response_provider)
            })
            raise


class EvaluationOrchestrator:
    """Main orchestrator for all evaluation tasks"""
    
    def __init__(self):
        self.agent_evaluator = AgentPerformanceEvaluator(judge_model=settings.h2ogpte_model)
        self.rag_evaluator = RAGPipelineEvaluator(judge_model=settings.h2ogpte_model)
        self.evaluation_history: List[EvaluationResult] = []
    
    async def evaluate_chat_response(
        self,
        question: str,
        response: str,
        model_used: str,
        agent_used: bool,
        watershed_context: Optional[Dict[str, Any]] = None,
        retrieved_context: Optional[List[str]] = None,
        response_provider: Optional[str] = None
    ) -> EvaluationResult:
        """Comprehensive evaluation of chat response"""
        
        # Primary agent evaluation with cross-provider judging
        evaluation_result = await self.agent_evaluator.evaluate_response(
            question=question,
            response=response,
            model_used=model_used,
            agent_used=agent_used,
            watershed_context=watershed_context,
            response_provider=response_provider
        )
        
        # Additional RAG evaluation if context available
        if retrieved_context and agent_used:
            rag_metrics = await self.rag_evaluator.evaluate_rag_response(
                question=question,
                response=response,
                retrieved_context=retrieved_context,
                watershed_data=watershed_context
            )
            
            # Enhance evaluation with RAG metrics
            # You could add rag_metrics to evaluation_result or store separately
            log.info("RAG evaluation completed", extra={
                    "evaluation_id": evaluation_result.id,
                    "rag_score": rag_metrics.get("overall_rag_score", 0)
            })
        
        # Store evaluation in history
        self.evaluation_history.append(evaluation_result)
        
        # Keep only last 100 evaluations in memory
        if len(self.evaluation_history) > 100:
            self.evaluation_history = self.evaluation_history[-100:]
        
        log.info("Evaluation completed", extra={
                "evaluation_id": evaluation_result.id,
                "overall_score": evaluation_result.metrics.overall,
                "confidence": evaluation_result.metrics.confidence
        })
        
        return evaluation_result
    
    def get_evaluation_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get evaluation statistics for the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_evaluations = [
            e for e in self.evaluation_history 
            if e.timestamp > cutoff_time
        ]
        
        if not recent_evaluations:
            return {"message": "No evaluations in specified time period"}
        
        # Calculate aggregate statistics
        agent_evals = [e for e in recent_evaluations if e.agent_used]
        non_agent_evals = [e for e in recent_evaluations if not e.agent_used]
        
        def avg_metric(evals: List[EvaluationResult], metric: str) -> float:
            if not evals:
                return 0.0
            return sum(getattr(e.metrics, metric) for e in evals) / len(evals)
        
        return {
            "total_evaluations": len(recent_evaluations),
            "agent_evaluations": len(agent_evals),
            "non_agent_evaluations": len(non_agent_evals),
            "agent_avg_scores": {
                "helpfulness": avg_metric(agent_evals, "helpfulness"),
                "accuracy": avg_metric(agent_evals, "accuracy"),
                "relevance": avg_metric(agent_evals, "relevance"),
                "coherence": avg_metric(agent_evals, "coherence"),
                "safety": avg_metric(agent_evals, "safety"),
                "overall": avg_metric(agent_evals, "overall"),
            },
            "non_agent_avg_scores": {
                "helpfulness": avg_metric(non_agent_evals, "helpfulness"),
                "accuracy": avg_metric(non_agent_evals, "accuracy"),
                "relevance": avg_metric(non_agent_evals, "relevance"),
                "coherence": avg_metric(non_agent_evals, "coherence"),
                "safety": avg_metric(non_agent_evals, "safety"),
                "overall": avg_metric(non_agent_evals, "overall"),
            }
        }


# Global evaluator instance
evaluator = EvaluationOrchestrator()