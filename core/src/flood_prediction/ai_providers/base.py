from abc import ABC, abstractmethod
from typing import Callable, Optional, List, Dict, Any


class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    async def chat_completion(self, prompt: str, model: Optional[str] = None, **kwargs) -> str:
        """
        Generate a chat completion response
        
        Args:
            prompt: The input prompt/message
            model: Model name to use (optional, uses default if not specified)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Generated response text
        """
        pass
    
    @abstractmethod
    async def stream_completion(self, prompt: str, callback: Callable[[str], None], 
                               model: Optional[str] = None, **kwargs) -> str:
        """
        Generate a streaming chat completion response
        
        Args:
            prompt: The input prompt/message
            callback: Function called with each streaming chunk
            model: Model name to use (optional, uses default if not specified)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Final complete response text
        """
        pass
    
    @abstractmethod
    def get_available_models(self) -> List[str]:
        """
        Get list of available models from this provider
        
        Returns:
            List of model names
        """
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """
        Get the name of this provider
        
        Returns:
            Provider name (e.g., "h2ogpte", "nvidia")
        """
        pass
    
    @property
    @abstractmethod
    def default_model(self) -> str:
        """
        Get the default model for this provider
        
        Returns:
            Default model name
        """
        pass
    
    def get_provider_info(self) -> Dict[str, Any]:
        """
        Get provider information and capabilities
        
        Returns:
            Dictionary with provider info
        """
        return {
            "name": self.provider_name,
            "default_model": self.default_model,
            "available_models": self.get_available_models(),
            "supports_streaming": True,
            "supports_agents": getattr(self, 'supports_agents', False)
        }