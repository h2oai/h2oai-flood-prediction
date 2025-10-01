from .settings import settings
from .ai_providers import get_ai_provider, get_available_providers
from typing import Generator, Callable, Optional, List, Dict, Any


def get_available_llm_models(provider_name: Optional[str] = None) -> List[str]:
    """Get list of available LLM models from the specified provider"""
    try:
        ai_provider = get_ai_provider(provider_name)
        return ai_provider.get_available_models()
    except Exception as e:
        print(f"Error fetching LLM models: {e}")
        return [settings.h2ogpte_model if settings.ai_provider == "h2ogpte" else settings.nvidia_default_model]


async def llm_call(prompt: str, model: Optional[str] = None, use_agent: bool = False, 
                   provider_name: Optional[str] = None, **kwargs) -> str:
    """
    Generate a completion using the configured AI provider
    
    Args:
        prompt: The input prompt
        model: Model name (optional)
        use_agent: Whether to use agent functionality (H2OGPTE only)
        provider_name: Override provider (optional)
        **kwargs: Additional provider-specific parameters
    
    Returns:
        Generated response text
    """
    try:
        ai_provider = get_ai_provider(provider_name)
        
        # Pass use_agent parameter for H2OGPTE, ignore for others
        if ai_provider.provider_name == "h2ogpte":
            response = await ai_provider.chat_completion(
                prompt, model, use_agent=use_agent, **kwargs
            )
        else:
            response = await ai_provider.chat_completion(
                prompt, model, **kwargs
            )
        
        return response
    except Exception as e:
        print(f"Error in LLM call: {e}")
        raise


async def llm_call_stream(prompt: str, callback: Callable[[str], None], model: Optional[str] = None, 
                         use_agent: bool = False, provider_name: Optional[str] = None, **kwargs) -> str:
    """
    Generate a streaming completion using the configured AI provider
    
    Args:
        prompt: The input prompt
        callback: Function called with streaming chunks
        model: Model name (optional)
        use_agent: Whether to use agent functionality (H2OGPTE only)
        provider_name: Override provider (optional)
        **kwargs: Additional provider-specific parameters
    
    Returns:
        Final complete response text
    """
    try:
        ai_provider = get_ai_provider(provider_name)
        
        # Pass use_agent parameter for H2OGPTE, ignore for others
        if ai_provider.provider_name == "h2ogpte":
            response = await ai_provider.stream_completion(
                prompt, callback, model, use_agent=use_agent, **kwargs
            )
        else:
            response = await ai_provider.stream_completion(
                prompt, callback, model, **kwargs
            )
        
        return response
    except Exception as e:
        print(f"Error in LLM streaming call: {e}")
        raise


def get_provider_info(provider_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get information about the specified AI provider
    
    Args:
        provider_name: Provider name (optional, uses default if not specified)
        
    Returns:
        Provider information dictionary
    """
    try:
        ai_provider = get_ai_provider(provider_name)
        return ai_provider.get_provider_info()
    except Exception as e:
        return {
            "name": provider_name or settings.ai_provider,
            "error": str(e),
            "available": False
        }


def get_all_providers_info() -> Dict[str, Dict[str, Any]]:
    """
    Get information about all available AI providers
    
    Returns:
        Dictionary with information about all providers
    """
    return get_available_providers()