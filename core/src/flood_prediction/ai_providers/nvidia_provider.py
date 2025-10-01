from typing import Callable, Optional, List
import asyncio
from openai import OpenAI

from .base import AIProvider
from ..settings import settings


class NVIDIAProvider(AIProvider):
    """NVIDIA NIM AI Provider implementation using OpenAI-compatible client"""
    
    def __init__(self):
        if not settings.nvidia_api_key:
            raise ValueError("NVIDIA API key is required. Set NVIDIA_API_KEY environment variable.")
        
        self._client = OpenAI(
            base_url=settings.nvidia_base_url,
            api_key=settings.nvidia_api_key
        )
        self._available_models = None
    
    @property
    def provider_name(self) -> str:
        return "nvidia"
    
    @property
    def default_model(self) -> str:
        return settings.nvidia_default_model
    
    @property
    def supports_agents(self) -> bool:
        return False  # Basic NIM integration doesn't support agents yet
    
    def get_available_models(self) -> List[str]:
        """Get list of available models from NVIDIA NIM"""
        if self._available_models is not None:
            return self._available_models
            
        try:
            models_response = self._client.models.list()
            self._available_models = [model.id for model in models_response.data]
            return self._available_models
        except Exception as e:
            print(f"Error fetching NVIDIA models: {e}")
            # Return commonly available NVIDIA models as fallback
            self._available_models = [
                "meta/llama-3.1-70b-instruct",
                "meta/llama-3.1-8b-instruct", 
                "nvidia/llama-3.1-nemotron-70b-instruct",
                "nvidia/llama-3.1-nemotron-51b-instruct",
                "nvidia/nemotron-4-340b-instruct",
                "microsoft/phi-3-mini-128k-instruct",
                "microsoft/phi-3-small-128k-instruct"
            ]
            return self._available_models
    
    async def chat_completion(self, prompt: str, model: Optional[str] = None, 
                             temperature: float = 0.7, max_tokens: int = 4096,
                             **kwargs) -> str:
        """
        Generate a chat completion response using NVIDIA NIM
        
        Args:
            prompt: The input prompt/message
            model: Model name to use (optional)
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters (top_p, top_k, etc.)
            
        Returns:
            Generated response text
        """
        # Run the OpenAI client call in a thread pool to make it async
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._sync_chat_completion,
            prompt, model, temperature, max_tokens, kwargs
        )
    
    def _sync_chat_completion(self, prompt: str, model: Optional[str] = None,
                             temperature: float = 0.7, max_tokens: int = 4096,
                             extra_kwargs: dict = None) -> str:
        """Synchronous chat completion helper"""
        try:
            # Prepare messages
            messages = [{"role": "user", "content": prompt}]
            
            # Filter out unsupported parameters
            supported_params = {
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False
            }
            
            # Add supported extra parameters
            if extra_kwargs:
                for key, value in extra_kwargs.items():
                    if key in ["top_p", "top_k", "frequency_penalty", "presence_penalty"]:
                        supported_params[key] = value
            
            response = self._client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                **supported_params
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            raise RuntimeError(f"NVIDIA API error: {str(e)}")
    
    async def stream_completion(self, prompt: str, callback: Callable[[str], None],
                               model: Optional[str] = None, temperature: float = 0.7,
                               max_tokens: int = 4096, **kwargs) -> str:
        """
        Generate a streaming chat completion response using NVIDIA NIM
        
        Args:
            prompt: The input prompt/message
            callback: Function called with each streaming chunk
            model: Model name to use (optional)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Final complete response text
        """
        # Run the streaming call in a thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._sync_stream_completion,
            prompt, callback, model, temperature, max_tokens, kwargs
        )
    
    def _sync_stream_completion(self, prompt: str, callback: Callable[[str], None],
                               model: Optional[str] = None, temperature: float = 0.7,
                               max_tokens: int = 4096, extra_kwargs: dict = None) -> str:
        """Synchronous streaming completion helper"""
        try:
            # Prepare messages
            messages = [{"role": "user", "content": prompt}]
            
            # Filter out unsupported parameters
            supported_params = {
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True
            }
            
            # Add supported extra parameters
            if extra_kwargs:
                for key, value in extra_kwargs.items():
                    if key in ["top_p", "top_k", "frequency_penalty", "presence_penalty"]:
                        supported_params[key] = value
            
            response = self._client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                **supported_params
            )
            
            full_response = ""
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    callback(full_response)  # Send accumulated response
                
                # Check if stream is done
                if chunk.choices[0].finish_reason is not None:
                    break
            
            return full_response
        except Exception as e:
            raise RuntimeError(f"NVIDIA streaming API error: {str(e)}")
    
    def get_model_info(self, model_name: Optional[str] = None) -> dict:
        """Get information about a specific model"""
        model_name = model_name or self.default_model
        try:
            model_info = self._client.models.retrieve(model_name)
            return {
                "id": model_info.id,
                "object": model_info.object,
                "created": getattr(model_info, 'created', None),
                "owned_by": getattr(model_info, 'owned_by', 'nvidia')
            }
        except Exception as e:
            return {
                "id": model_name,
                "object": "model",
                "owned_by": "nvidia",
                "error": str(e)
            }
    
    def get_provider_info(self) -> dict:
        """Get enhanced provider information"""
        base_info = super().get_provider_info()
        base_info.update({
            "base_url": settings.nvidia_base_url,
            "embedding_model": settings.nvidia_embedding_model,
            "judge_model": settings.nvidia_judge_model,
            "supports_embeddings": True,
            "supports_reranking": True,
            "api_documentation": "https://docs.nvidia.com/nim/"
        })
        return base_info