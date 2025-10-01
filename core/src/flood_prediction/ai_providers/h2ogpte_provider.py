from typing import Callable, Optional, List
import asyncio
from functools import partial

from h2ogpte import H2OGPTE
from h2ogpte.types import ChatMessage, PartialChatMessage

from .base import AIProvider
from ..settings import settings


class H2OGPTEProvider(AIProvider):
    """H2OGPTE AI Provider implementation"""
    
    def __init__(self):
        self._client = H2OGPTE(
            address=settings.h2ogpte_url, 
            api_key=settings.h2ogpte_api_key
        )
    
    @property
    def provider_name(self) -> str:
        return "h2ogpte"
    
    @property
    def default_model(self) -> str:
        return settings.h2ogpte_model
    
    @property
    def supports_agents(self) -> bool:
        return True
    
    def get_available_models(self) -> List[str]:
        """Get list of available LLM models from H2OGPTE"""
        try:
            models = self._client.get_llm_names()
            return list(models)
        except Exception as e:
            print(f"Error fetching H2OGPTE models: {e}")
            return [self.default_model]  # Return default model as fallback
    
    async def chat_completion(self, prompt: str, model: Optional[str] = None, 
                             use_agent: bool = False, max_tokens: int = 4096, **kwargs) -> str:
        """
        Generate a chat completion response using H2OGPTE
        
        Args:
            prompt: The input prompt/message
            model: Model name to use (optional)
            use_agent: Whether to use agent functionality
            **kwargs: Additional parameters
            
        Returns:
            Generated response text
        """
        # Run the synchronous H2OGPTE call in a thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            partial(self._sync_chat_completion, prompt, model, use_agent, max_tokens, **kwargs)
        )
    
    def _sync_chat_completion(self, prompt: str, model: Optional[str] = None, 
                             use_agent: bool = False, max_tokens: int = 4096, **kwargs) -> str:
        """Synchronous chat completion helper"""
        chat_session_id = self._client.create_chat_session()
        with self._client.connect(chat_session_id) as session:
            # Filter out unsupported parameters for H2OGPTE
            llm_args = {
                "max_new_tokens": max_tokens,
                "use_agent": use_agent
            }
            
            # Add supported parameters from kwargs
            for key, value in kwargs.items():
                if key in ["temperature", "top_p", "top_k"]:
                    llm_args[key] = value
            
            response = session.query(
                prompt,
                llm=model or self.default_model,
                llm_args=llm_args,
            ).content
        return response
    
    async def stream_completion(self, prompt: str, callback: Callable[[str], None],
                               model: Optional[str] = None, use_agent: bool = False, 
                               max_tokens: int = 4096, **kwargs) -> str:
        """
        Generate a streaming chat completion response using H2OGPTE
        
        Args:
            prompt: The input prompt/message
            callback: Function called with each streaming chunk
            model: Model name to use (optional)
            use_agent: Whether to use agent functionality
            **kwargs: Additional parameters
            
        Returns:
            Final complete response text
        """
        # Run the synchronous H2OGPTE streaming call in a thread pool
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            partial(self._sync_stream_completion, prompt, callback, model, use_agent, max_tokens, **kwargs)
        )
    
    def _sync_stream_completion(self, prompt: str, callback: Callable[[str], None],
                               model: Optional[str] = None, use_agent: bool = False, 
                               max_tokens: int = 4096, **kwargs) -> str:
        """Synchronous streaming completion helper"""
        chat_session_id = self._client.create_chat_session()
        partial_msg = ""
        full_msg = ""
        
        def stream_callback(message):
            nonlocal full_msg, partial_msg
            if isinstance(message, ChatMessage):
                full_msg = message.content
            elif isinstance(message, PartialChatMessage):
                partial_msg += message.content
                callback(partial_msg)
        
        with self._client.connect(chat_session_id) as session:
            # Filter out unsupported parameters for H2OGPTE
            llm_args = {
                "max_new_tokens": max_tokens,
                "use_agent": use_agent
            }
            
            # Add supported parameters from kwargs
            for key, value in kwargs.items():
                if key in ["temperature", "top_p", "top_k"]:
                    llm_args[key] = value
            
            session.query(
                prompt,
                llm=model or self.default_model,
                llm_args=llm_args,
                timeout=60,
                callback=stream_callback
            )
        
        return full_msg if full_msg else partial_msg